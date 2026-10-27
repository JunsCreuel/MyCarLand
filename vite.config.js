import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// 내부용 정보(usedFor, scenes)를 뺀 shots.json.
// 가이드 페이지는 'shots.json?public' 으로 불러오므로, 고객이 소스를 열어 봐도
// 어떤 사진이 어떤 AI 장면에 쓰이는지는 보이지 않는다.
function publicShots() {
  const suffix = 'shots.json?public';
  return {
    name: 'public-shots',
    enforce: 'pre',
    async resolveId(id, importer) {
      if (!id.endsWith(suffix)) return null;
      const resolved = await this.resolve(id.replace('?public', ''), importer, { skipSelf: true });
      return resolved && `\0${resolved.id}?public`;
    },
    load(id) {
      if (!id.startsWith('\0') || !id.endsWith('?public')) return null;
      const file = id.slice(1, -'?public'.length);
      this.addWatchFile(file);
      const { scenes, shots, ...rest } = JSON.parse(readFileSync(file, 'utf8'));
      const cleaned = { ...rest, shots: shots.map(({ usedFor, ...shot }) => shot) };
      return `export default ${JSON.stringify(cleaned)};`;
    },
  };
}

export default defineConfig({
  // 배포 위치가 하위 경로면 BASE_PATH=/mycarland/ 처럼 지정한다 (기본은 도메인 루트).
  base: (process.env.BASE_PATH ?? '/').trim(),
  plugins: [publicShots()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'), // 차량 소개 사이트
        guide: resolve(import.meta.dirname, 'guide.html'), // 촬영 가이드
      },
    },
  },
});
