# 재생 엔진 구조

템플릿의 `src/core`, `src/sections`가 실제 구현이다. 고치기 전에 해당 파일을 읽고, 아래의 "왜"를 지킨다.

## 1. 프레임 로더 — `src/core/frames.js`

- `FrameSequence({ basePath, folder, count, ext, digits, set })` → `images[]`(받은 것만), `nearest(i)`, `loadFirst(i)`, `loadAll()`, `ready`(전부 settle 되면 풀리는 Promise).
- 순서: 첫 장 → (섹션이 한 화면 앞으로 오면) 1, 9, 17…처럼 8칸 간격 → 4칸 → 2칸 → 전부. 동시 6개.
  빨리 스크롤해도 근처 프레임이 이미 있어서 빈 화면이 안 생긴다.
- `img.decode()`를 기다린 뒤 저장 → 그릴 때 디코딩으로 멈칫하지 않는다. 실패한 장은 경고만 남기고 넘어간다.
- 폭 768px 미만이면 mobile 세트 (`device.js`의 `mobileQuery`). 회전 등으로 기준을 넘나들면 세트를 다시 만든다.

## 2. 캔버스 렌더러 — `src/core/renderer.js`

- `request(base, next, mix)` → rAF 에서 한 번만 그린다. 같은 그림(src+mix 1/16 단위)이면 다시 안 그린다.
- object-fit: cover 계산 후 `drawImage`. `next`가 있으면 `globalAlpha = mix`로 한 장 더 겹친다 (프레임 사이 크로스페이드).
- devicePixelRatio 최대 2. ResizeObserver 로 리사이즈·회전 처리, 크기가 바뀌면 마지막 그림을 다시 그린다.
- `alpha: false` 컨텍스트 → 합성 비용 감소.
- 그릴 때마다 `imageSmoothingQuality = 'high'` — 기본값 'low'는 축소·확대 때 잔디·차선이 자글자글하다.
  캔버스 크기가 바뀌면 설정이 초기화되므로 매 draw 에서 지정한다.

## 3. 장면 섹션 — `src/sections/scrub.js`

공통: `<section class="scene scene--scrub">` 안에 `.scene__sticky`(canvas + 가독성용 그림자 + 글 + 사양 패널).
글 위치(`copy.position`)에 맞춰 그림자 방향도 바뀐다. 모바일은 글을 항상 아래에 모은다.

| playback | 동작 | 섹션 높이 |
|---|---|---|
| `scroll` + `scroll.mode: "snap"` (**기본**) | 섹션은 한 화면(100svh)에 고정. 섹션 요소에 `el.scrubber = { canAdvance(dir), advance(px) }`를 달아 두면 snap.js 가 휠·스와이프·키보드 입력을 먼저 영상 재생에 쓴다. `scrollLength`(화면 높이 %) 만큼 굴리면 영상 끝. 입력은 목표 위치만 옮기고 화면은 rAF 로 부드럽게 따라감(시간 상수 160ms — 90ms 였을 때 휠 칸마다 섰다 가서 끊겨 보였다), 멈추면 가까운 한 장으로 settle. 첫 장면엔 SCROLL 표시 | 100svh |
| `scroll` + `free` | ScrollTrigger progress × (count-1) = 위치(소수). `show(pos)`가 앞뒤 두 장을 섞어 그림. 스크롤이 120ms 멈추면 160ms 동안 가장 가까운 한 장으로 맞춤(settle). 글은 `copyRange` 구간에서만 보임 | `scrollLength` vh |
| `auto` | IntersectionObserver(threshold 0.6)로 들어오면 `frames.ready`를 기다린 뒤 rAF 로 `pos = 경과초 × fps` 재생. 끝나면 `onEnd`: hold/next/loop. 벗어나면 정지 | 100svh |

- `playToken`: 재생을 다시 시작/정지할 때 번호를 올려서, 기다리던 이전 재생이 스스로 그만두게 한다 (await 사이의 경쟁 방지).
- 첫 섹션: `pageReady`(load + idle)를 기다린 뒤 나머지를 받는다. 첫 화면 용량 예산을 지키는 핵심.
- 동작 줄이기: 대표 프레임(`posterFrame`, 기본 가운데) 한 장만, 글은 바로 보임.

## 4. 스크롤 — `src/core/scroll.js`, `src/core/snap.js`

- `site.scroll.mode`: `free` → Lenis(duration 1.1) + `lenis.on('scroll', ScrollTrigger.update)` + `gsap.ticker`로 Lenis 구동, `lagSmoothing(0)`.
  `snap` → `setupSnap(sectionEls)`.
- snap 휠: 직접 `wheel` 리스너(passive:false). 신호 간격 300ms 이하를 **한 동작**으로 묶는다 (간격은 `e.timeStamp`로 — 처리 시각으로 재면
  프레임 디코딩으로 메인 스레드가 바쁠 때 한 동작이 쪼개진다).
  - 지금 섹션의 `scrubber.canAdvance(dir)`이면 `advance(deltaY)` → 영상 재생
  - `advance(px)`는 영상 끝을 넘어 남은 px 를 돌려준다. 남은 양이 쌓여 120px(OVERSCROLL)을 넘으면 그대로 `step(dir)` —
    계속 굴리면 영상 끝 → 다음 화면으로 자연스럽게 이어진다. 동작 시작 때 이미 끝이었으면 12px 에서 바로 넘어간다.
  - ⚠ 처음엔 "끝에 닿은 동작은 무시, 손 떼고 다시 굴려야 넘어감"으로 짰다가 "스크롤이 먹통이다가 갑자기 넘어간다"는 피드백을 받았다.
  - 이동 중·도착 후 450ms 안에 시작된 동작은 끝날 때까지 통째로 무시 (트랙패드 관성)
- snap 터치에서 영상 장면은 첫 움직임 방향으로 모드를 정한다: 재생할 게 남았으면 'scrub'(손가락 이동 × 2 만큼 재생,
  영상 끝을 넘어 더 민 만큼 다음 화면이 따라 보이고 60px 넘게 밀었으면 넘김, 아니면 놓을 때 튕긴 속도 × 0.1 × 2 만큼 관성 재생), 아니면 'page'(아래 따라오기·넘김).
- 키보드: 영상 장면이면 화면 높이의 절반씩 재생, 끝이면 다음 화면.
- snap 터치는 **따로** Observer(type `touch`, preventDefault, dragMinimum 3)로 처리한다. 휠과 같은 tolerance 로 묶으면
  12px 만 스쳐도 한 화면이 넘어가 모바일에서 "살짝 건드렸는데 밀린다"는 피드백을 받았다.
  - 끄는 동안 화면이 손가락을 `FOLLOW 0.4` 비율로 따라온다 (손에 붙어 있는 느낌)
  - 손을 뗄 때 `SWIPE_MIN 60px` 이상 밀었거나 `FLICK_SPEED 300px/s` 이상으로 튕겼으면 `step(dir, 끌기 시작 위치)`,
    아니면 끌기 시작 위치로 되돌린다. 2px 미만은 탭으로 보고 아무것도 안 한다.
  - 튕긴 속도는 손가락 위치를 직접 기록해 **마지막 100ms** 로 계산한다. Observer 의 `velocityY`는 손을 떼는 순간 0 에 가까워 못 쓴다.
  - `step()`은 지금 위치가 아니라 끌기 시작 위치 기준으로 다음/이전을 고른다 (끄는 중엔 이미 조금 움직였으므로).
  - CSS `html.is-snap { overscroll-behavior:none; touch-action:pinch-zoom }` — 브라우저 고무줄·당겨서 새로고침을 끄되 확대는 남긴다.
  `gsap.to(window, {scrollTo})` 0.85s power3.inOut. 이동 중·도착 후 450ms 는 입력 무시.
  키보드 PageUp/Down/화살표/Space 지원 (입력창 포커스 중엔 무시). 리사이즈 시 현재 섹션 맨 위로 재정렬.
- 컨트롤러 API: `goToSection(el)`(내부 #링크도 이걸로), `nextFrom(el)`(자동 재생 끝 → 다음 화면; 지금 보고 있는 섹션일 때만).
- `main.js`: 섹션을 모두 DOM 에 붙인 뒤 `setupScroll(site, els)` → 각 섹션 `init(controller)`. 글꼴 로드 후 `ScrollTrigger.refresh()`.

## 5. 기타 섹션

- `site.json`의 `pages.guide: false` → 촬영 가이드(guide.html)를 빌드에서 뺀다 (딜러·매장 소개 사이트).
  check-config 가 steps 버튼에 남은 `guide` 링크를 오류로 잡는다.
- `steps.js`: 왼쪽 큰 헤드라인 + 오른쪽 큰 번호·가는 구분선 목록 (카드 3개 나열 금지). actions 의 href `guide`/`kakao` 토큰.
- `picker.js`: 옵션마다 `<picture>`를 겹쳐 두고 선택된 것만 opacity 1 (350ms). 기본 옵션만 eager, 나머지는 섹션이 가까워지면.
  버튼은 `aria-pressed`. 모든 옵션 이미지는 같은 구도여야 자연스럽다.
- `cta.js`: 카카오 버튼이 가장 크게(64px), 전화·인스타는 보조 링크(44px).
- `nav.js`: 로고 + 노란 알약 문의 버튼 + 상단 2px 진행 막대(scaleX). 문의 섹션이 보이면 상단 버튼 숨김.

## 6. 빌드 — `vite.config.js`

- `base`는 `BASE_PATH` 환경변수 (GitHub Pages 하위 경로). 코드에서 public 경로는 항상 `asset()`으로 감싼다.
- `siteHead()` 플러그인: site.json 으로 `<title>`, description, OG, theme-color, 글꼴 CSS, 첫 프레임 preload(PC/모바일을 media 로 구분)를 HTML 에 직접 넣는다 (카톡·검색엔진은 JS 를 실행하지 않음).
- `publicShots()` 플러그인: `shots.json?public` 임포트 시 `usedFor`·`scenes` 제거.

## 새 섹션 타입을 추가할 때

1. `src/sections/<type>.js`에 `create<Type>(section, site, ctx) → { el, init(controller) }`
2. `main.js`의 `BUILDERS`에 등록
3. `site.schema.json`에 `$defs/<type>Section` + `sections.items.oneOf`에 추가 (discriminator 가 type 으로 분기)
4. 필요하면 `check-config.mjs`에 스키마로 못 잡는 검사 추가, `CONFIG_GUIDE.md`에 설명 추가
