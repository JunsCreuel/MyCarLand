// 섹션 공통: 헤드라인·서브 카피 HTML 만들기
const escapeHtml = (s = '') =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// "AFTER\nDARK." + accentWord "DARK." → AFTER<br><span class="accent">DARK.</span>
export function headlineHtml({ headline, accentWord }) {
  return headline
    .split('\n')
    .map((line) => {
      const safe = escapeHtml(line);
      if (!accentWord || !line.includes(accentWord)) return safe;
      return safe.replace(escapeHtml(accentWord), `<span class="accent">${escapeHtml(accentWord)}</span>`);
    })
    .join('<br>');
}

// eyebrow + h2 + p 묶음. tag 로 첫 섹션만 h1 을 쓸 수 있다.
export function copyHtml(copy, tag = 'h2') {
  return `
    ${copy.eyebrow ? `<p class="eyebrow">${escapeHtml(copy.eyebrow)}</p>` : ''}
    <${tag} class="headline">${headlineHtml(copy)}</${tag}>
    ${copy.subcopy ? `<p class="subcopy">${escapeHtml(copy.subcopy)}</p>` : ''}
  `;
}

// 사양 패널 (레퍼런스의 오른쪽 위 작은 표)
export function statsHtml(stats) {
  if (!stats?.length) return '';
  return `
    <dl class="stats">
      ${stats.map((s) => `<div><dt>${escapeHtml(s.label)}</dt><dd>${escapeHtml(s.value)}</dd></div>`).join('')}
    </dl>`;
}

export { escapeHtml };
