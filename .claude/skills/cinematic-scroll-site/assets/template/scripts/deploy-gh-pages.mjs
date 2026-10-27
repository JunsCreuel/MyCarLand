// GitHub Pages 배포: npm run deploy:gh
//
// 1) 사이트 주소가 https://<계정>.github.io/<레포>/ 라서 BASE_PATH=/<레포>/ 로 빌드한다.
// 2) dist 폴더만 담은 커밋을 만들어 gh-pages 브랜치에 강제로 올린다 (배포 기록은 남길 필요 없음).
// GitHub 은 gh-pages 브랜치가 생기면 Pages 를 자동으로 켠다.
// 나중에 Cloudflare Pages 로 옮기면 이 스크립트 대신 "npm run build" + 출력 폴더 dist 로 설정하면 된다.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });
const out = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', ...opts }).trim();

const remote = out('git', ['remote', 'get-url', 'origin'], { cwd: ROOT });
// Pages 주소의 경로는 레포 이름의 대소문자까지 정확해야 한다 (/MyCarLand/ ≠ /mycarland/).
// 원격 주소는 소문자로 저장돼 있을 수 있으므로 package.json 의 pagesBase 를 우선 쓴다.
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const repo = remote.replace(/\.git$/, '').split('/').pop();
const base = pkg.pagesBase ?? `/${repo}/`;

console.log(`빌드: BASE_PATH=${base}`);
run('npm', ['run', 'build'], { cwd: ROOT, env: { ...process.env, BASE_PATH: base } });

const dist = join(ROOT, 'dist');
writeFileSync(join(dist, '.nojekyll'), ''); // _ 로 시작하는 파일도 그대로 쓰게 (Jekyll 처리 끄기)

// dist 를 임시 git 저장소로 만들어 gh-pages 로 push
const tmp = mkdtempSync(join(tmpdir(), 'gh-pages-'));
const git = (...args) => run('git', ['--git-dir', join(tmp, '.git'), '--work-tree', dist, ...args]);
run('git', ['init', '-q', '-b', 'gh-pages', tmp]);
git('add', '-A');
const source = out('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT });
git('-c', 'user.name=deploy', '-c', 'user.email=deploy@localhost', 'commit', '-q', '-m', `deploy: ${source}`);
git('push', '-q', '--force', remote, 'gh-pages');
rmSync(tmp, { recursive: true, force: true });

const owner = remote.split('/').slice(-2, -1)[0].toLowerCase();
console.log(`\n배포했습니다: https://${owner}.github.io${base}  (반영까지 1~2분 걸릴 수 있어요)`);
