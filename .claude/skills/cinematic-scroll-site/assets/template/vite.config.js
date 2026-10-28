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

// index.html 의 <head> 를 site.json 으로 채운다.
// 카카오톡·검색엔진은 JS 를 실행하지 않으므로 제목·설명·공유 썸네일은 HTML 에 직접 들어가야 한다.
// 첫 장면의 첫 프레임은 preload 해서 첫 화면이 빨리 뜨게 한다 (PC/모바일 세트를 media 로 구분).
function siteHead() {
  let base = '/';
  return {
    name: 'site-head',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (!ctx.filename.endsWith('index.html')) return html;
        const site = JSON.parse(readFileSync(resolve(import.meta.dirname, 'src/config/site.json'), 'utf8'));
        const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        const url = (p) => base + p.replace(/^\//, '');
        const tags = [
          { tag: 'meta', attrs: { name: 'description', content: site.meta.description } },
          { tag: 'meta', attrs: { name: 'theme-color', content: site.brand.backgroundColor ?? '#0a0a0b' } },
          { tag: 'meta', attrs: { property: 'og:type', content: 'website' } },
          { tag: 'meta', attrs: { property: 'og:title', content: site.meta.title } },
          { tag: 'meta', attrs: { property: 'og:description', content: site.meta.description } },
        ];
        if (site.meta.ogImage) tags.push({ tag: 'meta', attrs: { property: 'og:image', content: url(site.meta.ogImage) } });
        for (const font of Object.values(site.brand.fonts)) {
          if (font.cssUrl) tags.push({ tag: 'link', attrs: { rel: 'stylesheet', href: font.cssUrl } });
        }
        const first = site.sections[0];
        if (first?.type === 'scrub' && first.frames.count > 0) {
          const digits = site.frames?.digits ?? 4;
          const mobileMax = (site.frames?.mobileMaxWidth ?? 768) - 0.02;
          const frame = (set) =>
            url(`${site.frames?.basePath ?? '/frames'}/${first.frames.folder}/${set}/${'1'.padStart(digits, '0')}.${first.frames.ext ?? 'webp'}`);
          tags.push(
            { tag: 'link', attrs: { rel: 'preload', as: 'image', href: frame('desktop'), media: `(min-width: ${mobileMax + 0.02}px)`, fetchpriority: 'high' } },
            { tag: 'link', attrs: { rel: 'preload', as: 'image', href: frame('mobile'), media: `(max-width: ${mobileMax}px)`, fetchpriority: 'high' } },
          );
        }
        return {
          html: html
            .replace(/<html lang="[^"]*">/, `<html lang="${esc(site.meta.lang)}">`)
            .replace(/<title>.*<\/title>/, `<title>${esc(site.meta.title)}</title>`),
          tags: tags.map((t) => ({ ...t, injectTo: 'head' })),
        };
      },
    },
  };
}

// 촬영 가이드 페이지는 "고객이 사진을 찍어 보내는" 서비스일 때만 필요하다.
// site.json 의 pages.guide 가 false 면 빌드에서 빼서, 딜러 사이트에 엉뚱한 페이지가 같이 올라가지 않게 한다.
const siteConfig = JSON.parse(readFileSync(resolve(import.meta.dirname, 'src/config/site.json'), 'utf8'));
const withGuide = siteConfig.pages?.guide !== false;

export default defineConfig({
  // 배포 위치가 하위 경로면 BASE_PATH=/mycarland/ 처럼 지정한다 (기본은 도메인 루트).
  base: (process.env.BASE_PATH ?? '/').trim(),
  plugins: [publicShots(), siteHead()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'), // 소개 사이트
        ...(withGuide ? { guide: resolve(import.meta.dirname, 'guide.html') } : {}), // 촬영 가이드 (선택)
      },
    },
  },
});
