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

  // 지금 화면 맨 위가 속한 섹션 번호
  function currentIndex() {
    const y = window.scrollY + EDGE;
    const i = sectionEls.findIndex((s) => s.offsetTop <= y && s.offsetTop + s.offsetHeight > y);
    return i === -1 ? sectionEls.length - 1 : i;
  }

  function step(dir) {
    if (busy || performance.now() < lockedUntil) return;
    const y = window.scrollY;
    const i = currentIndex();
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
  }

  // wheelSpeed -1: 휠을 아래로 굴리면 onUp 이 불린다 → "다음 화면"
  // (터치는 손가락을 위로 밀면 onUp — 휠과 같은 방향이 되도록 맞춘 것)
  Observer.create({
    target: window,
    type: 'wheel,touch',
    wheelSpeed: -1,
    tolerance: 12,
    preventDefault: true,
    onUp: () => step(1),
    onDown: () => step(-1),
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
      if (!busy) window.scrollTo(0, sectionEls[currentIndex()].offsetTop);
    }, 150);
  });

  return {
    goToSection(el) {
      goTo(el.offsetTop);
    },
    // 지금 보고 있는 섹션이 el 이면 다음 화면으로 (자동 재생이 끝났을 때 사용)
    nextFrom(el) {
      if (busy || sectionEls[currentIndex()] !== el) return;
      lockedUntil = 0;
      step(1);
    },
  };
}
