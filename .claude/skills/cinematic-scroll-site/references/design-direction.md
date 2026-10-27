# 디자인 방향

레퍼런스: 해외 "Scroll & Interactive Website for Auto Performance Shops / Car Dealership" 릴스들
(예: "SWAP THE STOPPERS.", "PICK YOUR FINISH.", "TUNED LIVE. FROM THE DRIVER'S SEAT.", "Set the combination. We'll pull the car.").

## 화면 언어

- 검은 배경(#0A0A0B), 차·제품이 화면을 꽉 채우는 풀스크린 장면.
- 헤드라인: 굵은 압축 산세리프 대문자(Anton 등), 2줄, 마침표로 끝냄. **마지막 단어만 포인트 컬러**.
  크기 차이를 크게: 헤드라인 clamp(64px, 11.5vw, 184px) vs 본문 16~19px.
- 포인트 컬러는 한 가지(노랑 #F5C518 계열이 레퍼런스). 버튼(알약), eyebrow 의 짧은 선, 강조 단어, 진행 막대에만.
- eyebrow: `01 — DETAIL` 처럼 작은 대문자 + 자간 0.2em + 앞에 포인트 컬러 짧은 선.
- 사양 패널: 오른쪽 위, 반투명 어두운 상자 + 왼쪽 포인트 컬러 2px 선, `ENGINE / Flat-6` 같은 2열.
- 한국어 서브카피는 Pretendard, `word-break: keep-all`, 30ch 안팎.
- 그림자(gradient)는 장식이 아니라 글 가독성용으로만, 글이 있는 쪽에만.

## 섹션 구성 (레이아웃이 연달아 같지 않게)

| 순서 | 섹션 | 레이아웃 |
|---|---|---|
| 1 | 히어로 장면 (auto, onEnd next) | 매거진 히어로: 풀블리드 + 왼쪽 아래 헤드라인 + 오른쪽 위 사양 패널 |
| 2 | 제작 과정 / 핵심 메시지 (steps) | 비대칭 5:7 — 왼쪽 큰 헤드라인, 오른쪽 큰 번호 목록 |
| 3 | 주행·디테일 장면 | 풀블리드 + 왼쪽 가운데 또는 오른쪽 헤드라인 |
| 4 | PICK YOUR FINISH (picker) | 위 헤드라인/버튼, 아래 큰 사진 — PC 한 화면에 들어오게 |
| 5 | LET'S TALK (cta) | 큰 타이포 가운데 + 카카오 버튼 크게 |

카피 공식: 영어 헤드라인(짧고 단정) + 한국어 서브카피 한 줄. 예) `AFTER\nDARK.` / "불이 켜지는 순간, 낮과는 다른 차가 됩니다."

## 금지 (AI 티)

보라→파랑 그라데이션, 그라데이션 텍스트, 아이콘+제목+설명 카드 3개 나열, 전부 가운데 정렬, 블롭·글로우·글래스,
"혁신적인" 같은 빈 카피, 이모지 아이콘, 근거 없는 로고 띠. 임시 소재로 그린 점토 같은 실루엣을 데모에 쓰는 것.

## 움직임 값

- 글 등장 400ms `cubic-bezier(0.23,1,0.32,1)`, translateY 14px → 0, 줄마다 50ms 시차. 퇴장은 260ms.
- 버튼 누름 scale(0.97) 120ms, 호버는 `(hover:hover) and (pointer:fine)` 안에서 배경색만.
- 피커 크로스페이드 350ms. 한 화면 넘김 0.85s power3.inOut.
- transform/opacity 만 애니메이트. `prefers-reduced-motion`이면 이동·스케일 끄고 opacity 만.

## 모바일

- 폭 768 미만은 모바일 프레임(세로 3:4 크롭). 글은 장면 아래쪽, 그림자도 아래쪽만.
- snap 모드에서는 섹션이 100svh(약 844px) 안에 들어가게 간격을 줄인다. 넘치면 한 번 더 넘겨야 해서 어색하다.
- 버튼 44px 이상, 카카오 버튼은 폭 100%.
