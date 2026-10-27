# 소재 준비: 영상 → 프레임

## 소재 구하기

- **고객 영상/AI 영상**이 기본. 없으면 데모용 무료 실사 영상.
- 무료 실사: Pexels/Pixabay(상업 이용 가능, 출처 표기 불필요)가 막혀 있으면 위키미디어 커먼즈 API 로 찾는다.
  ```
  https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=porsche%20filetype:video
    &prop=imageinfo&iiprop=size|mediatype|extmetadata|url&format=json
  ```
  `videoinfo`의 `derivatives`에 1080p 변환본 주소가 있다. User-Agent 에 연락처를 넣고, 429 면 간격을 늘려 재시도.
  CC BY/BY-SA 는 `site.json`의 `credits`에 작품명·작가·라이선스·링크를 반드시 적는다.
- 고객 사진만 있고 영상이 없으면 → `ai-generation.md`.

## 구간 고르기 (끊김을 줄이는 가장 큰 레버)

```bash
python <skill>/scripts/inspect_footage.py raw/clip.mp4 --sheet raw/sheet.png       # 전체 훑어보기
python <skill>/scripts/inspect_footage.py raw/clip.mp4 --duration 2.5 --range 36 44 # 후보 구간 안에서
```

- 구간 안에 **컷**이 있으면 안 된다 (프레임 재생 중 번쩍임).
- motion 평균이 낮은 구간 = 카메라가 천천히 움직이는 구간. 대략 6 이하 매끈, 10 이상이면 auto 재생을 권한다.
- 시트 이미지를 직접 보고 차(제품)가 화면에 잘 잡히는지 확인한다 — 숫자만 보고 고르면 차가 안 보이는 구간을 고르기도 한다.

## 프레임 뽑기 — 템플릿 `scripts/extract-frames.mjs`

```bash
node scripts/extract-frames.mjs raw/clip.mp4 hero --start 39.5 --duration 2.5 --fps 48 \
  --quality 82 --mobile-quality 78 --focus-x 0.5
```

- 출력: `public/frames/<id>/desktop/0001.webp…`(1920px), `mobile/`(828px, 가운데를 3:4로 자름). site.json 프레임 수 자동 갱신.
- 섹션당 최대 120장. 넘으면 fps 를 자동으로 낮춘다 → **구간을 짧게, fps 는 높게**가 매끈하다 (원본 fps 이하).
- `--focus-x`: 모바일로 자를 때 차가 있는 가로 위치(0~1). 차가 오른쪽에 있으면 0.65~0.7.
- 세로 영상이 따로 있으면 `--mobile-src`.
- 결과 용량이 표로 나온다. 예산: 첫 화면 ≤ 2MB, 모바일 전체 ≤ 15MB. 넘으면 모바일 품질을 70~75로, 장면 수를 줄이거나 구간을 줄인다.
- 뽑은 뒤 프레임 간 변화를 비교하고 싶으면:
  ```bash
  ffmpeg -framerate 24 -i public/frames/hero/mobile/%04d.webp -vf "scale=320:-2,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -f null -
  ```

## 컬러 피커 이미지 — 템플릿 `scripts/make-picker-images.mjs`

- 가장 좋은 것: AI 이미지 편집으로 같은 구도에서 색만 바꾼 이미지 (`ai-generation.md`).
- 임시: 영상 한 장면에서 차 색 계열만 `huesaturation`으로 돌린다. 스크립트의 `RECOLOR` 표가 옵션 id → 필터.
  원본 차 색 계열(`SOURCE_COLORS`, 예: 청록 `c+b`)만 바뀌므로 들판·도로는 그대로다. 그림자에 색이 살짝 비치는 한계가 있다.
  ```bash
  node scripts/make-picker-images.mjs raw/clip.mp4 --at 44.6 --focus-x 0.55
  ```

## 임시 소재 — `scripts/make-placeholders.mjs`

영상이 아직 없을 때 엔진을 먼저 만들기 위한 그라데이션+프레임 번호 영상. 고객에게 보여 줄 데모에는 쓰지 않는다
(사용자 반응: "점토 같다"). 데모는 반드시 실사 소재로.

## 공유 썸네일

`public/images/og.webp` 1200×630. 영상 한 장면을 잘라 만든다:
`ffmpeg -ss 41.2 -i clip.mp4 -frames:v 1 -vf "scale=1200:-2,crop=1200:630" -quality 80 public/images/og.webp`
