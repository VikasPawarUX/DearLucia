// Upload dist-site/ as a new version of the `dear-lucia` Worker, then send all traffic to it.
// Run through `pnpm deploy:site`, which builds first. Pass --dry-run to only validate the upload.
// Using versions (rather than `wrangler deploy`) leaves the routes on www.vikaspawar.online untouched,
// and the previous version stays available for rollback in the Cloudflare dashboard.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const wrangler = fileURLToPath(new URL('../node_modules/.bin/wrangler', import.meta.url));
const dryRun = process.argv.includes('--dry-run');

if (!existsSync(new URL('../dist-site/dearlucia/index.html', import.meta.url))) {
  console.error('dist-site/dearlucia/ is missing. Run `pnpm build:site` first.');
  process.exit(1);
}

const commit = execFileSync('git', ['log', '-1', '--format=%h %s'], { cwd: root, encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
const message = `${commit}${dirty ? ' (uncommitted changes)' : ''}`.slice(0, 100);

function run(args) {
  const result = spawnSync(wrangler, args, { cwd: root, encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] });
  process.stdout.write(result.stdout ?? '');
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout ?? '';
}

const upload = run(['versions', 'upload', '--message', message, ...(dryRun ? ['--dry-run'] : [])]);
if (dryRun) {
  console.log('\nDry run only: nothing was uploaded or deployed.');
  process.exit(0);
}

const version = upload.match(/Worker Version ID:\s*([0-9a-f-]{36})/)?.[1];
if (!version) {
  console.error('Could not find the uploaded version ID, so nothing was deployed.');
  process.exit(1);
}
run(['versions', 'deploy', `${version}@100%`, '--message', message, '--yes']);
console.log(`\nLive: https://www.vikaspawar.online/dearlucia/ (version ${version})`);
