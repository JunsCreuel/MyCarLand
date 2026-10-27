# 설정 가이드 — 새 고객 사이트 만들기

고객 한 명당 바꾸는 것은 **두 가지뿐**이에요.

1. `src/config/site.json` — 문구, 색, 연락처, 섹션 순서
2. `public/frames/`, `public/images/` — 그 고객의 프레임과 이미지

`shots.json`은 촬영 가이드용 공통 파일이라 고객마다 바꾸지 않아요.

## 새 고객 순서

1. `src/config/site.json`을 복사해 두고(이전 고객 백업) 내용을 고칩니다.
2. AI 영상을 `raw/<고객>/`에 넣고 섹션마다 프레임을 뽑습니다 (Phase 2 스크립트, 프레임 수가 `site.json`에 자동 기록됨).
3. 컬러 피커 이미지를 `public/images/`에 넣고 경로를 `site.json`에 적습니다.
4. `npm run check` → 오류 0개 확인 → `npm run dev`로 화면 확인.

VS Code에서 `site.json`을 열면 각 항목에 마우스를 올렸을 때 설명이 나오고, 잘못 쓰면 빨간 줄이 생겨요(`site.schema.json` 덕분).

## site.json

| 위치 | 바꾸는 것 | 예 |
|---|---|---|
| `profile` | 사이트 종류 | `owner` 개인 차주 · `shop` 튜닝·랩핑샵 · `dealer` 중고차 딜러 |
| `meta.title`, `meta.description` | 브라우저 탭 제목, 링크 공유 설명 | |
| `meta.ogImage` | 카카오톡·인스타에 링크 공유할 때 썸네일 | `/images/og.webp` (1200×630) |
| `brand.logoText` | 상단 로고 글자 | `JUN'S GARAGE` |
| `brand.accentColor` | 포인트 컬러 **한 가지** | `#D7FF3A` |
| `brand.backgroundColor`, `textColor` | 배경·글자색 (어두운 배경 권장) | `#0A0A0B` |
| `brand.fonts` | 헤드라인 / 본문 글꼴 이름과 CSS 주소 | Anton / Pretendard |
| `car` | 차량 정보 (선택) | |
| `contact.kakaoOpenChat` | 카카오톡 오픈채팅 링크 (**가장 큰 버튼**) | `https://open.kakao.com/o/...` |
| `contact.phone`, `instagram` | 보조 연락처. 비워 두면 버튼이 안 나옴 | `010-1234-5678`, `juns.garage` |
| `sections` | 섹션 목록 (위에서부터 화면 순서) | 아래 참고 |

### 섹션 공통

- `id`: 영문 소문자·숫자·하이픈. 주소 `#id`와 프레임 폴더 이름에 쓰여요.
- `copy.headline`: 굵은 대문자 헤드라인. 줄바꿈은 `\n`. 짧을수록 좋아요 (예: `"AFTER\nDARK."`).
- `copy.accentWord`: 헤드라인 중 포인트 컬러로 칠할 부분. 헤드라인 안에 똑같이 있어야 해요.
- `copy.eyebrow`: 헤드라인 위 작은 글 (예: `02 — NIGHT RUN`), `copy.subcopy`: 한국어 설명 한두 줄.
- `copy.position`: 글 위치 `left` / `right` / `center` / `bottom-left`.

### `type: "scrub"` — 스크롤하면 프레임이 재생되는 장면

- `scrollLength`: 이 장면을 다 보는 데 드는 스크롤 길이 (`300` = 화면 3개만큼). 길수록 천천히 재생돼요.
- `frames.folder`: `public/frames/<folder>/desktop|mobile/0001.webp ...`
- `frames.count`: 프레임 수. **직접 쓰지 말고 프레임 추출 스크립트가 채우게 두세요.** 최대 120.
- `frames.posterFrame`: "움직임 줄이기" 설정 사용자에게 보여줄 한 장 (비우면 가운데 프레임).
- `copyRange`: 글이 보이는 구간 `[시작, 끝]` (장면 진행률 0~1).

### `type: "picker"` — 버튼으로 색·휠 바꾸기

- `options`: 2~6개. 각각 `id`, 버튼 글자 `label`, 견본 색 `swatch`, 이미지 `image.desktop` / `image.mobile`.
- 모든 옵션 이미지는 **같은 구도·같은 크기**여야 크로스페이드가 자연스러워요.
- `defaultOption`: 처음 선택된 옵션 id.

### `type: "cta"` — 문의

- 연락처는 맨 위 `contact` 값을 씁니다. `kakaoLabel`로 버튼 글자만 바꿀 수 있어요.

## shots.json (공통, 보통 안 바꿈)

촬영 가이드 페이지와 AI 생성 스크립트가 함께 읽어요.

- `groups`: 외관 → 실내 → 디테일 순서와 묶음 설명.
- `shots[]`: 컷 번호 `id`(고객 사진 파일 이름 `01.jpg`~`17.jpg`와 같음), `title`, `howTo`(고객이 읽는 문장), `required`, `samplePhoto`(`public/guide/shot-01.webp`에 사진을 넣으면 가이드의 자리표시자가 바로 바뀜).
- `cameraPosition`: 가이드 도식에 위치를 그리는 정보. `orbit`의 `angleDeg`는 차 앞을 0도로 **위에서 볼 때 시계 반대 방향** (90 = 운전석 옆, 180 = 뒤, 270 = 조수석 옆).
- `scenes`, `usedFor`: **내부용.** 어떤 사진이 어떤 AI 장면에 쓰이는지. 가이드 화면에는 안 보여요.
  - `method: "interpolate"` 장면(실내)은 실제 실내 사진 두 장(`start` 1장 + `end` 1장)만 쓸 수 있고, `npm run check`가 이 규칙을 검사해요.

| 장면(scene) | 쓰는 컷 | 연결되는 데모 섹션 |
|---|---|---|
| `hero` | 1, 2, 8 | hero |
| `drive` | 3, 7 | night |
| `rear-detail` | 4, 5, 6 | (추가 scrub 섹션용) |
| `interior-front` | 9 → 10 | (추가 scrub 섹션용) |
| `interior-rear` | 11 → 12 | (추가 scrub 섹션용) |
| `closeup` | 13~17 | detail |
| `picker` | 13~17 | finish |

## 명령어

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 (소개 사이트 `/`, 촬영 가이드 `/guide.html`) |
| `npm run check` | 설정 검사 (오류가 있으면 이유를 한국어로 알려줌) |
| `npm run build` | 검사 후 배포용 파일을 `dist/`에 생성 |
