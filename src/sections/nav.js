// 상단 고정 내비게이션(로고 + 문의 버튼)과 스크롤 진행 표시줄
import { escapeHtml } from './copy.js';

export function createNav(site) {
  const header = document.createElement('header');
  header.className = 'nav';
  const ctaTarget = site.sections.find((s) => s.type === 'cta');
  header.innerHTML = `
    <a class="nav__logo" href="#${site.sections[0].id}">${escapeHtml(site.brand.logoText)}</a>
    <a class="nav__cta" href="${ctaTarget ? `#${ctaTarget.id}` : escapeHtml(site.contact.kakaoOpenChat)}">
      ${escapeHtml(site.nav?.ctaLabel ?? '문의하기')}
    </a>
    <div class="nav__progress" aria-hidden="true"><span></span></div>`;

  const bar = header.querySelector('.nav__progress span');
  // 진행 표시줄: 전체 스크롤 중 어디쯤인지 scaleX 로 표시 (width 를 바꾸는 것보다 부드럽다)
  let raf = 0;
  const update = () => {
    raf = 0;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? window.scrollY / max : 0;
    bar.style.transform = `scaleX(${p})`;
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  window.addEventListener('scroll', () => (raf ||= requestAnimationFrame(update)), { passive: true });
  update();
  return header;
}
