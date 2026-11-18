// Fails if paid course content leaks into the browser bundle (.next/static).
// Run after `next build` (npm run build does this automatically).
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const staticDir = join(root, '.next', 'static');
if (!existsSync(staticDir)) {
  console.error('check-bundle: .next/static not found — run next build first');
  process.exit(1);
}

const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|html|json|txt)$/.test(f)) files.push(p);
  }
})(staticDir);
const bundle = files.map((f) => readFileSync(f, 'utf8')).join('\n');

// Probes: distinctive lines from every paid lecture, plus exam and quiz prompts.
const probes = [];
const weeksDir = join(root, 'src', 'content', 'weeks');
for (let n = 3; n <= 13; n++) {
  const md = readFileSync(join(weeksDir, `w${String(n).padStart(2, '0')}.md`), 'utf8');
  const lines = md.split('\n').filter((l) => l.length > 80 && !l.startsWith('#') && !l.startsWith('|') && !l.startsWith('```'));
  for (const l of lines.filter((_, i) => i % 7 === 0)) probes.push({ where: `week ${n} lecture`, text: l.slice(0, 60) });
}
for (const f of ['exams.ts', ...[...Array(11)].map((_, i) => `weeks/w${String(i + 3).padStart(2, '0')}.ts`)]) {
  const src = readFileSync(join(root, 'src', 'content', f), 'utf8');
  for (const m of src.matchAll(/prompt: '((?:[^'\\]|\\.){40,})'/g)) probes.push({ where: f, text: m[1].slice(0, 50).replace(/\\'/g, "'") });
}

// Strings in the bundle may be JSON-escaped; check both forms.
const leaks = probes.filter((p) => bundle.includes(p.text) || bundle.includes(JSON.stringify(p.text).slice(1, -1)));
if (leaks.length) {
  console.error(`check-bundle: ${leaks.length}/${probes.length} paid-content probes found in the client bundle:`);
  for (const l of leaks.slice(0, 10)) console.error(`  [${l.where}] ${l.text}`);
  process.exit(1);
}
console.log(`check-bundle: OK — none of ${probes.length} paid-content probes are in the client bundle (${files.length} files).`);
