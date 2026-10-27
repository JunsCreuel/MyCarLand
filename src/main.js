// 차량 소개 사이트 진입점.
// Phase 1에서는 site.json을 제대로 읽는지만 보여준다. (스크롤 재생 엔진은 Phase 3)
import site from './config/site.json';
import './styles/preview.css';

document.title = site.meta.title;
document.documentElement.lang = site.meta.lang;

// 섹션 하나를 한 줄로 요약한다
function describe(section) {
  if (section.type === 'scrub') {
    const { folder, count } = section.frames;
    return `프레임 ${count}장 (/frames/${folder}) · 스크롤 ${section.scrollLength}vh`;
  }
  if (section.type === 'picker') return `옵션 ${section.options.map((o) => o.label).join(', ')}`;
  return '문의 버튼';
}

const app = document.querySelector('#app');
app.innerHTML = `
  <h1>${site.brand.logoText}</h1>
  <p class="muted">설정 미리보기 · 포인트 컬러
    <span class="swatch" style="background:${site.brand.accentColor}"></span><code>${site.brand.accentColor}</code></p>
  <ol>
    ${site.sections
      .map((s) => `<li><code>${s.id}</code> ${s.type} — <b>${s.copy.headline.replace('\n', ' ')}</b><br><span class="muted">${describe(s)}</span></li>`)
      .join('')}
  </ol>
`;
