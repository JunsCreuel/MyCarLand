// 캔버스 렌더러: 이미지를 캔버스에 object-fit: cover 처럼 꽉 차게 그린다.
//
// 왜 이렇게 짰나
// - 스크롤 위치가 두 프레임 사이(예: 12.4번째)일 때 12번을 그리고 그 위에 13번을 40% 투명도로
//   겹쳐 그린다. 반올림해서 한 장만 그리면 프레임이 바뀌는 순간 툭 끊겨 보이기 때문이다.
// - 스크롤 이벤트는 1프레임에 여러 번 올 수 있다. 그때마다 그리면 낭비라서
//   "다음에 그릴 이미지"만 기억해 두고 requestAnimationFrame 에서 한 번만 그린다.
// - 같은 이미지·같은 크기면 다시 그리지 않는다.
// - 크기를 바꿔 그릴 때 브라우저 기본값(imageSmoothingQuality = 'low')은 거칠게 줄이고 늘려서
//   잔디·차선이 자글자글해 보인다. 'high' 로 그린다 (캔버스 크기가 바뀌면 이 설정이 초기화되므로 매번 지정).
// - devicePixelRatio 를 2까지만 쓴다. 3배 화면(최신 폰)에서 3배로 그리면
//   메모리와 그리는 시간만 늘고 눈으로는 차이가 거의 없다.
const MAX_DPR = 2;

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.pending = null; // 다음 rAF 에 그릴 { base, next, mix }
    this.drawnKey = ''; // 지금 화면에 있는 그림 (같은 그림이면 다시 안 그림)
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
    // 캔버스 크기를 바꾸면 내용이 지워지므로 마지막 그림을 다시 그린다
    this.drawnKey = '';
    if (this.last) this.request(this.last.base, this.last.next, this.last.mix);
  }

  // 그릴 그림을 예약한다 (실제로는 다음 화면 갱신 때 한 번만 그림)
  // base: 아래 프레임, next: 위에 겹칠 다음 프레임(없으면 null), mix: next 의 불투명도 0~1
  request(base, next = null, mix = 0) {
    if (!base) return;
    // 1/16 단위로 맞춰서, 눈에 안 보일 만큼 작은 변화로는 다시 그리지 않는다
    const m = next ? Math.round(mix * 16) / 16 : 0;
    this.pending = { base, next: m > 0 && m < 1 ? next : null, mix: m };
    if (m >= 1) this.pending = { base: next, next: null, mix: 0 };
    if (!this.raf) this.raf = requestAnimationFrame(() => this.flush());
  }

  // cover 계산: 캔버스를 빈틈없이 덮는 가장 작은 배율로 확대하고 가운데 맞춤
  drawCover(image) {
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    const scale = Math.max(this.width / image.naturalWidth, this.height / image.naturalHeight);
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    this.ctx.drawImage(image, (this.width - w) / 2, (this.height - h) / 2, w, h);
  }

  flush() {
    this.raf = 0;
    const job = this.pending;
    this.pending = null;
    if (!job || !this.width) return;
    const key = `${job.base.src}|${job.next?.src ?? ''}|${job.mix}`;
    if (key === this.drawnKey) return;

    this.drawCover(job.base);
    if (job.next) {
      this.ctx.globalAlpha = job.mix;
      this.drawCover(job.next);
      this.ctx.globalAlpha = 1;
    }
    this.drawnKey = key;
    this.last = job;
  }

  destroy() {
    this.observer.disconnect();
    cancelAnimationFrame(this.raf);
  }
}
