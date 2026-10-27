// 프레임 로더: 한 섹션의 이미지 시퀀스(0001.webp ~ N.webp)를 불러온다.
//
// 왜 이렇게 짰나
// - 첫 화면이 빨리 떠야 하므로 처음엔 대표 프레임 한 장만 받는다 (loadFirst).
// - 나머지는 섹션이 가까워질 때 받는다 (loadAll). 이때 1, 9, 17…처럼 띄엄띄엄 먼저 받고
//   빈 곳을 채워 나가서, 아무리 빨리 스크롤해도 근처 프레임 하나는 이미 있게 한다.
// - 아직 안 받은 프레임을 그려야 할 때는 이미 받은 가장 가까운 프레임을 대신 쓴다 (nearest).
import { asset } from './asset.js';

const PARALLEL = 6; // 동시에 받을 이미지 수 (너무 많으면 첫 화면 이미지가 늦어진다)

export class FrameSequence {
  constructor({ basePath = '/frames', folder, count, ext = 'webp', digits = 4, set }) {
    this.count = count;
    this.urls = Array.from({ length: count }, (_, i) =>
      asset(`${basePath}/${folder}/${set}/${String(i + 1).padStart(digits, '0')}.${ext}`),
    );
    this.images = new Array(count).fill(null); // 다 받은 프레임만 들어간다
    this.requested = new Set();
    this.onFrameLoaded = null; // (index) => void — 렌더러가 다시 그릴지 판단하는 데 쓴다
    this.allStarted = false;
  }

  // 프레임 하나 받기. decode()까지 기다려서 그릴 때 끊기지 않게 한다.
  load(index) {
    if (this.requested.has(index)) return Promise.resolve();
    this.requested.add(index);
    const img = new Image();
    img.decoding = 'async';
    img.src = this.urls[index];
    return img
      .decode()
      .then(() => {
        this.images[index] = img;
        this.onFrameLoaded?.(index);
      })
      .catch(() => {
        // 한 장이 깨져도 전체가 멈추지 않게: 그 자리는 가까운 프레임이 대신한다
        console.warn(`프레임을 불러오지 못했습니다: ${this.urls[index]}`);
      });
  }

  loadFirst(index = 0) {
    return this.load(index);
  }

  // 띄엄띄엄 → 촘촘히 순서로 나머지를 받는다
  loadAll() {
    if (this.allStarted) return;
    this.allStarted = true;
    const order = [];
    const seen = new Set();
    for (let step = 8; step >= 1; step /= 2) {
      for (let i = 0; i < this.count; i += step) {
        if (!seen.has(i)) {
          seen.add(i);
          order.push(i);
        }
      }
    }
    if (!seen.has(this.count - 1)) order.push(this.count - 1);

    let next = 0;
    const worker = async () => {
      while (next < order.length) await this.load(order[next++]);
    };
    for (let w = 0; w < PARALLEL; w++) worker();
  }

  // index에 가장 가까운, 이미 받은 프레임
  nearest(index) {
    if (this.images[index]) return this.images[index];
    for (let d = 1; d < this.count; d++) {
      if (this.images[index - d]) return this.images[index - d];
      if (this.images[index + d]) return this.images[index + d];
    }
    return null;
  }
}
