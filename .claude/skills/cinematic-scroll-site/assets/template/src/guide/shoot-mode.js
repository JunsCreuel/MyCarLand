// 한 장씩 촬영 모드
//
// 필수 컷을 순서대로 하나씩 크게 보여 주고, "찍었어요 → 다음"을 누르면 체크하고 넘어간다.
// 필수가 끝나면 선택(디테일) 컷을 이어서 보여 주고, 마지막에 빠진 필수 컷을 알려 준다.
// <dialog> 의 showModal() 은 뒤 화면을 못 누르게 막고 ESC 로 닫히는 기능을 기본으로 준다.
import { renderDiagram } from './diagram.js';
import { escapeHtml } from './photo.js';

const pad = (n) => String(n).padStart(2, '0');

export function setupShootMode(dialog, data, store, { onFinish } = {}) {
  const required = data.shots.filter((s) => s.required);
  const optional = data.shots.filter((s) => !s.required);
  const order = [...required, ...optional];
  const groupLabel = Object.fromEntries(data.groups.map((g) => [g.id, g.label]));
  const $ = (sel) => dialog.querySelector(sel);

  const map = renderDiagram($('[data-shoot-map]'), data.shots, { interactive: false });
  let index = 0;

  function firstUndone() {
    const i = order.findIndex((s) => s.required && !store.isDone(s.id));
    return i === -1 ? 0 : i;
  }

  function showShot() {
    const shot = order[index];
    const isRequired = shot.required;
    $('[data-shoot-stage]').hidden = false;
    $('[data-shoot-actions]').hidden = false;
    $('[data-shoot-finish]').hidden = true;
    $('[data-finish-actions]').hidden = true;

    // 진행 표시: 필수는 "3 / 12", 선택은 "선택 1 / 5"
    const pos = isRequired ? required.indexOf(shot) + 1 : optional.indexOf(shot) + 1;
    const total = isRequired ? required.length : optional.length;
    $('[data-shoot-count]').textContent = `${isRequired ? '' : '선택 '}${pos} / ${total}`;
    $('[data-shoot-fill]').style.transform = `scaleX(${pos / total})`;
    const badge = $('[data-shoot-badge]');
    badge.textContent = isRequired ? '필수' : '선택';
    badge.className = `badge ${isRequired ? 'badge--required' : 'badge--optional'}`;

    $('[data-shoot-group]').textContent = groupLabel[shot.group] ?? '';
    $('[data-shoot-num]').textContent = pad(shot.id);
    $('[data-shoot-name]').textContent = shot.title;
    $('[data-shoot-howto]').textContent = shot.howTo;
    $('[data-shoot-flag]').hidden = !store.isDone(shot.id);
    $('[data-shoot-prev]').disabled = index === 0;

    // 도식에 없는 디테일 컷이면 미니 도식을 숨긴다
    $('[data-shoot-map]').hidden = !map.has(shot.id);
    map.markDone(store.state.done);
    map.highlight(shot.id);
  }

  function showFinish() {
    const missing = required.filter((s) => !store.isDone(s.id));
    $('[data-shoot-stage]').hidden = true;
    $('[data-shoot-actions]').hidden = true;
    $('[data-shoot-finish]').hidden = false;
    $('[data-finish-actions]').hidden = false;
    $('[data-shoot-count]').textContent = '완료';
    $('[data-shoot-fill]').style.transform = 'scaleX(1)';
    $('[data-shoot-badge]').textContent = '';
    $('[data-shoot-badge]').className = 'badge';
    $('[data-finish-title]').textContent = missing.length ? `필수 ${missing.length}장이 남았어요` : '다 찍었어요';
    $('[data-finish-text]').textContent = missing.length
      ? '아래 컷을 눌러 다시 찍어 주세요.'
      : '보내기 전에 가로로 찍었는지, 흐린 사진은 없는지만 확인해 주세요.';
    $('[data-finish-missing]').innerHTML = missing
      .map((s) => `<button type="button" class="missing__item" data-goto="${s.id}">${pad(s.id)} ${escapeHtml(s.title)}</button>`)
      .join('');
  }

  function go(i) {
    if (i >= order.length) return showFinish();
    index = Math.max(0, i);
    showShot();
  }

  $('[data-shoot-next]').addEventListener('click', () => {
    store.setDone(order[index].id, true);
    go(index + 1);
  });
  $('[data-shoot-skip]').addEventListener('click', () => go(index + 1));
  $('[data-shoot-prev]').addEventListener('click', () => go(index - 1));
  $('[data-finish-back]').addEventListener('click', () => go(order.length - 1));
  $('[data-finish-missing]').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-goto]');
    if (btn) go(order.findIndex((s) => s.id === Number(btn.dataset.goto)));
  });
  $('[data-finish-send]').addEventListener('click', () => {
    dialog.close();
    onFinish?.();
  });
  $('[data-shoot-close]').addEventListener('click', () => dialog.close());

  return {
    open() {
      go(firstUndone()); // 이어서 찍기: 아직 안 찍은 첫 필수 컷부터
      dialog.showModal();
      $('[data-shoot-next]').focus();
    },
  };
}
