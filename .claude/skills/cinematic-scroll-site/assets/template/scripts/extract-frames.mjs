// 영상 → 스크롤용 WebP 프레임
//
// 사용법:
//   node scripts/extract-frames.mjs raw/clip.webm hero --start 66.6 --duration 2
//   node scripts/extract-frames.mjs raw/hero.mp4 hero --mobile-src raw/hero-vertical.mp4
//
// 끊김 없이 보이려면 (중요)
// - 한 섹션에는 "컷이 바뀌지 않는 한 장면"만 넣는다. 구간 안에 장면 전환(컷)이 있으면
//   스크롤 도중 화면이 툭 바뀌고, 그 사이에 멈추면 두 장면이 반투명하게 겹쳐 보인다.
//   그래서 구간 안에 컷이 있으면 멈춘다 (정말 필요하면 --allow-cuts).
// - 프레임은 원본 프레임레이트 그대로(--fps source, 기본) 뽑고 중복 프레임만 뺀다.
//   24fps 처럼 솎아 내면 빠르게 움직이는 드론 영상은 장마다 많이 움직여서 툭툭 넘어간다.
//   120장 한도를 넘으면 fps 를 낮추지 않고 --duration 을 줄이라고 알려 준다.
//
// 결과:
//   public/frames/<섹션id>/desktop/0001.webp ...  (가로 1920px)
//   public/frames/<섹션id>/mobile/0001.webp ...   (가로 828px, 기본은 가운데를 3:4로 잘라냄)
//   site.json 에서 그 섹션의 frames.count 를 자동으로 갱신
//
// 옵션:
//   --fps <n|source>     초당 프레임 수 (기본 source = 원본 프레임 그대로). 중복 프레임은 자동으로 뺀다
//   --allow-cuts         구간 안에 장면 전환이 있어도 진행 (권장하지 않음)
//   --max <n>            최대 프레임 수 (기본 120)
//   --quality <n>        PC 프레임 WebP 품질 0~100 (기본 82)
//   --mobile-quality <n> 모바일 프레임 WebP 품질 (기본 = --quality). 용량을 줄이려면 여기를 낮춘다
//   --mobile-src <파일>  모바일용 세로 영상이 따로 있으면 지정 (없으면 원본에서 잘라냄)
//   --mobile-aspect <w:h> 원본에서 잘라낼 모바일 비율 (기본 3:4)
//   --focus-x <0~1>      모바일로 자를 때 가운데로 올 가로 위치 (기본 0.5, 차가 오른쪽에 있으면 0.7 등)
//   --start <초>         영상의 이 지점부터 사용 (예: 38.5)
//   --duration <초>      이 길이만큼만 사용 (예: 5)
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SITE_JSON = join(ROOT, 'src/config/site.json');
const DESKTOP_WIDTH = 1920;
const MOBILE_WIDTH = 828;

// ── 인자 읽기 ───────────────────────────────────────────────
function parseArgs(argv) {
  const positional = [];
  const opts = { fps: 'source', 'allow-cuts': null, max: 120, quality: 82, 'mobile-quality': null, 'mobile-src': null, 'mobile-aspect': '3:4', start: null, duration: null, 'focus-x': 0.5 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--allow-cuts') opts['allow-cuts'] = true;
    else if (argv[i].startsWith('--')) opts[argv[i].slice(2)] = argv[++i];
    else positional.push(argv[i]);
  }
  return { input: positional[0], sectionId: positional[1], opts };
}

function fail(message) {
  console.error(`\n오류: ${message}`);
  process.exit(1);
}

// ffmpeg가 있는지 먼저 확인한다 (없으면 설치 방법 안내)
function checkFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
  } catch {
    fail(`ffmpeg가 설치돼 있지 않습니다.
  Windows: winget install Gyan.FFmpeg   (설치 후 터미널을 다시 여세요)
  macOS:   brew install ffmpeg
  Ubuntu:  sudo apt install ffmpeg`);
  }
}

// 영상 길이(초)
function durationOf(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file,
  ]).toString();
  const seconds = Number.parseFloat(out);
  if (!Number.isFinite(seconds) || seconds <= 0) fail(`영상 길이를 읽을 수 없습니다: ${file}`);
  return seconds;
}

// 영상의 프레임레이트 (예: 59.94)
function sourceFps(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'default=nw=1:nk=1', file,
  ]).toString().trim();
  const [n, d = '1'] = out.split('/');
  const fps = Number(n) / Number(d);
  if (!Number.isFinite(fps) || fps <= 0) fail(`프레임레이트를 읽을 수 없습니다: ${file}`);
  return fps;
}

// 필터를 거친 뒤 나오는 프레임 수 (그림은 만들지 않고 세기만)
function countFrames(file, filter, trim) {
  const out = execFileSync('ffmpeg', [
    '-v', 'error', ...trim, '-i', file, '-an', '-vf', filter.replace(/,$/, ''), '-fps_mode', 'vfr', '-f', 'framecrc', '-',
  ], { maxBuffer: 64 * 1024 * 1024 }).toString();
  return out.split('\n').filter((l) => l && !l.startsWith('#')).length;
}

// 구간 안의 장면 전환(컷) 시각들. 한 섹션에 컷이 섞이면 스크롤 중 화면이 툭 바뀐다.
function sceneCuts(file, trim) {
  // scdet 결과는 stderr 로 나온다
  const { stderr } = spawnSync('ffmpeg', [
    '-hide_banner', '-nostats', ...trim, '-i', file, '-an',
    '-vf', 'scale=480:-2,scdet=threshold=8', '-f', 'null', '-',
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const log = stderr ?? '';
  return [...log.matchAll(/lavfi\.scd\.time:\s*([\d.]+)/g)].map((m) => Number(m[1]));
}

// 프레임 수를 정한다. 예전에는 max장을 넘으면 fps를 조용히 낮췄는데(8초 → 15fps, 75초 → 1.6fps),
// 그러면 장마다 움직임이 커져서 스크롤할 때 툭툭 끊긴다. 이제는 24fps 밑으로는 낮추지 않고 멈춘다.
const MIN_SCRUB_FPS = 24;
function chooseFps(requested, seconds, max) {
  const limit = max / seconds;
  if (requested <= limit) return requested;
  if (limit < MIN_SCRUB_FPS) {
    fail(`${seconds.toFixed(2)}초를 ${max}장 안에 넣으려면 ${limit.toFixed(1)}fps 가 되어 끊겨 보입니다.
  --duration 을 ${(max / Math.min(requested, 60)).toFixed(2)}초 이하로 줄이거나 (원본 fps 기준), --fps 를 ${MIN_SCRUB_FPS} 이상으로 직접 정하세요.`);
  }
  return Math.floor(limit * 1000) / 1000;
}

// 폴더를 비우고 다시 만든다 (이전에 더 많이 뽑았던 프레임이 남지 않게)
function freshDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

// 잘라 쓸 구간 (입력 앞에 -ss/-t 를 두면 그 구간만 읽어서 빠르다)
function trimArgs(start, duration) {
  return [...(start != null ? ['-ss', String(start)] : []), ...(duration != null ? ['-t', String(duration)] : [])];
}

function runFfmpeg(src, filter, outDir, quality, max, trim = []) {
  execFileSync('ffmpeg', [
    '-v', 'error', '-y',
    ...trim,
    '-i', src,
    '-vf', filter,
    '-fps_mode', 'vfr', // 중복 프레임을 뺀 그대로 저장 (다시 채워 넣지 않게)
    '-frames:v', String(max), // 반올림 오차로 한 장 더 나오는 것 방지
    '-c:v', 'libwebp', '-quality', String(quality), '-compression_level', '6',
    join(outDir, '%04d.webp'),
  ], { stdio: 'inherit' });
  return readdirSync(outDir).filter((f) => f.endsWith('.webp')).length;
}

function folderSize(dir) {
  return readdirSync(dir).reduce((sum, f) => sum + statSync(join(dir, f)).size, 0);
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)}MB`;

// site.json 의 섹션 프레임 수를 갱신한다
function updateSiteJson(sectionId, count) {
  const site = JSON.parse(readFileSync(SITE_JSON, 'utf8'));
  const section = site.sections.find((s) => s.id === sectionId);
  if (!section) {
    console.warn(`\n경고: site.json에 "${sectionId}" 섹션이 없어 프레임 수를 기록하지 못했습니다.`);
    return null;
  }
  if (section.type !== 'scrub') fail(`"${sectionId}"는 scrub 섹션이 아닙니다.`);
  section.frames.count = count;
  writeFileSync(SITE_JSON, `${JSON.stringify(site, null, 2)}\n`);
  return site;
}

// 모든 섹션의 프레임 용량 요약
function printTotals(site) {
  const base = join(ROOT, 'public', (site.frames?.basePath ?? '/frames').replace(/^\//, ''));
  let desktop = 0;
  let mobile = 0;
  console.log('\n섹션별 용량');
  for (const s of site.sections.filter((x) => x.type === 'scrub')) {
    const d = join(base, s.frames.folder, 'desktop');
    const m = join(base, s.frames.folder, 'mobile');
    const ds = existsSync(d) ? folderSize(d) : 0;
    const ms = existsSync(m) ? folderSize(m) : 0;
    desktop += ds;
    mobile += ms;
    console.log(`  ${s.id.padEnd(12)} ${String(s.frames.count).padStart(3)}장   PC ${mb(ds).padStart(8)}   모바일 ${mb(ms).padStart(8)}`);
  }
  console.log(`  ${'합계'.padEnd(11)}        PC ${mb(desktop).padStart(8)}   모바일 ${mb(mobile).padStart(8)}`);
}

// ── 실행 ────────────────────────────────────────────────────
const { input, sectionId, opts } = parseArgs(process.argv.slice(2));
if (!input || !sectionId) {
  fail('사용법: node scripts/extract-frames.mjs <영상 파일> <섹션id> [--fps 24]');
}
if (!/^[a-z][a-z0-9-]*$/.test(sectionId)) fail('섹션 id는 영문 소문자·숫자·하이픈만 쓸 수 있습니다.');
checkFfmpeg();

const src = resolve(input);
if (!existsSync(src)) fail(`영상 파일이 없습니다: ${input}`);
const mobileSrc = opts['mobile-src'] ? resolve(opts['mobile-src']) : null;
if (mobileSrc && !existsSync(mobileSrc)) fail(`모바일 영상 파일이 없습니다: ${opts['mobile-src']}`);

const max = Number(opts.max);
const quality = Number(opts.quality);
const mobileQuality = Number(opts['mobile-quality'] ?? opts.quality);
const start = opts.start != null ? Number(opts.start) : null;
const total = durationOf(src);
// 실제로 쓰는 길이 = 지정한 duration, 없으면 start 부터 끝까지
const seconds = opts.duration != null ? Number(opts.duration) : total - (start ?? 0);
if (seconds <= 0) fail('--start / --duration 구간이 영상 길이를 벗어났습니다.');
const trim = trimArgs(start, opts.duration != null ? seconds : null);
// 컷 검사를 먼저 한다 (장수 한도보다 이게 더 근본적인 문제라서)
const cuts = sceneCuts(src, trim);
if (cuts.length) {
  const at = cuts.map((t) => ((start ?? 0) + t).toFixed(2)).join(', ');
  if (!opts['allow-cuts']) {
    fail(`구간 안에 장면 전환(컷)이 있습니다: ${at}초.
  한 섹션에는 한 장면만 넣어야 스크롤할 때 툭 끊기지 않습니다. --start/--duration 으로 컷 사이 구간을 고르세요.
  (그래도 넣으려면 --allow-cuts)`);
  }
  console.warn(`경고: 구간 안에 장면 전환이 있습니다 (${at}초).`);
}

const nativeFps = sourceFps(src);
let timeFilter; // 시간 축 필터 (PC·모바일 공통)
if (opts.fps === 'source') {
  // 원본 프레임을 그대로 쓰되, 똑같은 장이 연달아 있으면 뺀다.
  // (30fps 영상을 60fps 로 저장한 경우 = 같은 그림이 두 번씩 → 스크롤하면 멈칫멈칫)
  // 잘라내기 전 원본 화면에서 판단하므로 PC·모바일이 같은 장을 고른다.
  timeFilter = 'mpdecimate,';
  const unique = countFrames(src, timeFilter, trim);
  if (unique > max) {
    fail(`이 구간에는 서로 다른 프레임이 ${unique}장 있어 한도 ${max}장을 넘습니다.
  원본 그대로가 가장 부드럽습니다. --duration 을 ${((seconds * max) / unique).toFixed(2)}초 이하로 줄이세요.
  (길이를 꼭 유지해야 하면 --fps 24 이상으로 솎아 낼 수 있지만 덜 부드럽습니다)`);
  }
  console.log(`원본 ${nativeFps.toFixed(2)}fps, 구간 ${seconds.toFixed(2)}초 → 서로 다른 프레임 ${unique}장`);
} else {
  const fps = chooseFps(Number(opts.fps), seconds, max);
  if (fps < Number(opts.fps)) {
    console.log(`영상이 ${seconds.toFixed(2)}초라 ${opts.fps}fps면 ${max}장을 넘어서 ${fps}fps로 낮춥니다.`);
  }
  timeFilter = `fps=${fps},mpdecimate,`; // 솎아 낸 뒤에도 같은 장이 이어지면 뺀다
}

const site = JSON.parse(readFileSync(SITE_JSON, 'utf8'));
const folder = site.sections.find((s) => s.id === sectionId)?.frames?.folder ?? sectionId;
const outBase = join(ROOT, 'public', (site.frames?.basePath ?? '/frames').replace(/^\//, ''), folder);
const desktopDir = join(outBase, 'desktop');
const mobileDir = join(outBase, 'mobile');

// PC: 가로 1920px. 높이는 비율대로(-2 = 짝수로 맞춤)
console.log(`\n[${sectionId}] PC 프레임 추출 (${DESKTOP_WIDTH}px)`);
freshDir(desktopDir);
const desktopCount = runFfmpeg(src, `${timeFilter}scale=${DESKTOP_WIDTH}:-2:flags=lanczos`, desktopDir, quality, max, trim);

// 모바일: 세로 화면을 꽉 채우므로, 가로 영상이면 가운데를 세로 비율로 잘라 해상도를 아낀다
console.log(`[${sectionId}] 모바일 프레임 추출 (${MOBILE_WIDTH}px)`);
freshDir(mobileDir);
const [aw, ah] = opts['mobile-aspect'].split(':').map(Number);
// 잘라낼 폭 cw = 높이 × 3/4. 잘라낼 위치는 focus-x 가 가운데 오도록 하되 화면 밖으로는 안 나가게.
const fx = Number(opts['focus-x']);
const cw = `min(iw,ih*${aw}/${ah})`;
const crop = mobileSrc ? '' : `crop='${cw}':'min(ih,iw*${ah}/${aw})':'max(0,min(iw-${cw},iw*${fx}-${cw}/2))':0,`;
// 모바일 영상을 따로 줬으면 그 영상의 길이에 맞춰 fps를 다시 정한다 (장수를 PC와 맞추기 위해)
const mobileFps = mobileSrc ? desktopCount / durationOf(mobileSrc) : null;
// 같은 원본에서 자를 때는 PC 와 똑같은 시간 필터를 써야 같은 장면 번호가 나온다
const mobileTime = mobileSrc ? `fps=${mobileFps},` : timeFilter;
const mobileCount = runFfmpeg(
  mobileSrc ?? src,
  `${mobileTime}${crop}scale=${MOBILE_WIDTH}:-2:flags=lanczos`,
  mobileDir,
  mobileQuality,
  desktopCount,
  mobileSrc ? [] : trim, // 모바일 영상을 따로 줬으면 그 영상 전체를 쓴다
);

if (mobileCount !== desktopCount) {
  console.warn(`경고: PC(${desktopCount}장)와 모바일(${mobileCount}장) 프레임 수가 다릅니다. 적은 쪽에 맞춥니다.`);
}
const count = Math.min(desktopCount, mobileCount);

const updated = updateSiteJson(sectionId, count);
console.log(`\n완료: ${count}장 → public/frames/${folder}/  (PC ${mb(folderSize(desktopDir))}, 모바일 ${mb(folderSize(mobileDir))})`);
if (updated) printTotals(updated);
