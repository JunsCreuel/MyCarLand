// 임시 소재 만들기 — 실제 AI 영상이 나오기 전에 사이트를 먼저 완성하기 위한 것.
//
//   node scripts/make-placeholders.mjs
//
// 1) scrub 섹션마다 5초짜리 임시 영상(움직이는 그라데이션 + 프레임 번호)을 raw/placeholder/ 에 만들고
//    extract-frames.mjs 로 프레임을 뽑는다 (site.json 프레임 수도 자동 갱신).
// 2) 컬러 피커 옵션마다 차 실루엣 이미지를 swatch 색으로 그려 public/images/ 에 만든다.
// 3) 링크 공유용 썸네일 public/images/og.webp 를 만든다.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const site = JSON.parse(readFileSync(join(ROOT, 'src/config/site.json'), 'utf8'));
const RAW_DIR = join(ROOT, 'raw/placeholder');
mkdirSync(RAW_DIR, { recursive: true });

const SECONDS = 5;
const FPS = 24; // 5초 × 24 = 120장 → 영상 속 프레임 번호와 뽑힌 파일 번호가 같아진다

// 섹션별 분위기 색 (그라데이션 두 색). 목록에 없으면 기본색.
const THEMES = {
  hero: ['0x1a1206', '0x3d2a08'],
  detail: ['0x0d1418', '0x23343b'],
  night: ['0x050914', '0x1b2a4a'],
};
const DEFAULT_THEME = ['0x101012', '0x2a2a30'];

// drawtext 에 쓸 굵은 글꼴 (OS마다 위치가 달라 몇 군데를 찾아본다)
const FONT = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  'C:/Windows/Fonts/arialbd.ttf',
].find((f) => existsSync(f));
// ffmpeg 필터 안에서는 ':' 를 이스케이프해야 한다 (Windows 경로 C: 대비)
const fontOpt = FONT ? `fontfile='${FONT.replace(/:/g, '\\:')}':` : '';

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
}

// ── 1) 임시 영상 → 프레임 ─────────────────────────────────────
function placeholderVideo(section) {
  const [c0, c1] = THEMES[section.id] ?? DEFAULT_THEME;
  const out = join(RAW_DIR, `${section.id}.mp4`);
  const accent = `0x${site.brand.accentColor.slice(1)}`;
  // drawbox 는 위치를 시간에 따라 다시 계산하지 않아서, 움직이는 도형은 overlay 로 겹친다.
  // overlay 의 x 식은 프레임마다 다시 계산된다 (t = 현재 시각, W = 배경 폭).
  const filter = [
    // [0] 배경 그라데이션, [1] 차 대신 움직이는 막대, [2] 아래 진행 막대
    `[0][1]overlay=x='-600+t/${SECONDS}*(W+600)':y=H*0.62[a]`,
    `[a][2]overlay=x='-W+t/${SECONDS}*W':y=H-12[b]`,
    `[b]drawtext=${fontOpt}text='${section.id.toUpperCase()}':fontsize=64:fontcolor=white@0.55:x=80:y=80,` +
      // n 은 0부터 → +1 해서 파일 이름(0001.webp)과 맞춘다
      `drawtext=${fontOpt}text='%{eif\\:n+1\\:d\\:4}':fontsize=280:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-80[out]`,
  ].join(';');
  ffmpeg([
    '-f', 'lavfi', '-i', `gradients=s=1920x1080:r=${FPS}:d=${SECONDS}:c0=${c0}:c1=${c1}:speed=0.02:type=linear`,
    '-f', 'lavfi', '-i', `color=c=${accent}:s=600x150:r=${FPS}:d=${SECONDS}`,
    '-f', 'lavfi', '-i', `color=c=white@0.6:s=1920x12:r=${FPS}:d=${SECONDS}`,
    '-filter_complex', filter, '-map', '[out]',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
    out,
  ]);
  return out;
}

for (const section of site.sections.filter((s) => s.type === 'scrub')) {
  console.log(`\n▶ ${section.id}: 임시 영상 만드는 중`);
  const video = placeholderVideo(section);
  execFileSync('node', [join(ROOT, 'scripts/extract-frames.mjs'), video, section.id, '--fps', String(FPS)], {
    stdio: 'inherit',
  });
}

// ── 2) 컬러 피커 이미지 (SVG 실루엣 → WebP) ──────────────────
// 차 옆모습. 모든 옵션이 같은 구도라서 크로스페이드할 때 차 모양은 그대로, 색만 바뀐다.
function carSvg({ width, height, color, accent }) {
  const carW = 1600; // 아래 path 좌표계의 차 폭
  const scale = Math.min((width * 0.9) / carW, (height * 0.6) / 600);
  const x = (width - carW * scale) / 2;
  const y = height * 0.62 - 470 * scale; // 바퀴 바닥이 화면 62% 높이에 오게
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="spot" cx="50%" cy="35%" r="70%">
      <stop offset="0" stop-color="#2a2b2f"/><stop offset="1" stop-color="#08080a"/>
    </radialGradient>
    <linearGradient id="paint" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="0.45" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.45"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#spot)"/>
  <!-- 천장 조명 줄 -->
  ${[0.18, 0.5, 0.82].map((f) => `<rect x="${width * f - width * 0.12}" y="${height * 0.08}" width="${width * 0.24}" height="${Math.max(4, height * 0.008)}" rx="3" fill="#f4f4f0" opacity="0.8"/>`).join('')}
  <!-- 바닥 반사 -->
  <rect y="${height * 0.62}" width="100%" height="${height * 0.38}" fill="#0c0c0e"/>
  <ellipse cx="${width / 2}" cy="${height * 0.625}" rx="${carW * scale * 0.48}" ry="${18 * scale + 6}" fill="#000" opacity="0.7"/>
  <g transform="translate(${x} ${y}) scale(${scale})">
    <path d="M120 430 L110 380 Q115 330 170 315 C260 290 360 250 470 205 C560 170 700 150 820 150 C960 150 1060 185 1150 245 C1250 270 1380 290 1450 315 Q1500 330 1505 380 L1495 430 L1330 430 A110 110 0 0 0 1110 430 L500 430 A110 110 0 0 0 280 430 Z" fill="${color}"/>
    <path d="M120 430 L110 380 Q115 330 170 315 C260 290 360 250 470 205 C560 170 700 150 820 150 C960 150 1060 185 1150 245 C1250 270 1380 290 1450 315 Q1500 330 1505 380 L1495 430 L1330 430 A110 110 0 0 0 1110 430 L500 430 A110 110 0 0 0 280 430 Z" fill="url(#paint)"/>
    <path d="M520 222 C600 186 700 172 810 172 C915 172 1000 198 1070 240 L520 240 Z" fill="#0b0d10" opacity="0.92"/>
    <rect x="1440" y="318" width="50" height="14" rx="7" fill="#fff6d8" opacity="0.9"/>
    <rect x="118" y="326" width="40" height="12" rx="6" fill="#c8102e" opacity="0.9"/>
    ${[390, 1220].map((cx) => `
    <circle cx="${cx}" cy="430" r="96" fill="#0a0a0a"/>
    <circle cx="${cx}" cy="430" r="66" fill="#3a3b3f"/>
    <circle cx="${cx}" cy="430" r="58" fill="none" stroke="${accent}" stroke-width="10" opacity="0.9"/>
    <circle cx="${cx}" cy="430" r="14" fill="#9a9ca0"/>`).join('')}
  </g>
</svg>`;
}

function renderSvg(svg, outFile) {
  mkdirSync(dirname(outFile), { recursive: true });
  const tmp = join(RAW_DIR, 'tmp.svg');
  writeFileSync(tmp, svg);
  ffmpeg(['-i', tmp, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', outFile]);
}

const publicPath = (p) => join(ROOT, 'public', p.replace(/^\//, ''));
for (const section of site.sections.filter((s) => s.type === 'picker')) {
  for (const option of section.options) {
    console.log(`▶ 컬러 피커 이미지: ${option.label}`);
    renderSvg(carSvg({ width: 1920, height: 1080, color: option.swatch, accent: site.brand.accentColor }), publicPath(option.image.desktop));
    renderSvg(carSvg({ width: 828, height: 1104, color: option.swatch, accent: site.brand.accentColor }), publicPath(option.image.mobile));
  }
}

// ── 3) 공유 썸네일 ───────────────────────────────────────────
if (site.meta.ogImage) {
  console.log('▶ 공유 썸네일');
  const first = site.sections.find((s) => s.type === 'picker')?.options[0]?.swatch ?? '#888888';
  renderSvg(carSvg({ width: 1200, height: 630, color: first, accent: site.brand.accentColor }), publicPath(site.meta.ogImage));
}

console.log('\n임시 소재를 모두 만들었습니다. npm run check 로 확인해 보세요.');
