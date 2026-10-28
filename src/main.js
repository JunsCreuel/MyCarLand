// 차량 소개 사이트 진입점: site.json 을 읽어 섹션을 차례로 만든다.
// 새 섹션 종류를 추가하려면 src/sections/ 에 모듈을 만들고 아래 BUILDERS 에 등록하면 된다.
import site from './config/site.json';
import { setupScroll, ScrollTrigger } from './core/scroll.js';
import { createScrub } from './sections/scrub.js';
import { createPicker } from './sections/picker.js';
import { createCta } from './sections/cta.js';
import { createNav } from './sections/nav.js';
import { escapeHtml } from './sections/copy.js';
import './styles/site.css';

const BUILDERS = { scrub: createScrub, picker: createPicker, cta: createCta };

// 1) 브랜드 색·글꼴을 CSS 변수로 (스타일시트는 변수만 쓴다)
const { brand } = site;
const root = document.documentElement.style;
root.setProperty('--accent', brand.accentColor);
if (brand.backgroundColor) root.setProperty('--bg', brand.backgroundColor);
if (brand.textColor) root.setProperty('--fg', brand.textColor);
root.setProperty('--font-head', `'${brand.fonts.headline.family}', 'Arial Narrow', Impact, sans-serif`);
root.setProperty('--font-body', `'${brand.fonts.body.family}', -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif`);

// 2) 섹션 만들기
const app = document.querySelector('#app');
app.append(createNav(site));
const main = document.createElement('main');
const sections = site.sections.map((section, i) =>
  BUILDERS[section.type](section, site, { isFirst: i === 0 }),
);
sections.forEach((s) => main.append(s.el));
app.append(main);

// 3) 출처·저작권 줄
const footer = document.createElement('footer');
footer.className = 'footer';
footer.innerHTML = `
  <span>© ${new Date().getFullYear()} ${escapeHtml(brand.name)}</span>
  ${(site.credits ?? [])
    .map((c) => (c.url ? `<a href="${escapeHtml(c.url)}" target="_blank" rel="noopener">${escapeHtml(c.text)}</a>` : `<span>${escapeHtml(c.text)}</span>`))
    .join('')}`;
app.append(footer);

// 4) 스크롤 연결. DOM 이 다 붙은 뒤에 해야 ScrollTrigger 가 위치를 제대로 잰다.
setupScroll();
sections.forEach((s) => s.init());

// 글꼴이 늦게 도착하면 글 높이가 바뀌므로 위치를 다시 잰다
document.fonts?.ready.then(() => ScrollTrigger.refresh());
