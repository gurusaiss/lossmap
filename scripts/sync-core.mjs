// Edge Functions cannot import from the npm workspace, so packages/core/src is copied (without tests) into the functions tree.
//   node scripts/sync-core.mjs          copy
//   node scripts/sync-core.mjs --check  fail if the copy has drifted
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'packages/core/src'), dest = join(root, 'supabase/functions/_shared/core');
const files = (d, base = d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? files(p, base) : n.endsWith('.test.ts') ? [] : [p.slice(base.length + 1)]; });
const want = files(src);
if (process.argv.includes('--check')) {
  const have = existsSync(dest) ? files(dest) : [];
  const bad = want.filter((f) => !have.includes(f) || readFileSync(join(src, f), 'utf8') !== readFileSync(join(dest, f), 'utf8')).concat(have.filter((f) => !want.includes(f)));
  if (bad.length) { console.error(`vendored core is out of date: ${bad.join(', ')}. Run: npm run sync:functions`); process.exit(1); }
  console.log('vendored core is in sync');
} else {
  rmSync(dest, { recursive: true, force: true });
  for (const f of want) { mkdirSync(dirname(join(dest, f)), { recursive: true }); cpSync(join(src, f), join(dest, f)); }
  console.log(`synced ${want.length} files to supabase/functions/_shared/core`);
}
