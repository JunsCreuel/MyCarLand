# QA와 배포

## 설정 검사

`npm run check` (build 전에 자동 실행). 스키마 위반 + 섹션 id 중복, 헤드라인에 없는 accentWord, 없는 프레임 파일,
피커 기본 옵션, 실내 장면 규칙(start 1장 + end 1장, 실내 사진만), scroll 재생인데 scrollLength 없음 등을 한국어로 알려 준다.

## 소개 사이트 — `scripts/qa-site.py`

```bash
npm run build && npx vite preview --port 4173 &
PW_CHROMIUM=<chromium 경로> python scripts/qa-site.py http://localhost:4173/ qa-screenshots
```

모바일 390×844(4G 속도 제한)·PC 1440×900에서:
- 첫 화면 전송량(load 시점) — 목표 ≤ 2MB (정상 0.4~0.7MB)
- 끝까지 본 전체 전송량 — 모바일 목표 ≤ 15MB
- 빠른 스크롤 중 빈 캔버스 횟수 — 0 이어야 함
- 가로 스크롤, 44px 미만 버튼, 콘솔 에러, 실패한 요청
- 섹션별 스크린샷 → **반드시 직접 열어 본다** (숫자는 통과인데 화면이 이상한 경우가 있었다: 겹친 라벨, 잘린 차, 두 줄 버튼)

snap/auto 모드는 추가로 확인:
- 첫 장면 재생이 끝나면 다음 화면으로 넘어가는지 (`scrollY`가 다음 섹션 offsetTop 이 되는지 기다림)
- PC 휠 한 번 = 정확히 한 화면, 위로 한 번 = 이전 화면
- 모바일 터치는 **페이지 안에서 `TouchEvent`를 직접 만들어 setTimeout 간격으로 dispatch** 해서 시험한다
  (`new Touch({identifier, target, clientX, clientY})` → `touchstart` / `touchmove` 여러 번 / `touchend`).
  CDP `Input.dispatchTouchEvent`는 이벤트 사이가 ~50ms 씩 벌어져 빠른 튕김이 느린 끌기로 둔갑하고,
  `synthesizeScrollGesture`는 Observer 의 touch 리스너에 아예 안 잡혔다.
- 이 스킬의 `scripts/touch_check.py <주소>`가 아래 6가지를 자동으로 확인한다: 20px 살짝 끌기 → 제자리 / 80px 끌기 → 다음 화면 / 30px 빠른 튕김 → 다음 화면 /
  아래로 80px → 이전 화면 / 탭 → 그대로(버튼 눌림) / 첫 화면에서 아래로 당기기 → 제자리
- 동작 줄이기(`reduced_motion="reduce"`)에서 자동으로 넘어가지 않고 에러가 없는지

Playwright 가 내장 브라우저를 못 찾으면 `executable_path`로 설치된 Chromium 을 지정한다 (`playwright install` 금지 환경일 수 있음).

## 촬영 가이드 — `scripts/qa-guide.py`

도식 번호 누르기 → 카드 이동 + 강조, 스크롤 시 강조 따라감, 촬영 모드 처음~끝, 새로고침 후 체크 유지,
localStorage 차단 시 동작, 44px, 본문 글자 크기, 가로 스크롤, 콘솔 에러. 15/15 통과가 기준.

## 배포 — GitHub Pages (`npm run deploy:gh`)

- `BASE_PATH=/<레포>/`로 빌드 → dist 만 담은 커밋을 `gh-pages` 브랜치에 force push. gh-pages 브랜치가 생기면 Pages 가 켜진다
  (gh CLI 토큰이 없어도 git push 만으로 가능).
- **package.json `pagesBase`에 대소문자까지 정확한 경로**를 적는다 (`/MyCarLand/`). git remote 주소는 소문자로 바뀌어 있을 수 있다.
- 작업 중인 미커밋 파일이 섞이지 않게 커밋된 HEAD 를 별도 worktree 에서 빌드:
  ```bash
  git worktree add --detach /tmp/deploy-wt HEAD && ln -s "$PWD/node_modules" /tmp/deploy-wt/node_modules
  (cd /tmp/deploy-wt && npm run deploy:gh); git worktree remove --force /tmp/deploy-wt
  ```
- 배포 후 1~2분 기다렸다가: 실제 주소의 HTML 에서 `main-*.js`를 받아 새 코드 문자열이 들어 있는지, 프레임 하나가 200 인지 curl 로 확인 →
  실제 주소로 qa 스크립트를 한 번 더 돌린다.
- 폰에서 열 때: 대소문자 정확한 링크 또는 QR 코드(`qrcode` 파이썬 패키지)를 만들어 준다.

## Cloudflare Pages 로 옮길 때

빌드 명령 `npm run build`, 출력 폴더 `dist`, 도메인 루트면 BASE_PATH 불필요. 고객마다 프로젝트(또는 브랜치) 하나.
