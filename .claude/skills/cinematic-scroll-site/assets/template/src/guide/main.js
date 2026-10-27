// 촬영 가이드 페이지 진입점
// 내부용 정보(usedFor, scenes)를 뺀 shots.json 을 불러온다 (vite.config.js 의 publicShots 참고)
import data from '../config/shots.json?public';
import site from '../config/site.json';
import { createStore } from './storage.js';
import { renderDiagram } from './diagram.js';
import { renderShotList } from './shot-list.js';
import { renderCompares } from './compare.js';
import { setupShootMode } from './shoot-mode.js';
import './guide.css';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── 1) 브랜드 색·글꼴 (소개 사이트와 같은 site.json 을 쓴다) ──────────
const { brand } = site;
const css = document.documentElement.style;
css.setProperty('--accent', brand.accentColor);
if (brand.backgroundColor) css.setProperty('--bg', brand.backgroundColor);
if (brand.textColor) css.setProperty('--fg', brand.textColor);
css.setProperty('--font-head', `'${brand.fonts.headline.family}', 'Arial Narrow', Impact, sans-serif`);
css.setProperty('--font-body', `'${brand.fonts.body.family}', -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif`);
for (const font of Object.values(brand.fonts)) {
  if (!font.cssUrl) continue;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = font.cssUrl;
  document.head.append(link);
}
$$('[data-brand-name]').forEach((el) => (el.textContent = brand.logoText));

// ── 2) 숫자·링크 채우기 ─────────────────────────────────────────
const required = data.shots.filter((s) => s.required);
$$('[data-required-total]').forEach((el) => (el.textContent = required.length));
$$('[data-optional-total]').forEach((el) => (el.textContent = data.shots.length - required.length));
$('[data-kakao]').href = site.contact.kakaoOpenChat;

const store = createStore();
if (!store.available) $('[data-storage-note]').hidden = false;

// ── 3) 도식 · 컷 목록 · O/X 비교 ────────────────────────────────
function scrollToShot(id) {
  const card = document.getElementById(`shot-${id}`);
  if (!card) return;
  card.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
  card.focus({ preventScroll: true }); // 키보드·화면 낭독기 사용자도 카드로 이동
}
const diagram = renderDiagram($('#diagram'), data.shots, { onSelect: scrollToShot });
renderShotList($('#shot-list'), data, store);
renderCompares($('#compares'));

// 지금 화면 가운데에 가장 가까운 카드의 번호를 도식에서 강조한다
const visible = new Set();
function highlightCenterCard() {
  const mid = window.innerHeight / 2;
  let best = null;
  let bestDist = Infinity;
  visible.forEach((card) => {
    const r = card.getBoundingClientRect();
    const dist = Math.abs(r.top + r.height / 2 - mid);
    if (dist < bestDist) [best, bestDist] = [card, dist];
  });
  diagram.highlight(best ? Number(best.dataset.shot) : null);
}
// 화면 가운데 40% 띠 안에 들어온 카드만 후보로 둔다 (IntersectionObserver 가 알려 줌)
const cardObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
    highlightCenterCard();
  },
  { rootMargin: '-30% 0px -30% 0px' },
);
// 띠 안에서 카드가 움직이는 동안에도 가운데 카드가 바뀌므로 스크롤 때 다시 계산 (프레임당 한 번)
let raf = 0;
window.addEventListener('scroll', () => (raf ||= requestAnimationFrame(() => ((raf = 0), highlightCenterCard()))), {
  passive: true,
});
$$('.card').forEach((card) => cardObserver.observe(card));

// ── 4) 진행 상황 표시 ───────────────────────────────────────────
function renderProgress() {
  const done = required.filter((s) => store.isDone(s.id)).length;
  const all = done === required.length;
  $$('[data-done-count]').forEach((el) => (el.textContent = done));
  $$('[data-progress-fill]').forEach((el) => (el.style.transform = `scaleX(${done / required.length})`));
  $$('[data-start-label]').forEach((el) => (el.textContent = done > 0 && !all ? '이어서 촬영' : '촬영 시작'));
  $('[data-auto-check]').classList.toggle('is-checked', all);
  diagram.markDone(store.state.done);

  $$('[data-checklist]').forEach((box) => (box.checked = Boolean(store.state.checklist[box.dataset.checklist])));
  const manual = $$('[data-checklist]').every((box) => box.checked);
  $('[data-send-status]').textContent = all && manual
    ? '준비 끝! 카카오톡에서 사진을 원본으로 보내 주세요.'
    : `아직 확인할 것이 ${(all ? 0 : 1) + $$('[data-checklist]').filter((b) => !b.checked).length}개 있어요.`;
}
store.subscribe(renderProgress);
renderProgress();

$('.checklist').addEventListener('change', (e) => {
  const box = e.target.closest('[data-checklist]');
  if (box) store.setChecklist(box.dataset.checklist, box.checked);
});

$('[data-reset]').addEventListener('click', () => {
  if (window.confirm('찍었어요 체크를 모두 지울까요?')) store.reset();
});

// ── 5) 한 장씩 촬영 모드 ───────────────────────────────────────
const shoot = setupShootMode($('#shoot'), data, store, {
  onFinish: () => $('#send').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' }),
});
$$('[data-start-shoot]').forEach((btn) => btn.addEventListener('click', () => shoot.open()));

// ── 6) 아래 고정 막대: 맨 위 '촬영 시작' 버튼이 안 보이고, 보내기 섹션 전일 때만 ─────
const dock = $('[data-dock]');
const startBtn = $('.needs [data-start-shoot]');
const sendSection = $('#send');
let startVisible = true;
let sendVisible = false;
function updateDock() {
  const show = !startVisible && !sendVisible;
  dock.classList.toggle('is-shown', show);
  dock.setAttribute('aria-hidden', String(!show));
  dock.querySelector('button').tabIndex = show ? 0 : -1;
}
new IntersectionObserver(([e]) => {
  startVisible = e.isIntersecting;
  updateDock();
}).observe(startBtn);
new IntersectionObserver(([e]) => {
  sendVisible = e.isIntersecting;
  updateDock();
}).observe(sendSection);
