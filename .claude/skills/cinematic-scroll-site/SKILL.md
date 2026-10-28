---
name: cinematic-scroll-site
description: >-
  애플 제품 페이지처럼 스크롤하면 영상이 재생되거나, 한 화면씩 넘기며 장면이 스스로 재생되는
  시네마틱·인터랙티브 원페이지 웹사이트(차량·제품·매장 소개, 판매용 템플릿)를 만드는 스킬.
  영상 → WebP 이미지 시퀀스 → canvas 재생 엔진, 설정 파일 하나로 고객별 사이트를 찍어내는 구조,
  영상 구간 고르기·프레임 추출, 컬러 피커, 촬영 가이드 페이지, 용량·끊김 QA, GitHub Pages/Cloudflare 배포,
  AI 영상(시작·끝 프레임) 생성 연동까지 다룬다.
  "스크롤하면 차가 움직이는 사이트", "애플 같은 스크롤 효과", "시네마틱 랜딩페이지", "인터랙티브 웹사이트",
  "영상이 스크롤에 맞춰 재생", "풀스크린 장면 + 굵은 헤드라인", "프레임 시퀀스", "한 화면씩 넘어가는 사이트",
  "자동차/제품 쇼케이스 사이트", "고객마다 바꿔 쓰는 사이트 템플릿" 같은 요청이면 사용자가 스킬을 언급하지
  않아도 반드시 이 스킬을 먼저 읽는다. 기존 사이트가 "끊긴다", "화질이 별로다"라는 피드백에도 사용한다.
---

# Cinematic Scroll Site

어두운 풀스크린 장면 위에 굵은 대문자 헤드라인 하나와 포인트 컬러 한 가지. 스크롤(또는 한 화면 넘김)에 맞춰
차·제품이 움직이고, 색을 고르면 크로스페이드로 바뀌고, 마지막에 카카오톡 문의로 끝나는 원페이지를 만든다.

이 스킬은 실제로 한 번 끝까지 만든 프로젝트(MyCarLand)를 그대로 정리한 것이다. 바로 쓸 수 있는 템플릿이
`assets/template/`에 있으니 **처음부터 새로 짜지 말고 템플릿을 복사해서 시작한다.** 템플릿을 새로 짜면
이미 해결한 함정(아래 "꼭 기억할 것")을 다시 밟게 된다.

## 결과물의 구조

```
index.html  guide.html            ← 소개 사이트 / 고객용 촬영 가이드 (Vite 멀티 페이지)
src/config/site.json              ← 고객별로 바꾸는 유일한 파일 (문구·색·연락처·섹션 순서·재생 방식)
src/config/shots.json             ← 촬영 컷 목록 (가이드와 AI 생성이 함께 씀)
public/frames/<섹션>/desktop|mobile/0001.webp …   ← 장면 프레임
src/core/   frames.js(로더) renderer.js(캔버스) scroll.js·snap.js(스크롤) device.js asset.js
src/sections/ scrub.js(장면) steps.js(제작 과정) picker.js(색 선택) cta.js(문의) nav.js copy.js
scripts/    extract-frames.mjs make-picker-images.mjs check-config.mjs qa-site.py qa-guide.py deploy-gh-pages.mjs
```

"고객 한 명 = site.json 하나 + 프레임 폴더 하나"가 이 구조의 핵심 가치다. 기능을 추가할 때도 하드코딩하지 말고
site.json 설정과 스키마(`site.schema.json`)에 항목을 추가해서 다른 고객 사이트에서도 켜고 끌 수 있게 한다.

## 작업 순서

각 단계 끝에서 사용자가 확인할 방법(실행 명령, 볼 화면)을 알려 준다. 사용자가 "묻지 말고 진행"이라고 했으면 이어서 진행한다.

1. **시작 전에 정할 것** — 사용자에게 짧게 확인하거나 대화에서 찾는다.
   - 소재: 영상이 있나? 없으면 무료 실사 영상(라이선스 확인·출처 표기) → 나중에 AI 생성으로 교체
   - 재생 방식: `playback: "auto"`(한 화면씩 넘기고 장면이 스스로 재생) vs `"scroll"`(스크롤 양만큼 재생).
     소재가 빠르게 움직이는 영상이면 auto + snap 이 훨씬 덜 끊겨 보인다 (이번 프로젝트의 최종 선택).
   - 배포 위치(GitHub Pages 하위 경로인지), 포인트 컬러, 문의 수단(카카오 오픈채팅·전화·인스타)
2. **템플릿 복사·설치** — `assets/template/`를 프로젝트 폴더로 복사 → `npm install` → `npm run check`.
   git 을 쓰면 기능 단위로 커밋하고, 사용자가 브랜치 규칙을 정했으면 따른다.
3. **소재 준비** → `references/asset-pipeline.md`
   - `python scripts/inspect_footage.py <영상> --duration 2.5` (이 스킬의 scripts/)로 컷 없는 가장 잔잔한 구간을 고른다
   - `node scripts/extract-frames.mjs <영상> <섹션id> --start S --duration 2 --focus-x X` (템플릿의 scripts/, 원본 fps 그대로·컷 검사)
   - 컬러 피커 이미지: AI 색 변경 이미지 또는 `make-picker-images.mjs`
4. **site.json 작성** — 섹션 순서·카피·재생 방식. `npm run check`가 오류 0개일 때까지.
   카피·레이아웃 원칙은 `references/design-direction.md`.
5. **엔진을 고치거나 새 섹션 타입을 만들 때** → `references/engine.md`를 먼저 읽는다.
6. **촬영 가이드**(고객이 사진을 찍어 보내는 서비스일 때) → `references/shooting-guide.md`.
   딜러·매장 소개처럼 필요 없으면 `site.json`에 `"pages": {"guide": false}`, 컬러 피커처럼 맞지 않는 섹션은 뺀다.
   snap 모드면 모든 섹션이 1440×900·1280×720·360×740 한 화면 안에 들어오는지 본다 (넘으면 휠을 한 번 더 굴려야 한다).
   무료·CC 영상이면 `credits` 필수 (check-config 가 비어 있으면 경고).
7. **QA** → `references/qa-and-deploy.md`. `qa-site.py`·`qa-guide.py`를 돌리고 스크린샷을 직접 본다.
   snap 모드면 이 스킬의 `scripts/touch_check.py <주소>`로 모바일 터치 6가지도 확인한다.
8. **배포** → 같은 문서. 커밋된 상태를 별도 worktree 에서 빌드해 올린다.
9. **AI 장면 생성**(사용자가 요청할 때만, 비용 발생) → `references/ai-generation.md`.
   모델 ID·요금은 반드시 그때의 공식 문서로 확인한다. 이 문서의 표는 2026-10-27 기준 스냅샷일 뿐이다.

## 꼭 기억할 것 (실제로 밟았던 함정)

- **끊김의 원인은 대부분 소재다.** 빠른 드론 영상 4.5초를 24fps 로 뽑았더니 프레임 사이 변화가 커서 툭툭 끊겼다.
  잔잔한 2~2.5초를 원본 fps 그대로(60fps) 뽑고, 렌더러가 이웃 두 장을 비율대로 겹쳐 그리게 해서
  프레임 간 변화가 40~60% 줄었다. 구간 안의 **컷**도 큰 원인이다(extract-frames 가 이제 컷을 발견하면 멈춘다).
  그래도 끊기면 scroll 재생 대신 auto 재생 + snap 으로 바꾼다.
- **겹쳐 그리기는 멈춘 화면에서 고스팅을 만든다.** scroll 재생에서 스크롤을 멈추면 두 장이 반투명하게 겹친 채
  남아 "화질이 별로"로 보였다 → 멈추면 가장 가까운 한 장으로 맞춘다(settle). 캔버스는 `imageSmoothingQuality='high'`.
- **`<video>` 로 만들면 첫 화면이 무겁다.** 같은 요청을 스킬 없이 만든 비교 시험에서 `<video>` 방식은 모바일 첫 화면이
  3.2MB 였다(프레임 방식 0.5MB). 장면을 "스크롤로 움직이는" 요구가 없어도 첫 화면 예산 때문에 프레임 방식을 쓴다.
- **첫 화면 용량**: 첫 장면 프레임 120장을 페이지 열자마자 받으면 첫 화면이 4.5MB 가 된다. 첫 프레임만 preload 하고
  나머지는 `load` 이벤트 + idle 이후에 받는다. 자동 재생도 마찬가지 — 첫 장면은 처음부터 화면 안이라
  IntersectionObserver 가 즉시 "보임"을 알리므로 재생 시작 전에 페이지 로드를 기다려야 한다.
- **자동 재생은 프레임을 전부 받은 뒤 시작** (`frames.ready`). 받으면서 재생하면 중간에 멈칫한다.
- **snap 스크롤**: GSAP Observer(`wheelSpeed: -1`, `preventDefault: true`) + ScrollToPlugin. 도착 후 ~450ms 입력 무시
  (트랙패드 관성 때문에 두세 화면을 건너뛴다). 화면보다 긴 섹션은 한 화면씩 내려가서 끝까지 본 뒤 넘긴다.
  모바일에서 섹션이 100svh 를 넘지 않게 여백을 줄이는 게 체감상 제일 좋다.
- **터치는 휠과 따로 다룬다.** 처음엔 휠·터치를 한 Observer(tolerance 12px)로 묶었더니 폰에서 살짝 스치기만 해도
  한 화면이 넘어가 "밀린다"는 말을 들었다. 끄는 동안 화면이 손가락을 따라오고, 60px 이상 밀거나 튕겼을 때만 넘기고,
  아니면 제자리로 돌린다 (`snap.js`). 터치 시험은 CDP 말고 페이지 안 TouchEvent 로 (qa-and-deploy.md).
- **`[hidden]`은 `display:flex` 같은 CSS 에 진다.** 숨긴 버튼 줄이 같이 보였다 → `[hidden]{display:none!important}`.
- **GitHub Pages 경로는 대소문자를 가린다.** `/MyCarLand/` ≠ `/mycarland/`. git remote 가 소문자로 바뀌어 있어
  자산이 전부 404 났다 → package.json 의 `pagesBase`로 고정하고, 배포 후 실제 주소에서 자산 하나를 curl 로 확인한다.
- **내부용 정보는 공개 번들에서 뺀다.** shots.json 의 `usedFor`(AI 생성용 매핑)는 Vite 플러그인으로 `?public` 변형에서 제거한다.
- **ffmpeg `drawbox`는 시간(t)에 따라 위치를 다시 계산하지 않는다** → 움직이는 도형은 `overlay`로.
- **무료 영상 소스**: 이 환경에서는 Pexels/Pixabay 가 403, 위키미디어 원본은 429 로 막히기 쉽다. 위키미디어 API 검색 +
  1080p 변환본(transcoded) 다운로드는 재시도하면 받아졌다. CC BY 는 출처 표기(`site.json`의 `credits`)가 필수다.
- **검증할 때 측정 방식부터 의심한다.** "첫 화면 용량"을 load+1초로 쟀다가 미리 받기까지 포함돼 3MB 로 잘못 나왔다.
- 터치 영역 44px 이상, 본문 16px, `prefers-reduced-motion`이면 장면당 한 장 + 애니메이션 없이 이동.

## 사용자와 소통

사용자가 HTML/CSS/JS 를 공부 중일 수 있다. 코드 주석은 한국어로 짧게, "왜 이렇게 했는지"를 적는다.
완료 보고는 무엇을 만들었는지 → 어떻게 확인하는지(주소, 명령) → 남은 한계 순서로 짧게.
