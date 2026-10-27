import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// 멀티 페이지: 빌드할 때 두 HTML을 각각 진입점으로 만든다.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'), // 차량 소개 사이트
        guide: resolve(import.meta.dirname, 'guide.html'), // 촬영 가이드
      },
    },
  },
});
