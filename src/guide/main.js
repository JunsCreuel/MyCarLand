// 촬영 가이드 페이지 진입점.
// Phase 1에서는 shots.json을 묶음별로 나열만 한다. (실제 가이드 화면은 Phase 5)
import data from '../config/shots.json';
import '../styles/preview.css';

const root = document.querySelector('#guide');
root.innerHTML = `
  <h1>내 차 촬영 가이드</h1>
  <p class="muted">shots.json 미리보기 · 컷 ${data.shots.length}개</p>
  ${data.groups
    .map((group) => {
      const shots = data.shots.filter((s) => s.group === group.id);
      return `
        <h2>${group.label}</h2>
        <p class="muted">${group.note ?? ''}</p>
        <ul>${shots
          .map((s) => `<li><b>${s.id}. ${s.title}</b> ${s.required ? '(필수)' : '(선택)'}<br><span class="muted">${s.howTo}</span></li>`)
          .join('')}</ul>`;
    })
    .join('')}
`;
