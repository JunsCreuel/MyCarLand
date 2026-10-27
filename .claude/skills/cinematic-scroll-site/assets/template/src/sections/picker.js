// picker 섹션: 색상 버튼을 누르면 차 이미지가 크로스페이드로 바뀐다.
//
// 왜 이렇게 짰나
// - 옵션마다 <img> 를 한 장씩 겹쳐 두고, 선택된 것만 opacity 1 로 만든다.
//   (src 를 바꾸는 방식은 새 이미지를 받는 동안 화면이 깜빡인다)
// - 기본 옵션 이미지만 먼저 받고, 나머지는 섹션이 가까워지면 받는다 (loading="lazy").
// - 버튼은 라디오 그룹처럼 동작한다: aria-pressed 로 현재 선택을 알려 준다.
import { asset } from '../core/asset.js';
import { copyHtml, escapeHtml } from './copy.js';

export function createPicker(section, site) {
  const options = section.options;
  const initial = options.find((o) => o.id === section.defaultOption) ?? options[0];
  const mobileMax = (site.frames?.mobileMaxWidth ?? 768) - 0.02;

  const el = document.createElement('section');
  el.className = 'scene scene--picker';
  el.id = section.id;
  el.innerHTML = `
    <div class="picker__stage">
      ${options
        .map(
          (o) => `
        <picture class="picker__image${o === initial ? ' is-active' : ''}" data-option="${escapeHtml(o.id)}">
          <source media="(max-width: ${mobileMax}px)" srcset="${asset(o.image.mobile)}">
          <img src="${asset(o.image.desktop)}" alt="${escapeHtml(o.label)} 색상의 차" loading="lazy" decoding="async">
        </picture>`,
        )
        .join('')}
    </div>
    <div class="picker__panel">
      <div class="picker__copy">${copyHtml(section.copy)}</div>
      <div class="picker__options" role="group" aria-label="색상 선택">
        ${options
          .map(
            (o) => `
          <button type="button" class="swatch-btn" data-option="${escapeHtml(o.id)}" aria-pressed="${o === initial}">
            <span class="swatch-btn__chip" style="--chip:${o.swatch}"></span>
            <span class="swatch-btn__label">${escapeHtml(o.label)}</span>
          </button>`,
          )
          .join('')}
      </div>
      <p class="picker__current" aria-live="polite">${escapeHtml(initial.label)}</p>
    </div>`;

  const images = el.querySelectorAll('.picker__image');
  const buttons = el.querySelectorAll('.swatch-btn');
  const current = el.querySelector('.picker__current');

  // 기본 옵션은 lazy 를 풀어서 바로 받는다
  el.querySelector('.picker__image.is-active img').loading = 'eager';

  function select(id) {
    images.forEach((pic) => pic.classList.toggle('is-active', pic.dataset.option === id));
    buttons.forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.option === id)));
    current.textContent = options.find((o) => o.id === id).label;
  }

  el.querySelector('.picker__options').addEventListener('click', (e) => {
    const btn = e.target.closest('.swatch-btn');
    if (btn) select(btn.dataset.option);
  });

  return {
    el,
    init() {
      // 섹션이 한 화면 앞으로 다가오면 나머지 색상 이미지를 미리 받아 둔다 (누를 때 바로 바뀌게)
      const io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((en) => en.isIntersecting)) return;
          el.querySelectorAll('img[loading="lazy"]').forEach((img) => (img.loading = 'eager'));
          io.disconnect();
        },
        { rootMargin: '100% 0px' },
      );
      io.observe(el);
    },
  };
}
