// Tiny in-memory BM25 over lecture sections and labs — the course is ~150k words, so no external index.
import { weeks } from './content';

export interface Doc {
  id: string;
  week: number;
  kind: 'section' | 'lab';
  section?: number;
  heading: string;
  text: string;
}

const STOP = new Set('a an and are as at be by for from has have how i in is it its of on or that the this to was what when where which why with you your we can do does not'.split(' '));
export const tokenize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[`*_#>|[\]()]/g, ' ')
    .split(/[^a-z0-9+.-]+/)
    .map((t) => t.replace(/^[.-]+|[.-]+$/g, ''))
    .filter((t) => t.length > 1 && !STOP.has(t));

const docs: Doc[] = weeks.flatMap((w) => [
  ...w.sections.map((s, i) => ({ id: `w${w.n}-s${i}`, week: w.n, kind: 'section' as const, section: i, heading: s.heading, text: s.body })),
  { id: `w${w.n}-lab`, week: w.n, kind: 'lab' as const, heading: w.lab.title, text: [w.lab.goal, ...w.lab.steps, ...w.lab.deliverables].join('\n') },
]);

const tf = docs.map((d) => {
  const m = new Map<string, number>();
  for (const t of tokenize(d.heading + ' ' + d.heading + ' ' + d.text)) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
});
const lens = tf.map((m) => [...m.values()].reduce((s, x) => s + x, 0));
const avgLen = lens.reduce((s, x) => s + x, 0) / lens.length;
const df = new Map<string, number>();
for (const m of tf) for (const t of m.keys()) df.set(t, (df.get(t) ?? 0) + 1);

export function search(query: string, opts: { limit?: number; filter?: (d: Doc) => boolean } = {}) {
  const q = [...new Set(tokenize(query))];
  const k1 = 1.2,
    b = 0.75,
    N = docs.length;
  const scored = docs
    .map((d, i) => {
      let s = 0;
      for (const t of q) {
        const f = tf[i].get(t);
        if (!f) continue;
        const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
        s += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * lens[i]) / avgLen));
      }
      return { d, s };
    })
    .filter((x) => x.s > 0 && (!opts.filter || opts.filter(x.d)))
    .sort((a, b) => b.s - a.s)
    .slice(0, opts.limit ?? 6);
  return scored.map(({ d, s }) => ({ ...d, score: Math.round(s * 100) / 100, snippet: snippet(d.text, q) }));
}

function snippet(text: string, terms: string[], width = 320) {
  const lower = text.toLowerCase();
  let at = -1;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  const start = Math.max(0, (at < 0 ? 0 : at) - 80);
  const s = text.slice(start, start + width).replace(/\s+/g, ' ').trim();
  return (start > 0 ? '…' : '') + s + (start + width < text.length ? '…' : '');
}
