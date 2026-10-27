// scrub 섹션: 스크롤하는 만큼 프레임이 넘어가는 장면.
//
// 구조
//   <section style="height: 300vh">          ← 스크롤 길이 (이만큼 내리는 동안 장면이 재생됨)
//     <div class="scene__sticky">            ← position: sticky 로 화면에 고정
//       <canvas>  + 글
//
// 섹션 높이가 화면보다 길고, 안쪽 상자가 sticky 라서 섹션을 지나가는 동안 화면에 붙어 있다.
// ScrollTrigger 가 알려 주는 진행률(0~1)을 프레임 번호로 바꿔서 그린다.
import { FrameSequence } from '../core/frames.js';
import { CanvasRenderer } from '../core/renderer.js';
import { frameSet, mobileQuery, prefersReducedMotion } from '../core/device.js';
import { ScrollTrigger } from '../core/scroll.js';
import { copyHtml, escapeHtml, statsHtml } from './copy.js';

export function createScrub(section, site, { isFirst }) {
  const reduced = prefersReducedMotion();
  const { count, posterFrame } = section.frames;
  const poster = (posterFrame ?? Math.ceil(count / 2)) - 1; // 0부터 세는 번호로
  const [copyFrom, copyTo] = section.copyRange ?? [0.15, 0.75];

  const el = document.createElement('section');
  el.className = `scene scene--scrub${reduced ? ' is-static' : ''}`;
  el.id = section.id;
  // 동작 줄이기면 스크롤 길이 없이 한 화면만
  el.style.setProperty('--scroll-length', reduced ? '100' : String(section.scrollLength));
  el.innerHTML = `
    <div class="scene__sticky">
      <canvas class="scene__canvas" ${section.frames.alt ? `role="img" aria-label="${escapeHtml(section.frames.alt)}"` : 'aria-hidden="true"'}></canvas>
      <div class="scene__shade shade-${section.copy.position ?? 'left'}"></div>
      <div class="scene__copy pos-${section.copy.position ?? 'left'}">
        ${copyHtml(section.copy, isFirst ? 'h1' : 'h2')}
      </div>
      ${statsHtml(section.stats)}
    </div>`;

  const canvas = el.querySelector('canvas');
  const copy = el.querySelector('.scene__copy');
  const renderer = new CanvasRenderer(canvas);
  let current = reduced ? poster : 0; // 지금 보여줘야 할 위치 (12.4 = 12번과 13번 사이)
  let frames;

  // 프레임 세트(PC/모바일)를 만들고 첫 장을 받는다
  function useSet() {
    frames = new FrameSequence({ ...site.frames, ...section.frames, set: frameSet() });
    // 기다리던 프레임이 도착하면 다시 그린다
    frames.onFrameLoaded = () => show(current);
    frames.loadFirst(current);
    if (!reduced && near) frames.loadAll();
  }

  // pos 위치를 그린다. 앞뒤 두 장이 모두 있으면 비율대로 겹치고,
  // 아직 안 받은 프레임이면 이미 받은 가장 가까운 한 장으로 대신한다.
  function show(pos) {
    current = pos;
    const a = Math.floor(pos);
    const b = Math.min(a + 1, count - 1);
    const imgA = frames.images[a];
    const imgB = frames.images[b];
    if (imgA && imgB) renderer.request(imgA, imgB, pos - a);
    else renderer.request(frames.nearest(Math.round(pos)));
  }

  // 첫 섹션은 페이지 로드가 끝나면 바로 나머지를 받는다.
  // (열자마자 받기 시작하면 첫 화면에 필요한 글꼴·JS 와 대역폭을 다퉈서 첫 화면이 늦어진다)
  let near = false;
  if (isFirst && count) {
    const startAll = () => {
      near = true;
      frames.loadAll();
    };
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 200));
    if (document.readyState === 'complete') idle(startAll);
    else window.addEventListener('load', () => idle(startAll), { once: true });
  }
  if (count === 0) {
    el.classList.add('is-empty'); // 아직 프레임이 없으면 글만 보인다
  } else {
    useSet();
    // 화면 폭이 768px 기준을 넘나들면 (회전 등) 다른 세트로 바꾼다
    mobileQuery.addEventListener('change', () => {
      useSet();
      show(current);
    });
  }

  if (reduced) {
    copy.classList.add('is-visible');
    return { el, init() {} };
  }

  return {
    el,
    // DOM 에 붙은 뒤에 ScrollTrigger 를 만든다 (위치 계산이 필요해서)
    init() {
      // 한 화면 전부터 나머지 프레임을 받기 시작
      ScrollTrigger.create({
        trigger: el,
        start: 'top bottom+=100%',
        end: 'bottom top',
        onToggle: (self) => {
          // 첫 섹션은 처음부터 화면 안이라 바로 켜지는데, 그건 위의 load 이후 처리에 맡긴다
          if (isFirst && document.readyState !== 'complete') return;
          if (self.isActive && count) {
            near = true;
            frames.loadAll();
          }
        },
      });

      // 진행률 → 프레임 번호, 글 보이기/숨기기
      ScrollTrigger.create({
        trigger: el,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
          const p = self.progress;
          if (count) show(p * (count - 1));
          copy.classList.toggle('is-visible', p >= copyFrom && p <= copyTo);
        },
      });

      // 첫 섹션은 처음부터 글이 보이게 (진행률 0 에서 시작하므로)
      if (isFirst && copyFrom === 0) copy.classList.add('is-visible');
    },
  };
}
