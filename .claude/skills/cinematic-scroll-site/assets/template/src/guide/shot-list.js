// 촬영 컷 카드 목록 (외관 → 실내 → 디테일)
import { escapeHtml, photoHtml, watchPhotos } from './photo.js';

const pad = (n) => String(n).padStart(2, '0');

export function renderShotList(host, data, store) {
  host.innerHTML = data.groups
    .map((group) => {
      const shots = data.shots.filter((s) => s.group === group.id);
      if (!shots.length) return '';
      return `
        <section class="group" aria-labelledby="group-${group.id}">
          <header class="group__head">
            <h3 class="group__title" id="group-${group.id}">${escapeHtml(group.label)}</h3>
            ${group.note ? `<p class="group__note">${escapeHtml(group.note)}</p>` : ''}
          </header>
          <ol class="cards">
            ${shots.map(cardHtml).join('')}
          </ol>
        </section>`;
    })
    .join('');

  watchPhotos(host);

  // 체크박스 하나로 "찍었어요" 상태를 저장 (촬영 모드와 같은 저장소를 쓴다)
  host.addEventListener('change', (e) => {
    const box = e.target.closest('input[data-done]');
    if (box) store.setDone(Number(box.dataset.done), box.checked);
  });

  const sync = () => {
    host.querySelectorAll('input[data-done]').forEach((box) => {
      const done = store.isDone(Number(box.dataset.done));
      box.checked = done;
      box.closest('.card').classList.toggle('is-done', done);
    });
  };
  store.subscribe(sync);
  sync();
}

function cardHtml(shot) {
  return `
    <li class="card" id="shot-${shot.id}" data-shot="${shot.id}" tabindex="-1">
      ${photoHtml(shot.samplePhoto, `${shot.title} 예시 사진`, '예시 사진 준비 중')}
      <div class="card__body">
        <div class="card__head">
          <span class="card__num" aria-hidden="true">${pad(shot.id)}</span>
          <h4 class="card__title"><span class="sr-only">${shot.id}번 </span>${escapeHtml(shot.title)}</h4>
          <span class="badge ${shot.required ? 'badge--required' : 'badge--optional'}">${shot.required ? '필수' : '선택'}</span>
        </div>
        <p class="card__howto">${escapeHtml(shot.howTo)}</p>
        <label class="done-toggle">
          <input type="checkbox" data-done="${shot.id}">
          <span class="checkmark" aria-hidden="true"><svg class="icon"><use href="#i-check"/></svg></span>
          <span>찍었어요</span>
        </label>
      </div>
    </li>`;
}
