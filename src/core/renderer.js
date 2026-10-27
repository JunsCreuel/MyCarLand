// 캔버스 렌더러: 이미지 한 장을 캔버스에 object-fit: cover 처럼 꽉 차게 그린다.
//
// 왜 이렇게 짰나
// - 스크롤 이벤트는 1프레임에 여러 번 올 수 있다. 그때마다 그리면 낭비라서
//   "다음에 그릴 이미지"만 기억해 두고 requestAnimationFrame 에서 한 번만 그린다.
// - 같은 이미지·같은 크기면 다시 그리지 않는다.
// - devicePixelRatio 를 2까지만 쓴다. 3배 화면(최신 폰)에서 3배로 그리면
//   메모리와 그리는 시간만 늘고 눈으로는 차이가 거의 없다.
const MAX_DPR = 2;

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.pending = null; // 다음 rAF 에 그릴 이미지
    this.drawn = null; // 지금 화면에 있는 이미지
    this.raf = 0;
    this.width = 0;
    this.height = 0;

    // 크기 변화(창 크기 조절, 화면 회전, 모바일 주소창 접힘)를 한 곳에서 처리
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (w === this.width && h === this.height) return;
    this.width = this.canvas.width = w;
    this.height = this.canvas.height = h;
    // 캔버스 크기를 바꾸면 내용이 지워지므로 마지막 이미지를 다시 그린다
    this.drawn = null;
    this.request(this.pending ?? this.lastImage);
  }

  // 그릴 이미지를 예약한다 (실제로는 다음 화면 갱신 때 한 번만 그림)
  request(image) {
    if (!image) return;
    this.pending = image;
    if (!this.raf) this.raf = requestAnimationFrame(() => this.flush());
  }

  flush() {
    this.raf = 0;
    const image = this.pending;
    this.pending = null;
    if (!image || image === this.drawn || !this.width) return;

    // cover 계산: 캔버스를 빈틈없이 덮는 가장 작은 배율로 확대하고 가운데 맞춤
    const scale = Math.max(this.width / image.naturalWidth, this.height / image.naturalHeight);
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    this.ctx.drawImage(image, (this.width - w) / 2, (this.height - h) / 2, w, h);
    this.drawn = image;
    this.lastImage = image;
  }

  destroy() {
    this.observer.disconnect();
    cancelAnimationFrame(this.raf);
  }
}
