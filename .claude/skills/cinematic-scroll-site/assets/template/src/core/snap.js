// 한 화면씩 넘기기 (site.json 의 scroll.mode 가 "snap" 일 때)
//
// 왜 이렇게 짰나
// - 휠·스와이프·키보드를 GSAP Observer 로 한 번만 감지해서, 브라우저 기본 스크롤 대신
//   "다음 화면 맨 위"로 정해진 시간 동안 이동한다. 그래서 어중간한 위치에 멈추지 않는다.
// - 이동하는 동안과 끝난 직후 잠깐은 입력을 무시한다. 트랙패드는 손을 뗀 뒤에도
//   관성으로 휠 신호가 계속 와서, 막지 않으면 두세 화면을 한꺼번에 건너뛴다.
// - 화면보다 긴 섹션(모바일 컬러 피커 등)은 한 화면만큼씩 내려가서 끝까지 본 다음에 넘어간다.
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

  // 휠: wheelSpeed -1 이라 아래로 굴리면 onUp → "다음 화면"
  Observer.create({
    target: window,
    type: 'wheel',
    wheelSpeed: -1,
    tolerance: 12,
    preventDefault: true,
    onUp: () => step(1),
    onDown: () => step(-1),
  });

  // 터치: 살짝 닿기만 해도 한 화면이 넘어가면 "밀리는" 느낌이 난다.
  // 그래서 끄는 동안은 화면이 손가락을 조금 따라오게 하고, 손을 뗄 때
  // 충분히 밀었거나(SWIPE_MIN) 빠르게 튕겼을 때(FLICK_SPEED)만 넘기고, 아니면 제자리로 돌려놓는다.
  let dragFrom = null; // 끌기 시작할 때의 스크롤 위치
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
      trail = [{ t: performance.now(), y: self.y }];
    },
    onDrag(self) {
      if (dragFrom === null) return;
      trail.push({ t: performance.now(), y: self.y });
      if (trail.length > 20) trail.shift();
      if (reduced) return;
      const moved = self.startY - self.y; // 손가락을 위로 밀면 +
      window.scrollTo(0, Math.max(0, Math.min(maxY(), dragFrom + moved * FOLLOW)));
    },
    onRelease(self) {
      if (dragFrom === null) return;
      const from = dragFrom;
      dragFrom = null;
      const moved = self.startY - self.y;
      const speed = flickSpeed();
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
    if (['PageDown', 'ArrowDown', ' '].includes(e.key)) {
      e.preventDefault();
      step(e.shiftKey && e.key === ' ' ? -1 : 1);
    } else if (['PageUp', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      step(-1);
    }
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
