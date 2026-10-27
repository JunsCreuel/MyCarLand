// 컬러 피커 이미지 만들기: 영상의 한 장면을 골라 차 색만 바꾼 정지 이미지를 옵션별로 만든다.
//
//   node scripts/make-picker-images.mjs raw/stock/targa.webm --at 44 --focus-x 0.6
//
// - site.json 의 picker 섹션 options 마다 PC(1920px)·모바일(828×1104) 이미지를 만든다.
// - 색 바꾸기는 ffmpeg huesaturation 필터로 "차 색 계열만" 돌린다.
//   원본 차가 청록(c+b) 계열이라 들판(노랑)·도로(회색)는 그대로 남는다.
//   다른 색 차를 쓰면 RECOLOR 의 colors 값을 그 차 색 계열로 바꿔야 한다
//   (r 빨강, y 노랑, g 초록, c 청록, b 파랑, m 자주).
// - 나중에 AI로 색 바꾼 이미지를 만들면(Phase 7) 이 스크립트 대신 그 이미지를 쓰면 된다.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const site = JSON.parse(readFileSync(join(ROOT, 'src/config/site.json'), 'utf8'));

// 옵션 id → 색 바꾸기 필터. 목록에 없는 id 는 원본 그대로.
const SOURCE_COLORS = 'c+b';
const RECOLOR = {
  original: null,
  'guards-red': `huesaturation=hue=165:saturation=0.25:colors=${SOURCE_COLORS}:strength=100`,
  'jet-black': `huesaturation=saturation=-1:intensity=-0.3:colors=${SOURCE_COLORS}:strength=100`,
  'gt-silver': `huesaturation=saturation=-1:intensity=0.5:colors=${SOURCE_COLORS}:strength=100`,
  'irish-green': `huesaturation=hue=-60:saturation=0.2:colors=${SOURCE_COLORS}:strength=100`,
};

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const input = args[0];
if (!input) {
  console.error('사용법: node scripts/make-picker-images.mjs <영상 또는 사진> [--at 초] [--focus-x 0~1]');
  process.exit(1);
}
const at = opt('at', null); // 영상이면 몇 초 지점의 장면을 쓸지
const focusX = Number(opt('focus-x', 0.5)); // 모바일(세로)로 자를 때 차가 있는 가로 위치

const picker = site.sections.find((s) => s.type === 'picker');
if (!picker) {
  console.error('site.json 에 picker 섹션이 없습니다.');
  process.exit(1);
}

const out = (p) => join(ROOT, 'public', p.replace(/^\//, ''));

for (const option of picker.options) {
  const recolor = RECOLOR[option.id];
  if (recolor === undefined) console.warn(`  경고: "${option.id}" 색 바꾸기 설정이 없어 원본 색으로 만듭니다.`);
  const color = recolor ?? 'null';
  // 모바일: 높이는 그대로 두고 3:4 비율로 자르되, 차가 있는 쪽(focusX)을 가운데로
  const mobileCrop = `crop=ih*3/4:ih:'max(0,min(iw-ih*3/4,iw*${focusX}-ih*3/8))':0`;
  const jobs = [
    [option.image.desktop, `${color},scale=1920:-2:flags=lanczos`],
    [option.image.mobile, `${color},${mobileCrop},scale=828:-2:flags=lanczos`],
  ];
  for (const [file, filter] of jobs) {
    mkdirSync(dirname(out(file)), { recursive: true });
    execFileSync('ffmpeg', [
      '-v', 'error', '-y',
      '-i', resolve(input),
      // 영상이면 --at 초 지점의 한 장면을 쓴다
      ...(at != null ? ['-ss', String(at)] : []),
      '-frames:v', '1', '-vf', filter,
      '-c:v', 'libwebp', '-quality', '80',
      out(file),
    ], { stdio: 'inherit' });
  }
  console.log(`  ${option.label} → ${option.image.desktop}`);
}
console.log('컬러 피커 이미지를 만들었습니다.');
