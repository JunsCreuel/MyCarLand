// cta 섹션: 문의. 카카오톡이 가장 크고, 전화·인스타는 보조.
import { asset } from '../core/asset.js';
import { copyHtml, escapeHtml } from './copy.js';

export function createCta(section, site) {
  const { kakaoOpenChat, phone, instagram } = site.contact;
  const el = document.createElement('section');
  el.className = 'scene scene--cta';
  el.id = section.id;
  if (section.background) {
    el.style.setProperty('--cta-bg', `url("${asset(section.background.desktop)}")`);
    el.style.setProperty('--cta-bg-mobile', `url("${asset(section.background.mobile ?? section.background.desktop)}")`);
    el.classList.add('has-bg');
  }

  el.innerHTML = `
    <div class="cta__inner pos-${section.copy.position ?? 'center'}">
      ${copyHtml(section.copy)}
      <div class="cta__actions">
        <a class="btn-kakao" href="${escapeHtml(kakaoOpenChat)}" target="_blank" rel="noopener">
          <svg class="btn-kakao__icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3C6.48 3 2 6.58 2 11c0 2.85 1.86 5.35 4.66 6.76l-.95 3.47a.4.4 0 0 0 .6.44l4.1-2.72c.52.06 1.05.1 1.59.1 5.52 0 10-3.58 10-8.05S17.52 3 12 3z"/></svg>
          ${escapeHtml(section.kakaoLabel ?? '카카오톡으로 문의하기')}
        </a>
        <div class="cta__secondary">
          ${phone ? `<a class="link-secondary" href="tel:${escapeHtml(phone.replace(/-/g, ''))}">전화 ${escapeHtml(phone)}</a>` : ''}
          ${instagram ? `<a class="link-secondary" href="https://instagram.com/${escapeHtml(instagram)}" target="_blank" rel="noopener">인스타그램 @${escapeHtml(instagram)}</a>` : ''}
        </div>
      </div>
    </div>`;
  return { el, init() {} };
}
