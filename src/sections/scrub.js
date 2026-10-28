// scrub 섹션: 프레임 시퀀스로 보여주는 장면. 재생 방식은 두 가지다 (site.json 의 playback).
//
// playback: "scroll" — 스크롤하는 만큼 프레임이 넘어간다.
//   <section style="height: 300vh">     ← 이만큼 내리는 동안 장면이 재생됨
//     <div class="scene__sticky">       ← position: sticky 로 화면에 고정
//   ScrollTrigger 가 알려 주는 진행률(0~1)을 프레임 번호로 바꿔서 그린다.
//
//   단, 한 화면씩 넘기는 snap 모드에서는 섹션이 한 화면 높이로 고정되고
//   휠·스와이프 양만큼 영상이 앞뒤로 재생된다. 영상 끝까지 간 뒤에 한 번 더 굴리면 다음 화면 (snap.js 가 판단).
//
// playback: "auto" — 한 화면짜리 섹션. 화면에 들어오면 영상처럼 스스로 재생된다.
//   프레임을 전부 받은 뒤에 재생을 시작해서 중간에 끊기지 않게 한다.
//   끝나면 onEnd 에 따라 멈추거나("hold"), 다음 화면으로 넘어가거나("next"), 반복한다("loop").
import { FrameSequence } from '../core/frames.js';
import { CanvasRenderer } from '../core/renderer.js';
import { frameSet, mobileQuery, prefersReducedMotion } from '../core/device.js';
import { ScrollTrigger } from '../core/scroll.js';
import { copyHtml, escapeHtml, statsHtml } from './copy.js';

export function createScrub(section, site, { isFirst }) {
  const reduced = prefersReducedMotion();
  const auto = section.playback === 'auto';
  // snap 모드 + 스크롤 재생: 한 화면에 고정된 채 휠·스와이프로 영상을 넘긴다
  const screen = !auto && site.scroll?.mode === 'snap';
  const { count, posterFrame } = section.frames;
  const poster = (posterFrame ?? Math.ceil(count / 2)) - 1; // 0부터 세는 번호로
  const [copyFrom, copyTo] = section.copyRange ?? [0.15, 0.75];

  const el = document.createElement('section');
  el.className = `scene scene--scrub${reduced ? ' is-static' : ''}${auto ? ' is-auto' : ''}${screen ? ' is-screen' : ''}`;
  el.id = section.id;
  // 자동 재생이거나 동작 줄이기면 한 화면만, 아니면 설정한 스크롤 길이만큼
  el.style.setProperty('--scroll-length', auto || screen || reduced ? '100' : String(section.scrollLength));
  el.innerHTML = `
    <div class="scene__sticky">
      <canvas class="scene__canvas" ${section.frames.alt ? `role="img" aria-label="${escapeHtml(section.frames.alt)}"` : 'aria-hidden="true"'}></canvas>
      <div class="scene__shade shade-${section.copy.position ?? 'left'}"></div>
      <div class="scene__copy pos-${section.copy.position ?? 'left'}">
        ${copyHtml(section.copy, isFirst ? 'h1' : 'h2')}
      </div>
      ${statsHtml(section.stats)}
      ${screen && isFirst ? '<div class="scene__hint" aria-hidden="true">SCROLL</div>' : ''}
    </div>`;

  const canvas = el.querySelector('canvas');
  const copy = el.querySelector('.scene__copy');
  const renderer = new CanvasRenderer(canvas);
  // 지금 보여줘야 할 위치 (12.4 = 12번과 13번 사이). 동작 줄이기면 대표 장면 한 장
  let current = reduced ? poster : 0;
  let frames;
  let near = false; // 섹션이 가까워져서 나머지 프레임을 받기 시작했는지

  // 프레임 세트(PC/모바일)를 만들고 첫 장을 받는다
  function useSet() {
    frames = new FrameSequence({ ...site.frames, ...section.frames, set: frameSet() });
    frames.onFrameLoaded = () => show(current); // 기다리던 프레임이 도착하면 다시 그린다
    frames.loadFirst(Math.round(current));
    if (!reduced && near) frames.loadAll();
  }

  function loadRest() {
    if (!count || reduced) return;
    near = true;
    frames.loadAll();
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
  const pageReady = new Promise((resolve) => {
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 200));
    if (document.readyState === 'complete') idle(resolve);
    else window.addEventListener('load', () => idle(resolve), { once: true });
  });
  if (isFirst && count) pageReady.then(loadRest);
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

  // 스크롤이 멈추면 두 장이 겹친 상태로 남지 않게, 가장 가까운 한 장으로 살짝 맞춰 준다.
  // 겹쳐 그리기(크로스페이드)는 움직이는 동안에는 끊김을 가려 주지만, 멈춘 화면에서는
  // 차와 차선이 이중으로 보여서(고스팅) 화질이 나빠 보인다.
  const SETTLE_DELAY = 120; // 마지막 스크롤 갱신 후 이만큼 조용하면 "멈췄다"로 본다 (ms)
  const SETTLE_TIME = 160; // 가까운 장으로 옮겨 가는 시간 (ms). 0.5장 이하라 눈에는 마무리 감속처럼 보인다
  let settleTimer = 0;
  let settleRaf = 0;
  function cancelSettle() {
    clearTimeout(settleTimer);
    cancelAnimationFrame(settleRaf);
    settleRaf = 0;
  }
  function scheduleSettle() {
    cancelSettle();
    settleTimer = setTimeout(() => {
      const from = current;
      const to = Math.round(current);
      if (from === to) return;
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / SETTLE_TIME);
        show(from + (to - from) * (1 - (1 - k) ** 3));
        settleRaf = k < 1 ? requestAnimationFrame(step) : 0;
      };
      settleRaf = requestAnimationFrame(step);
    }, SETTLE_DELAY);
  }

  // 한 화면 전부터 나머지 프레임을 받기 시작 (두 방식 공통)
  function watchNear() {
    ScrollTrigger.create({
      trigger: el,
      start: 'top bottom+=100%',
      end: 'bottom top',
      onToggle: (self) => {
        // 첫 섹션은 처음부터 화면 안이라 바로 켜지는데, 그건 위의 load 이후 처리에 맡긴다
        if (isFirst && document.readyState !== 'complete') return;
        if (self.isActive) loadRest();
      },
    });
  }

  // ── snap 모드에서 스크롤로 재생 ─────────────────────────────
  // 휠 한 칸(약 100px)씩 오는 입력을 그대로 그리면 계단처럼 툭툭 넘어가므로,
  // 목표 위치(target)만 옮기고 화면은 매 프레임 목표를 부드럽게 따라가게 한다.
  if (screen) {
    const last = Math.max(0, count - 1);
    const distance = () => ((section.scrollLength ?? 200) / 100) * window.innerHeight; // 이만큼 굴리면 영상 끝까지
    const hint = el.querySelector('.scene__hint');
    let target = 0;
    let raf = 0;
    let prevTime = 0;
    function loop(now) {
      const dt = Math.min(64, now - (prevTime || now));
      prevTime = now;
      const k = 1 - Math.exp(-dt / 90); // 약 0.1초 만에 목표에 가까워지는 속도
      let pos = current + (target - current) * k;
      if (Math.abs(target - pos) < 0.01) pos = target;
      show(pos);
      if (pos !== target) {
        raf = requestAnimationFrame(loop);
        return;
      }
      raf = 0;
      prevTime = 0;
      // 멈춘 화면은 한 장으로 맞춘다 (두 장이 겹친 채 남으면 고스팅처럼 보인다)
      const whole = Math.round(target);
      if (whole !== target) {
        settleTimer = setTimeout(() => {
          target = whole;
          kick();
        }, SETTLE_DELAY);
      }
    }
    function kick() {
      clearTimeout(settleTimer);
      if (!raf) raf = requestAnimationFrame(loop);
    }
    // snap.js 가 쓰는 인터페이스: 이 방향으로 더 재생할 게 남았나 / px 만큼 재생
    el.scrubber = {
      canAdvance: (dir) => last > 0 && (dir > 0 ? target < last - 0.001 : target > 0.001),
      advance(px) {
        target = Math.max(0, Math.min(last, target + (px / distance()) * last));
        if (hint) hint.classList.toggle('is-hidden', target > 1);
        kick();
      },
    };
    return {
      el,
      init() {
        watchNear();
        new IntersectionObserver(([entry]) => copy.classList.toggle('is-visible', entry.isIntersecting), {
          threshold: 0.6,
        }).observe(el);
      },
    };
  }

  if (!auto) {
    return {
      el,
      // DOM 에 붙은 뒤에 ScrollTrigger 를 만든다 (위치 계산이 필요해서)
      init() {
        watchNear();
        ScrollTrigger.create({
          trigger: el,
          start: 'top top',
          end: 'bottom bottom',
          onUpdate: (self) => {
            const p = self.progress;
            if (count) {
              cancelSettle();
              show(p * (count - 1));
              scheduleSettle();
            }
            copy.classList.toggle('is-visible', p >= copyFrom && p <= copyTo);
          },
        });
        // 첫 섹션은 처음부터 글이 보이게 (진행률 0 에서 시작하므로)
        if (isFirst && copyFrom === 0) copy.classList.add('is-visible');
      },
    };
  }

  // ── 자동 재생 ───────────────────────────────────────────────
  const fps = section.fps ?? 30; // 1초에 넘길 프레임 수 (낮을수록 느린 슬로모션)
  const onEnd = section.onEnd ?? 'hold';
  let raf = 0;
  let playToken = 0; // 다시 재생하거나 멈추면 번호가 바뀌어, 이전 재생은 스스로 그만둔다

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    playToken += 1;
  }

  async function play(controller) {
    stop();
    const token = playToken;
    if (!count) return;
    show(0);
    if (isFirst) await pageReady; // 첫 장면도 페이지 로드가 끝난 뒤에 나머지 프레임을 받는다
    if (token !== playToken) return;
    loadRest();
    await frames.ready; // 전부 받을 때까지 첫 장면을 보여 주며 기다린다
    if (token !== playToken) return; // 기다리는 사이 다른 화면으로 넘어갔다
    const startedAt = performance.now();
    const tick = (now) => {
      if (token !== playToken) return;
      const pos = ((now - startedAt) / 1000) * fps;
      if (pos >= count - 1) {
        show(count - 1);
        raf = 0;
        if (onEnd === 'loop') play(controller);
        else if (onEnd === 'next') controller.nextFrom(el);
        return;
      }
      show(pos);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  return {
    el,
    init(controller) {
      watchNear();
      // 화면의 60% 이상이 보이면 "이 장면에 왔다"로 보고 처음부터 재생, 벗어나면 멈춘다
      new IntersectionObserver(
        ([entry]) => {
          copy.classList.toggle('is-visible', entry.isIntersecting);
          if (entry.isIntersecting) play(controller);
          else stop();
        },
        { threshold: 0.6 },
      ).observe(el);
    },
  };
}
