// 스크롤 세팅. site.json 의 scroll.mode 로 두 가지 중 하나를 쓴다.
//
// - "snap" : 휠·스와이프 한 번에 한 화면씩 넘어간다 (snap.js). 장면 영상은 스스로 재생.
// - "free" : Lenis 로 부드럽게 자유 스크롤. 장면 영상을 스크롤로 재생할 때 어울린다.
//
// 왜 Lenis 와 ScrollTrigger 를 이렇게 묶나
// - Lenis 는 스크롤 위치를 부드럽게 보간해서 움직인다. ScrollTrigger 가 그 위치를
//   제때 알도록 Lenis 가 움직일 때마다 ScrollTrigger.update() 를 부른다.
// - 두 라이브러리가 각자 requestAnimationFrame 을 돌리면 박자가 어긋나서
//   GSAP 의 ticker 하나로 Lenis 를 같이 돌린다.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { prefersReducedMotion } from './device.js';
import { setupSnap } from './snap.js';

gsap.registerPlugin(ScrollTrigger);

/**
 * @param {object} site site.json
 * @param {HTMLElement[]} sectionEls 화면 순서대로의 섹션 요소
 * @returns {{ goToSection(el: HTMLElement): void, nextFrom(el: HTMLElement): void }}
 */
export function setupScroll(site, sectionEls) {
  const mode = site.scroll?.mode ?? 'free';
  let controller;

  if (mode === 'snap') {
    document.documentElement.classList.add('is-snap');
    controller = setupSnap(sectionEls);
  } else if (!prefersReducedMotion()) {
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true }); // duration 이 클수록 더 미끄러지듯
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000)); // GSAP 시간은 초, Lenis 는 ms
    gsap.ticker.lagSmoothing(0); // 탭을 다녀왔을 때 스크롤이 튀지 않게
    controller = { goToSection: (el) => lenis.scrollTo(el, { offset: 0 }), nextFrom() {} };
  } else {
    controller = { goToSection: (el) => el.scrollIntoView(), nextFrom() {} };
  }

  // #contact 같은 내부 링크도 같은 방식으로 이동
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    const target = link && document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    controller.goToSection(target.closest('main > section') ?? target);
  });

  return controller;
}

export { gsap, ScrollTrigger };
