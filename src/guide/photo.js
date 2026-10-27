// 예시 사진 또는 자리표시자
//
// public/guide/ 에 사진 파일을 넣기만 하면 바로 바뀌게 하려고, 일단 <img> 로 불러 보고
// 실패(파일 없음)하면 회색 자리표시자로 바꾼다. 사진이 없는 동안 콘솔이 지저분해지지 않게
// fetch 로 먼저 확인하지 않고 이미지 자체의 error 이벤트를 쓴다.
import { asset } from '../core/asset.js';

const escapeHtml = (s = '') =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function photoHtml(path, alt, placeholderText) {
  return `
    <div class="photo">
      <img src="${asset(path)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" data-photo>
      <div class="photo__placeholder" aria-hidden="true">
        <svg class="icon"><use href="#i-photo"/></svg>
        <span>${escapeHtml(placeholderText)}</span>
      </div>
    </div>`;
}

// 사진을 못 불러오면 .photo 에 is-missing 을 붙여 자리표시자를 보인다
export function watchPhotos(root) {
  root.querySelectorAll('img[data-photo]').forEach((img) => {
    const box = img.closest('.photo');
    const fail = () => box.classList.add('is-missing');
    if (img.complete && img.naturalWidth === 0) fail();
    img.addEventListener('error', fail, { once: true });
  });
}

export { escapeHtml };
