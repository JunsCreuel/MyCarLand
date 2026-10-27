// 좋은 예 / 나쁜 예 비교 (거리, 높이, 배경)
// public/guide/compare-<항목>-good.webp, -bad.webp 를 넣으면 사진이 보이고, 없으면 설명만 보인다.
import { escapeHtml, photoHtml, watchPhotos } from './photo.js';

const ITEMS = [
  {
    key: 'distance',
    title: '거리',
    good: '차 전체가 들어오고 앞뒤로 여백이 있어요',
    bad: '너무 가까워서 범퍼가 잘렸어요',
  },
  {
    key: 'height',
    title: '높이',
    good: '무릎을 굽혀 헤드라이트 높이에서',
    bad: '서서 내려다보면 차가 작고 납작해 보여요',
  },
  {
    key: 'background',
    title: '배경',
    good: '넓은 공터, 차와 겹치는 것이 없어요',
    bad: '다른 차·기둥이 차와 겹쳐요',
  },
];

export function renderCompares(host) {
  host.innerHTML = ITEMS.map(
    (item) => `
    <figure class="compare">
      <figcaption class="compare__title">${escapeHtml(item.title)}</figcaption>
      <div class="compare__pair">
        <div class="compare__side compare__side--good">
          ${photoHtml(`/guide/compare-${item.key}-good.webp`, `좋은 예: ${item.good}`, '좋은 예 사진')}
          <p><span class="ox ox--good" aria-hidden="true"><svg class="icon"><use href="#i-o"/></svg></span><span class="sr-only">좋은 예: </span>${escapeHtml(item.good)}</p>
        </div>
        <div class="compare__side compare__side--bad">
          ${photoHtml(`/guide/compare-${item.key}-bad.webp`, `나쁜 예: ${item.bad}`, '나쁜 예 사진')}
          <p><span class="ox ox--bad" aria-hidden="true"><svg class="icon"><use href="#i-x"/></svg></span><span class="sr-only">나쁜 예: </span>${escapeHtml(item.bad)}</p>
        </div>
      </div>
    </figure>`,
  ).join('');
  watchPhotos(host);
}
