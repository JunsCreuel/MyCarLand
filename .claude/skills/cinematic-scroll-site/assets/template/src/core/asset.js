// public 폴더 파일 경로를 실제 주소로 바꾼다.
// 설정 파일에는 "/frames/hero/..." 처럼 적지만, 사이트가 하위 경로
// (예: GitHub Pages의 /mycarland/)에 올라가면 앞에 그 경로를 붙여야 한다.
// import.meta.env.BASE_URL 은 Vite가 vite.config.js 의 base 값으로 채워 준다.
export function asset(path) {
  if (!path || /^https?:\/\//.test(path)) return path;
  return import.meta.env.BASE_URL + path.replace(/^\//, '');
}
