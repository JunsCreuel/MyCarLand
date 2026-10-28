// 한 화면씩 넘기기 (site.json 의 scroll.mode 가 "snap" 일 때)
//
// 왜 이렇게 짰나
// - 휠·스와이프·키보드를 한 곳에서 감지해서 (휠은 직접, 터치는 GSAP Observer), 브라우저 기본 스크롤 대신
//   "다음 화면 맨 위"로 정해진 시간 동안 이동한다. 그래서 어중간한 위치에 멈추지 않는다.
// - 이동하는 동안과 끝난 직후 잠깐은 입력을 무시한다. 트랙패드는 손을 뗀 뒤에도
//   관성으로 휠 신호가 계속 와서, 막지 않으면 두세 화면을 한꺼번에 건너뛴다.
// - 화면보다 긴 섹션(모바일 컬러 피커 등)은 한 화면만큼씩 내려가서 끝까지 본 다음에 넘어간다.
// - 스크롤로 재생하는 장면(섹션에 el.scrubber 가 있음)에서는 입력을 먼저 영상 재생에 쓰고,
//   영상 끝에 닿은 뒤 "새로" 굴리거나 밀 때만 다음 화면으로 넘어간다.
import { gsap } from 'gsap';
import { Observer } from 'gsap/Observer';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { prefersReducedMotion } from './device.js';

gsap.registerPlugin(Observer, ScrollToPlugin);

const DURATION = 0.85; // 한 화면 넘어가는 시간(초)
const COOLDOWN = 450; // 도착 후 입력을 무시하는 시간(ms) — 트랙패드 관성 대비
const EDGE = 4; // 이 픽셀 이내면 "끝에 도달"로 본다
const SWIPE_MIN = 60; // 터치: 이만큼(px) 이상 밀어야 다음 화면으로
const FLICK_SPEED = 300; // 터치: 짧게 밀어도 이 속도(px/s) 이상으로 튕기면 다음 화면으로
const FOLLOW = 0.4; // 끄는 동안 화면이 손가락을 따라오는 비율 (1 = 그대로, 작을수록 묵직)
const GESTURE_GAP = 180; // 휠 신호가 이만큼(ms) 끊기면 새 동작으로 본다
const WHEEL_MIN = 12; // 한 동작에서 이만큼(px) 이상 굴려야 다음 화면 (트랙패드 살짝 스침 무시)
const TOUCH_GAIN = 2; // 터치로 영상을 넘길 때 손가락 이동량의 배율 (보통 세 번 쓸면 영상 끝)

export function setupSnap(sectionEls) {
  const reduced = prefersReducedMotion();
  let busy = false;
  let lockedUntil = 0;
  const vh = () => window.innerHeight;
  const maxY = () => document.documentElement.scrollHeight - vh();

  function goTo(y) {
    busy = true;
    gsap.to(window, {
      scrollTo: { y: Math.max(0, Math.min(y, maxY())), autoKill: false },
      duration: reduced ? 0 : DURATION,
      ease: 'power3.inOut',
      overwrite: true,
      onComplete() {
        busy = false;
        lockedUntil = performance.now() + COOLDOWN;
      },
    });
  }

  // 스크롤 위치 y 가 속한 섹션 번호 (기본은 지금 화면 맨 위)
  function indexAt(y = window.scrollY) {
    const top = y + EDGE;
    const i = sectionEls.findIndex((s) => s.offsetTop <= top && s.offsetTop + s.offsetHeight > top);
    return i === -1 ? sectionEls.length - 1 : i;
  }

  // dir: 1 다음 / -1 이전. fromY: 기준 위치 (터치로 끄는 중이면 끌기 시작한 위치)
  function step(dir, fromY = window.scrollY) {
    if (busy || performance.now() < lockedUntil) return;
    const y = fromY;
    const i = indexAt(y);
    const cur = sectionEls[i];
    const bottom = cur.offsetTop + cur.offsetHeight;
    if (dir > 0) {
      // 아직 이 섹션의 아랫부분이 남아 있으면 한 화면만큼 더 내려간다
      if (bottom - (y + vh()) > EDGE) return goTo(Math.min(y + vh(), bottom - vh()));
      const next = sectionEls[i + 1];
      return goTo(next ? next.offsetTop : maxY()); // 마지막이면 맨 아래(푸터)까지
    }
    if (y - cur.offsetTop > EDGE) return goTo(Math.max(cur.offsetTop, y - vh()));
    const prev = sectionEls[i - 1];
    if (prev) goTo(prev.offsetTop + Math.max(0, prev.offsetHeight - vh()));
    else goTo(y); // 맨 위에서 더 위로 밀면 제자리로
  }

  // 지금 화면의 섹션이 스크롤로 재생하는 장면이면 그 재생기 (아니면 null)
  const scrubberAt = () => (busy ? null : (sectionEls[indexAt()].scrubber ?? null));

  // 휠: 한 동작(신호 사이 간격 < GESTURE_GAP)을 단위로 판단한다.
  // - 이동 중·도착 직후에 들어온 동작은 끝날 때까지 통째로 무시 (트랙패드 관성)
  // - 영상이 남았으면 재생에 쓰고, 영상 끝에 닿으면 그 동작은 거기서 멈춘다.
  //   손을 떼고 다시 굴려야 다음 화면 → 영상 끝을 보여 주고 넘어간다.
  let lastWheel = 0;
  let spent = false; // 이 동작은 이미 쓰였거나 무시하기로 함
  let edgeAtStart = true; // 동작을 시작할 때 이미 영상 끝(또는 일반 섹션)이었나
  let wheelSum = 0;
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) return; // 트랙패드 확대(핀치)는 브라우저에 맡긴다
      e.preventDefault();
      const now = performance.now();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vh() : 1);
      const fresh = now - lastWheel > GESTURE_GAP;
      lastWheel = now;
      if (!dy) return;
      const dir = dy > 0 ? 1 : -1;
      if (fresh) {
        spent = false;
        wheelSum = 0;
        edgeAtStart = !scrubberAt()?.canAdvance(dir);
      }
      if (busy || now < lockedUntil) {
        spent = true;
        return;
      }
      if (spent) return;
      const sc = scrubberAt();
      if (sc?.canAdvance(dir)) return sc.advance(dy);
      if (!edgeAtStart) return; // 재생하다 끝에 닿은 동작 → 여기서 멈춤
      wheelSum += dy;
      if (Math.abs(wheelSum) < WHEEL_MIN) return;
      spent = true;
      step(dir);
    },
    { passive: false },
  );

  // 터치: 살짝 닿기만 해도 한 화면이 넘어가면 "밀리는" 느낌이 난다.
  // 그래서 끄는 동안은 화면이 손가락을 조금 따라오게 하고, 손을 뗄 때
  // 충분히 밀었거나(SWIPE_MIN) 빠르게 튕겼을 때(FLICK_SPEED)만 넘기고, 아니면 제자리로 돌려놓는다.
  let dragFrom = null; // 끌기 시작할 때의 스크롤 위치
  let dragMode = null; // 'scrub'(영상 재생) | 'page'(화면 넘기기) — 첫 움직임 방향으로 정한다
  let lastY = 0;
  let trail = []; // 최근 손가락 위치 기록 [{t, y}] — 손을 뗄 때 튕긴 속도를 직접 계산한다
  // (Observer 의 velocityY 는 손을 떼는 순간 0 에 가깝게 나와서 빠른 튕김을 못 잡았다)
  const flickSpeed = () => {
    const now = performance.now();
    const recent = trail.filter((p) => now - p.t < 100); // 마지막 0.1초
    if (recent.length < 2) return 0;
    const a = recent[0];
    const b = recent[recent.length - 1];
    return ((a.y - b.y) / Math.max(1, b.t - a.t)) * 1000; // 위로 튕기면 + (px/s)
  };
  Observer.create({
    target: window,
    type: 'touch',
    preventDefault: true, // 브라우저 기본 스크롤을 막고 우리가 직접 움직인다
    dragMinimum: 3,
    onPress(self) {
      dragFrom = busy ? null : window.scrollY;
      dragMode = null;
      lastY = self.y;
      trail = [{ t: performance.now(), y: self.y }];
    },
    onDrag(self) {
      if (dragFrom === null) return;
      trail.push({ t: performance.now(), y: self.y });
      if (trail.length > 20) trail.shift();
      const moved = self.startY - self.y; // 손가락을 위로 밀면 +
      if (!dragMode && moved) dragMode = scrubberAt()?.canAdvance(Math.sign(moved)) ? 'scrub' : 'page';
      if (dragMode === 'scrub') {
        scrubberAt()?.advance((lastY - self.y) * TOUCH_GAIN);
        lastY = self.y;
        return;
      }
      if (reduced) return;
      window.scrollTo(0, Math.max(0, Math.min(maxY(), dragFrom + moved * FOLLOW)));
    },
    onRelease(self) {
      if (dragFrom === null) return;
      const from = dragFrom;
      dragFrom = null;
      const moved = self.startY - self.y;
      const speed = flickSpeed();
      if (dragMode === 'scrub') {
        // 튕기고 손을 떼면 그 속도만큼 조금 더 재생 (관성). 영상 끝을 넘어 다음 화면으로 가지는 않는다
        scrubberAt()?.advance(speed * 0.1 * TOUCH_GAIN);
        return;
      }
      if (Math.abs(moved) < 2) return; // 그냥 탭(버튼 누르기 등)
      const dir =
        moved > SWIPE_MIN || speed > FLICK_SPEED ? 1 : moved < -SWIPE_MIN || speed < -FLICK_SPEED ? -1 : 0;
      lockedUntil = 0; // 손으로 한 동작이라 관성 대기 없이 바로 처리
      if (dir) step(dir, from);
      else goTo(from); // 덜 밀었으면 원래 자리로
    },
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    let dir = 0;
    if (['PageDown', 'ArrowDown', ' '].includes(e.key)) dir = e.shiftKey && e.key === ' ' ? -1 : 1;
    else if (['PageUp', 'ArrowUp'].includes(e.key)) dir = -1;
    if (!dir) return;
    e.preventDefault();
    // 영상 장면이면 한 번에 화면 높이의 절반만큼 재생, 끝이면 다음 화면
    const sc = scrubberAt();
    if (sc?.canAdvance(dir)) sc.advance(dir * vh() * 0.5);
    else step(dir);
  });

  // 창 크기가 바뀌면 지금 섹션 맨 위로 다시 맞춘다 (화면 회전 등)
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!busy) window.scrollTo(0, sectionEls[indexAt()].offsetTop);
    }, 150);
  });

  return {
    goToSection(el) {
      goTo(el.offsetTop);
    },
    // 지금 보고 있는 섹션이 el 이면 다음 화면으로 (자동 재생이 끝났을 때 사용)
    nextFrom(el) {
      if (busy || sectionEls[indexAt()] !== el) return;
      lockedUntil = 0;
      step(1);
    },
  };
}
