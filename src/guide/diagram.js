// 촬영 위치 도식: 위에서 내려다본 차 + 서야 할 위치(번호)
//
// 왜 이렇게 짰나
// - 위치는 shots.json 의 cameraPosition 으로 계산한다 (손으로 좌표를 박아 넣지 않음).
//   orbit 의 angleDeg 는 차 앞을 0도로, 위에서 볼 때 시계 반대 방향으로 잰 각도라서
//   0 = 위(앞), 90 = 왼쪽(운전석), 180 = 아래(뒤), 270 = 오른쪽(조수석)이 된다.
// - 차와 길(점선·화살표)은 SVG 로 그리고, 번호는 그 위에 진짜 <button> 을 겹쳐 놓는다.
//   그래야 손가락으로 누르기 쉬운 44px 크기를 보장하고, 키보드·화면 낭독기로도 쓸 수 있다.
const W = 360;
const H = 460;
const CX = W / 2;
const CY = H / 2;
const CAR_W = 112;
const CAR_H = 232;
const ORBIT_RX = 146; // 도는 길(타원)의 가로 반지름
const ORBIT_RY = 196; // 세로 반지름 (차가 세로로 길어서 더 크게)

const rad = (deg) => (deg * Math.PI) / 180;

// 각도 → 도식 위 좌표
function orbitPoint(angleDeg) {
  const a = rad(angleDeg);
  return { x: CX - ORBIT_RX * Math.sin(a), y: CY - ORBIT_RY * Math.cos(a) };
}

// 실내 컷 위치: 문 앞(차 옆면 바로 바깥) 또는 좌석
function interiorPoint(pos) {
  const side = CAR_W / 2 + 22;
  const doors = {
    'front-left': { x: CX - side, y: CY - 22 },
    'front-right': { x: CX + side, y: CY - 22 },
    'rear-left': { x: CX - side, y: CY + 46 },
    'rear-right': { x: CX + side, y: CY + 46 },
  };
  const seats = {
    'front-left': { x: CX - 24, y: CY - 20 },
    'front-right': { x: CX + 24, y: CY - 20 },
    'rear-left': { x: CX - 26, y: CY + 52 },
    'rear-center': { x: CX, y: CY + 52 },
    'rear-right': { x: CX + 26, y: CY + 52 },
  };
  if (pos.type === 'door') return doors[pos.door];
  if (pos.type === 'inside') return seats[pos.seat];
  return null;
}

// 화살표: 이웃한 두 위치 사이 가운데에, 도는 방향(각도가 커지는 쪽)을 가리키게
function arrow(a1, a2) {
  const mid = rad((a1 + (a2 < a1 ? a2 + 360 : a2)) / 2);
  const x = CX - ORBIT_RX * Math.sin(mid);
  const y = CY - ORBIT_RY * Math.cos(mid);
  // 각도가 커질 때 점이 움직이는 방향 = 위 식을 각도로 미분한 값
  const dir = (Math.atan2(ORBIT_RY * Math.sin(mid), -ORBIT_RX * Math.cos(mid)) * 180) / Math.PI;
  return `<path class="diagram__arrow" d="M-6 -6 L4 0 L-6 6" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${dir.toFixed(1)})"/>`;
}

function carSvg() {
  const x = CX - CAR_W / 2;
  const y = CY - CAR_H / 2;
  return `
    <g class="diagram__car">
      <rect x="${x}" y="${y}" width="${CAR_W}" height="${CAR_H}" rx="34"/>
      <!-- 앞유리·뒷유리 -->
      <path class="diagram__glass" d="M${x + 16} ${y + 66} Q${CX} ${y + 46} ${x + CAR_W - 16} ${y + 66} L${x + CAR_W - 22} ${y + 92} Q${CX} ${y + 82} ${x + 22} ${y + 92} Z"/>
      <path class="diagram__glass" d="M${x + 22} ${y + CAR_H - 58} Q${CX} ${y + CAR_H - 50} ${x + CAR_W - 22} ${y + CAR_H - 58} L${x + CAR_W - 18} ${y + CAR_H - 40} Q${CX} ${y + CAR_H - 32} ${x + 18} ${y + CAR_H - 40} Z"/>
      <!-- 헤드라이트 -->
      <rect class="diagram__light" x="${x + 14}" y="${y + 8}" width="22" height="8" rx="4"/>
      <rect class="diagram__light" x="${x + CAR_W - 36}" y="${y + 8}" width="22" height="8" rx="4"/>
      <!-- 운전석 핸들 (왼쪽) -->
      <circle class="diagram__wheel" cx="${CX - 24}" cy="${y + 110}" r="11"/>
    </g>
    <text class="diagram__label diagram__label--front" x="${CX}" y="${y - 14}">앞</text>
    <text class="diagram__label" x="${CX}" y="${y + CAR_H + 26}">뒤</text>
    <!-- 운전석 표시는 차 안 왼쪽 핸들 아래에 (차 옆은 실내 촬영 번호가 차지) -->
    <text class="diagram__label diagram__label--driver" x="${CX - 24}" y="${y + 138}">운전석</text>`;
}

/**
 * @param {HTMLElement} host 도식을 넣을 상자
 * @param {Array} shots shots.json 의 shots
 * @param {{ interactive?: boolean, onSelect?: (id:number)=>void }} options
 */
export function renderDiagram(host, shots, { interactive = true, onSelect } = {}) {
  const orbit = shots.filter((s) => s.cameraPosition.type === 'orbit');
  const inner = shots.filter((s) => ['door', 'inside'].includes(s.cameraPosition.type));

  // 도는 순서대로 이웃한 위치 사이에 화살표
  const sorted = [...orbit].sort((a, b) => a.cameraPosition.angleDeg - b.cameraPosition.angleDeg);
  const arrows = sorted
    .map((s, i) => arrow(s.cameraPosition.angleDeg, sorted[(i + 1) % sorted.length].cameraPosition.angleDeg))
    .slice(0, -1) // 8번 → 1번으로 돌아오는 화살표는 빼서 "1번에서 시작"이 분명하게
    .join('');

  const wrap = document.createElement('div');
  wrap.className = `diagram__canvas${interactive ? '' : ' diagram__canvas--mini'}`;
  wrap.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">
      <ellipse class="diagram__track" cx="${CX}" cy="${CY}" rx="${ORBIT_RX}" ry="${ORBIT_RY}"/>
      ${arrows}
      ${carSvg()}
    </svg>`;

  // 번호 버튼(또는 미니 도식이면 그냥 점)을 퍼센트 위치로 올린다 → 화면 크기와 상관없이 맞는 자리에
  const marks = new Map();
  const place = (shot, point, kind) => {
    const el = document.createElement(interactive ? 'button' : 'span');
    el.className = `pin pin--${kind}`;
    el.style.left = `${(point.x / W) * 100}%`;
    el.style.top = `${(point.y / H) * 100}%`;
    el.textContent = shot.id;
    el.dataset.shot = shot.id;
    if (interactive) {
      el.type = 'button';
      el.setAttribute('aria-label', `${shot.id}번 ${shot.title} 위치`);
      el.addEventListener('click', () => onSelect?.(shot.id));
    } else {
      el.setAttribute('aria-hidden', 'true');
    }
    wrap.append(el);
    marks.set(shot.id, el);
  };
  orbit.forEach((s) => place(s, orbitPoint(s.cameraPosition.angleDeg), 'orbit'));
  inner.forEach((s) => {
    const p = interiorPoint(s.cameraPosition);
    if (p) place(s, p, 'inside');
  });

  host.prepend(wrap);

  return {
    // 지금 보고 있는(또는 찍어야 할) 컷 강조. 도식에 없는 컷(디테일)이면 강조 없음
    highlight(id) {
      marks.forEach((el, key) => {
        const on = key === id;
        el.classList.toggle('is-current', on);
        if (interactive) {
          if (on) el.setAttribute('aria-current', 'true');
          else el.removeAttribute('aria-current');
        }
      });
    },
    markDone(doneSet) {
      marks.forEach((el, key) => el.classList.toggle('is-done', doneSet.has(key)));
    },
    has: (id) => marks.has(id),
  };
}
