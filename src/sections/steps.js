// steps 섹션: 제작 과정 (예: 촬영 → AI 장면 제작 → 사이트 완성)
//
// 왼쪽에 큰 헤드라인, 오른쪽에 큰 번호와 가는 줄로 나눈 단계 목록.
// 화면에 들어오면 단계가 위에서부터 차례로 떠오른다 (CSS 의 is-visible + 단계별 지연).
import { asset } from '../core/asset.js';
import { copyHtml, escapeHtml } from './copy.js';

const pad = (n) => String(n).padStart(2, '0');

// 버튼 링크: "guide" 는 촬영 가이드, "kakao" 는 카카오톡 오픈채팅, 그 외는 주소 그대로
function actionHref(action, site) {
  if (action.href === 'guide') return asset('/guide.html');
  if (action.href === 'kakao') return site.contact.kakaoOpenChat;
  return action.href;
}

export function createSteps(section, site) {
  const el = document.createElement('section');
  el.className = 'scene scene--steps';
  el.id = section.id;
  el.innerHTML = `
    <div class="steps__head">${copyHtml(section.copy)}</div>
    <ol class="steps__list">
      ${section.steps
        .map(
          (step, i) => `
        <li class="step" style="--i:${i}">
          <span class="step__num" aria-hidden="true">${pad(i + 1)}</span>
          <div class="step__body">
            ${step.label ? `<p class="step__label">${escapeHtml(step.label)}</p>` : ''}
            <h3 class="step__title">${escapeHtml(step.title)}</h3>
            <p class="step__text">${escapeHtml(step.text)}</p>
          </div>
        </li>`,
        )
        .join('')}
    </ol>
    ${
      section.actions?.length
        ? `<div class="steps__actions">
        ${section.actions
          .map((a, i) => {
            const href = actionHref(a, site);
            const external = /^https?:/.test(href);
            return `<a class="${i === 0 ? 'btn-pill' : 'link-secondary'}" href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener"' : ''}>${escapeHtml(a.label)}</a>`;
          })
          .join('')}
      </div>`
        : ''
    }`;

  return {
    el,
    init() {
      // 한 번 보이면 끝 (다시 숨기지 않는다 — 글을 읽다가 깜빡이면 거슬리므로)
      const io = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          el.classList.add('is-visible');
          io.disconnect();
        },
        { threshold: 0.35 },
      );
      io.observe(el);
    },
  };
}
