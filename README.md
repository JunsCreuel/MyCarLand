# MyCarLand

스크롤을 내리면 차가 움직이는 원페이지 차량 소개 사이트 템플릿.
AI로 만든 짧은 영상을 WebP 프레임으로 잘라 `<canvas>`에 스크롤 진행률대로 그립니다(애플 제품 페이지 방식).

- `index.html` — 차량 소개 사이트
- `guide.html` — 고객용 촬영 가이드

```bash
npm install
npm run dev      # http://localhost:5173 , /guide.html
npm run check    # 설정 검사
```

새 고객 사이트를 만드는 방법은 [CONFIG_GUIDE.md](CONFIG_GUIDE.md)를 보세요.

## 폴더

```
raw/                 원본 mp4·고객 사진 (git 제외)
public/frames/       섹션별 프레임 <섹션id>/desktop|mobile/0001.webp
public/images/       컬러 피커 정지 이미지
public/guide/        촬영 가이드 예시 사진 (shot-01.webp …)
src/config/          site.json(고객별), shots.json(촬영 컷) + 스키마
src/core/            프레임 로더, 캔버스 렌더러, 스크롤 세팅
src/sections/        섹션 타입별 모듈 (scrub, picker, cta)
src/guide/           촬영 가이드 페이지
scripts/             설정 검사, ffmpeg·AI 생성 스크립트
```

기술: Vite(멀티 페이지) · 바닐라 JS · GSAP ScrollTrigger · Lenis · ffmpeg · WebP
