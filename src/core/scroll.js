// 스크롤 세팅: Lenis(부드러운 스크롤) + GSAP ScrollTrigger 연동.
//
// 왜 이렇게 짰나
// - Lenis 는 스크롤 위치를 부드럽게 보간해서 움직인다. ScrollTrigger 가 그 위치를
//   제때 알도록 Lenis 가 움직일 때마다 ScrollTrigger.update() 를 부른다.
// - 두 라이브러리가 각자 requestAnimationFrame 을 돌리면 박자가 어긋나서
//   GSAP 의 ticker 하나로 Lenis 를 같이 돌린다.
// - "동작 줄이기" 사용자는 Lenis 를 쓰지 않는다 (기본 스크롤 그대로).
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { prefersReducedMotion } from './device.js';

gsap.registerPlugin(ScrollTrigger);

export function setupScroll() {
  if (prefersReducedMotion()) return { lenis: null, ScrollTrigger };

  const lenis = new Lenis({
    duration: 1.1, // 값이 클수록 더 미끄러지듯 움직인다
    smoothWheel: true,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000)); // GSAP 시간은 초, Lenis 는 ms
  gsap.ticker.lagSmoothing(0); // 탭을 다녀왔을 때 스크롤이 튀지 않게

  // #contact 같은 내부 링크도 Lenis 로 부드럽게 이동
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: 0 });
  });

  return { lenis, ScrollTrigger };
}

export { gsap, ScrollTrigger };
