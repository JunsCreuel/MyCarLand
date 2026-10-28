// 설정 검사기: npm run check
// site.json·shots.json 이 스키마에 맞는지, 그리고 스키마만으로는 못 잡는 실수
// (섹션 id 중복, 없는 이미지 경로, 실내 장면 규칙 등)가 없는지 확인한다.
// 오류가 있으면 종료 코드 1 → npm run build 도 멈춘다. 경고는 알려만 준다.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

const ROOT = resolve(import.meta.dirname, '..');
const CONFIG_DIR = join(ROOT, 'src/config');
const PUBLIC_DIR = join(ROOT, 'public');

const errors = [];
const warnings = [];

function readJson(name) {
  try {
    return JSON.parse(readFileSync(join(CONFIG_DIR, name), 'utf8'));
  } catch (err) {
    errors.push(`${name}: JSON을 읽을 수 없습니다 — ${err.message}`);
    return null;
  }
}

// public 기준 경로("/images/a.webp")가 실제로 있는지
const publicFileExists = (p) => existsSync(join(PUBLIC_DIR, p.replace(/^\//, '')));

// 1) 스키마 검사 ------------------------------------------------------------
// discriminator: 섹션은 type 값을 보고 그 종류의 규칙으로만 검사한다
// (안 그러면 scrub 섹션 오류 하나에 picker·cta 기준 오류까지 줄줄이 나온다)
const ajv = new Ajv2020({ allErrors: true, strict: false, discriminator: true });

// ajv 오류를 한국어 한 줄로 바꾼다
function describe(e) {
  const p = e.params ?? {};
  switch (e.keyword) {
    case 'required': return `"${p.missingProperty}" 항목이 필요합니다`;
    case 'additionalProperties': return `"${p.additionalProperty}"는 쓸 수 없는 항목입니다 (오타인지 확인)`;
    case 'pattern': return `형식이 맞지 않습니다 (${p.pattern})`;
    case 'maximum': return `${p.limit} 이하여야 합니다`;
    case 'minimum': return `${p.limit} 이상이어야 합니다`;
    case 'exclusiveMaximum': return `${p.limit}보다 작아야 합니다`;
    case 'minLength': return '비어 있으면 안 됩니다';
    case 'minItems': return `${p.limit}개 이상 있어야 합니다`;
    case 'maxItems': return `${p.limit}개 이하여야 합니다`;
    case 'enum': return `다음 중 하나여야 합니다: ${p.allowedValues.join(', ')}`;
    case 'type': return `${p.type} 형식이어야 합니다`;
    case 'discriminator': return `type 값이 올바르지 않습니다 (scrub, picker, cta, steps 중 하나)`;
    default: return e.message;
  }
}

function validate(dataName, schemaName) {
  const data = readJson(dataName);
  const schema = readJson(schemaName);
  if (!data || !schema) return null;
  const check = ajv.compile(schema);
  if (!check(data)) {
    for (const e of check.errors) {
      if (e.keyword === 'oneOf') continue; // 아래쪽의 구체적인 오류가 이미 따로 나온다
      errors.push(`${dataName}${e.instancePath || ''}: ${describe(e)}`);
    }
  }
  return data;
}

const site = validate('site.json', 'site.schema.json');
const shots = validate('shots.json', 'shots.schema.json');

// 2) site.json 추가 검사 ---------------------------------------------------
// 스키마 오류가 있어도 가능한 데까지 검사한다. 모양이 너무 깨져 있으면 건너뛴다.
function safely(label, fn) {
  try {
    fn();
  } catch {
    warnings.push(`${label}: 형식 오류 때문에 추가 검사를 건너뛰었습니다.`);
  }
}

if (site) safely('site.json', () => {
  const basePath = site.frames?.basePath ?? '/frames';
  const digits = site.frames?.digits ?? 4;
  const seen = new Set();

  for (const s of site.sections) {
    const where = `site.json 섹션 "${s.id}"`;
    if (seen.has(s.id)) errors.push(`${where}: id가 중복됩니다.`);
    seen.add(s.id);

    const { headline, accentWord } = s.copy;
    if (accentWord && !headline.includes(accentWord)) {
      errors.push(`${where}: accentWord "${accentWord}"가 헤드라인 안에 없습니다.`);
    }

    if (s.type === 'scrub') {
      if (s.playback !== 'auto' && !s.scrollLength) {
        errors.push(`${where}: 스크롤로 재생하는 장면은 scrollLength 가 필요합니다 (자동 재생이면 "playback": "auto").`);
      }
      if (s.playback === 'auto' && s.onEnd === 'next' && s === site.sections.at(-1)) {
        warnings.push(`${where}: 마지막 섹션이라 onEnd "next" 로 넘어갈 화면이 없습니다.`);
      }
      const [from, to] = s.copyRange ?? [0.15, 0.75];
      if (from >= to) errors.push(`${where}: copyRange 시작(${from})이 끝(${to})보다 작아야 합니다.`);

      const { folder, count, ext = 'webp', posterFrame } = s.frames;
      if (count === 0) {
        warnings.push(`${where}: 프레임이 아직 없습니다 (extract-frames 스크립트로 만들어 주세요).`);
      } else {
        if (posterFrame && posterFrame > count) errors.push(`${where}: posterFrame(${posterFrame})이 프레임 수(${count})보다 큽니다.`);
        // 각 세트의 첫 장과 마지막 장만 확인해도 빠진 폴더·잘못된 개수는 거의 잡힌다
        for (const set of ['desktop', 'mobile']) {
          for (const n of [1, count]) {
            const file = `${basePath}/${folder}/${set}/${String(n).padStart(digits, '0')}.${ext}`;
            if (!publicFileExists(file)) errors.push(`${where}: 프레임 파일이 없습니다 — public${file}`);
          }
        }
      }
    }

    if (s.type === 'picker') {
      const ids = s.options.map((o) => o.id);
      if (new Set(ids).size !== ids.length) errors.push(`${where}: 옵션 id가 중복됩니다.`);
      if (s.defaultOption && !ids.includes(s.defaultOption)) {
        errors.push(`${where}: defaultOption "${s.defaultOption}"이 옵션 목록에 없습니다.`);
      }
      const missing = s.options.flatMap((o) => [o.image.desktop, o.image.mobile]).filter((p) => !publicFileExists(p));
      if (missing.length) warnings.push(`${where}: 이미지 ${missing.length}개가 아직 없습니다 (예: public${missing[0]}).`);
    }
  }

  // 가이드 페이지를 끈 사이트에서 "guide" 버튼을 쓰면 404 로 가는 링크가 생긴다
  if (site.pages?.guide === false) {
    for (const s of site.sections.filter((x) => x.type === 'steps')) {
      if (s.actions?.some((a) => a.href === 'guide')) {
        errors.push(`site.json 섹션 "${s.id}": pages.guide 가 false 인데 버튼 href 에 "guide"를 썼습니다.`);
      }
    }
  }

  if (site.contact.kakaoOpenChat.includes('DEMO')) {
    warnings.push('site.json contact.kakaoOpenChat: 데모 링크입니다. 고객의 오픈채팅 주소로 바꿔 주세요.');
  }
  // 무료(CC) 영상은 출처 표기가 라이선스 조건이다. 고객이 직접 찍은 영상이면 무시해도 된다
  if (!site.credits?.length) {
    warnings.push('site.json credits: 영상 출처 표기가 없습니다. 무료·CC 영상을 썼다면 작가·라이선스를 꼭 적어 주세요.');
  }
  if (site.meta.ogImage && !publicFileExists(site.meta.ogImage)) {
    warnings.push(`site.json meta.ogImage: 파일이 없습니다 — public${site.meta.ogImage}`);
  }
});

// 3) shots.json 추가 검사 --------------------------------------------------
if (shots) safely('shots.json', () => {
  const ids = shots.shots.map((s) => s.id);
  if (new Set(ids).size !== ids.length) errors.push('shots.json: 컷 id가 중복됩니다.');
  ids.forEach((id, i) => {
    if (id !== i + 1) errors.push(`shots.json: 컷 번호는 1부터 빠짐없이 이어져야 합니다 (${i + 1}번 자리에 ${id}).`);
  });

  const groupIds = new Set(shots.groups.map((g) => g.id));
  const scenes = new Map(shots.scenes.map((s) => [s.id, s]));
  for (const shot of shots.shots) {
    if (!groupIds.has(shot.group)) errors.push(`shots.json ${shot.id}번: groups에 없는 묶음 "${shot.group}"입니다.`);
    for (const use of shot.usedFor) {
      if (!scenes.has(use.scene)) errors.push(`shots.json ${shot.id}번: scenes에 없는 장면 "${use.scene}"입니다.`);
    }
  }

  // 실내 규칙: interpolate 장면은 실제 실내 사진 두 장(start 1장 + end 1장)만으로 만든다
  for (const scene of shots.scenes.filter((s) => s.method === 'interpolate')) {
    const uses = shots.shots.flatMap((shot) =>
      shot.usedFor.filter((u) => u.scene === scene.id).map((u) => ({ shot, role: u.role })),
    );
    const roles = uses.map((u) => u.role).sort().join(',');
    if (roles !== 'end,start') {
      errors.push(`shots.json 장면 "${scene.id}": 시작(start) 사진 1장과 끝(end) 사진 1장이 정확히 있어야 합니다 (지금: ${roles || '없음'}).`);
    }
    if (uses.some((u) => u.shot.group !== 'interior')) {
      errors.push(`shots.json 장면 "${scene.id}": 실내 장면에는 실내 사진만 쓸 수 있습니다.`);
    }
  }

  const required = shots.shots.filter((s) => s.required).length;
  const samples = shots.shots.filter((s) => publicFileExists(s.samplePhoto)).length;
  // 가이드 페이지를 끈 사이트(딜러 등)에서는 예시 사진이 없어도 상관없다
  if (samples < shots.shots.length && site?.pages?.guide !== false) {
    warnings.push(`shots.json: 예시 사진 ${shots.shots.length - samples}장이 아직 없습니다 (가이드에는 자리표시자가 보입니다).`);
  }
  console.log(`촬영 컷 ${shots.shots.length}개 (필수 ${required}개)`);
});

// 결과 출력 ----------------------------------------------------------------
if (site) console.log(`섹션 ${site.sections.length}개: ${site.sections.map((s) => `${s.id}(${s.type})`).join(' → ')}`);
for (const w of warnings) console.log(`  경고  ${w}`);
for (const e of errors) console.log(`  오류  ${e}`);

if (errors.length) {
  console.log(`\n오류 ${errors.length}개 — 고친 뒤 다시 실행해 주세요.`);
  process.exit(1);
}
console.log(`\n설정 검사 통과${warnings.length ? ` (경고 ${warnings.length}개)` : ''}.`);
