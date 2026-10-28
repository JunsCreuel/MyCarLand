// public 폴더 파일 경로를 실제 주소로 바꾼다.
// 설정 파일에는 "/frames/hero/..." 처럼 적지만, 사이트가 하위 경로
// (예: GitHub Pages의 /mycarland/)에 올라가면 앞에 그 경로를 붙여야 한다.
// import.meta.env.BASE_URL 은 Vite가 vite.config.js 의 base 값으로 채워 준다.
//
// 이미지에는 빌드마다 바뀌는 ?v= 를 붙인다. 프레임 파일 이름(0001.webp…)은 그대로인데 내용만 바뀌면
// 휴대폰이 예전 사진을 캐시에서 꺼내 새 사진과 섞어 보여 줘서 영상이 깨져 보였다.
export function asset(path) {
  if (!path || /^https?:\/\//.test(path)) return path;
  const url = import.meta.env.BASE_URL + path.replace(/^\//, '');
  return /\.(webp|jpe?g|png|avif)$/i.test(url) ? `${url}?v=${__ASSET_V__}` : url;
}
