# AI 장면 생성 (사용자가 요청할 때만)

레퍼런스 사이트의 실사 같은 장면은 이렇게 만들어진다:
1. 고객 사진(외관·실내)을 **영화 같은 장면 이미지**로 보정 (해 질 녘 조명, 광택, 통일된 분위기, 차 형태는 그대로)
2. **시작 이미지 + 끝 이미지**를 지정해 그 사이를 천천히 잇는 짧은 영상 생성 (예: 뒤쪽 대각선 외관 → 운전석 실내)
3. 영상 → `extract-frames.mjs` → 사이트

## 원칙

- **모델 ID·파라미터·요금은 작업 시점의 공식 문서로 확인한다.** 아래 표는 2026-10-27 확인 스냅샷이고 이미 낡았을 수 있다
  (확인 당시에도 Veo 3.1 프리뷰와 Sora 2 API 가 직전에 종료된 상태였다).
- 실행 전에 예상 비용을 출력하고 `--yes` 옵션이 있어야만 실제로 호출한다.
- 실내 장면은 **실제 실내 사진 두 장만** 시작·끝 프레임으로 쓴다 (AI 가 실내를 지어내지 않게). shots.json `scenes[].method: "interpolate"`.
- 입력: `raw/<고객>/01.jpg`~`17.jpg` (shots.json 컷 번호). 출력: `raw/<고객>/generated/`.
- API 키는 `.env`에만 두고 읽을 때 `.trim()`. 클라우드 세션이면 환경 설정의 시크릿/환경변수로 받는다. 채팅으로 받지 않는다.
- 첫 시도는 사진 1장·영상 1개짜리 테스트로 비용·품질을 확인하고 넓힌다.

## 2026-10-27 기준 확인 내용 (다시 확인할 것)

| 용도 | 모델 | 상태·특징 | 요금(공식 문서) |
|---|---|---|---|
| 사진 → 장면 이미지 | Nano Banana 2.1 `gemini-nano-banana-2.1` | Gemini API | 1K $0.0336 / 2K $0.0504 |
| 고품질 장면 이미지 | Nano Banana Pro `gemini-3-pro-image` | Gemini API | 1K·2K $0.134 / 4K $0.24 |
| 시작·끝 프레임 영상 | Gemini Omni Flash `gemini-omni-1.1-flash` | Gemini API, `input`에 이미지 두 장 = 첫/끝 프레임 보간. 720p 기본(1080p·4k 는 업스케일), 16:9/9:16, MP4 | 720p 약 $0.10/초 |
| 시작·끝 프레임 영상(고해상도) | Veo 3.1 GA | Gemini API 프리뷰는 2026-10-22 종료, Google Cloud(Gemini Enterprise Agent Platform)에서 제공. `lastFrame`은 `image`와 함께, 1080p·4k 는 8초 | 문서 확인 |
| 대안 영상 | Kling (start/end frame) | 공식 문서 미확인, 리셀러마다 파라미터명이 다름(`tail_image_url` 등) | 확인 필요 |
| 이미지 편집 대안 | OpenAI `gpt-image-2.5-sunburst` / `-flare` | 사용 가능 | 문서 확인 |
| (종료) | OpenAI Sora 2 API | 2026-09-24 종료 | — |
| (종료) | Gemini 2.5 Flash Image | 2026-10-02 종료 예정이었음 | — |

공식 문서: `ai.google.dev/gemini-api/docs/omni`, `/docs/veo`, `/docs/pricing`, `developers.openai.com/api/docs/models`.

## 프롬프트 요령 (스크롤 재생용 영상)

- "slow, steady camera move, no cuts, no shake, constant speed, cinematic golden-hour lighting, glossy paint,
  keep the exact car model, color and wheels" — 카메라는 천천히 일정하게, 컷 없이.
- 영상 길이 5~8초 → 그중 가장 잔잔한 2.5~4초를 `inspect_footage.py`로 골라 48fps 로 뽑는다.
- 번호판은 생성 단계에서 흐리게 하거나 사이트에서 가린다 (가이드에서 "사이트에서는 가려서 공개" 약속).
