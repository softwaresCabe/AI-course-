import type { Section } from './types';

/** Split a lecture markdown file into sections on level-2 headings ("## "). */
export function sections(md: string): Section[] {
  const out: Section[] = [];
  const parts = md.split(/^## /m).filter((p) => p.trim().length > 0);
  for (const part of parts) {
    const nl = part.indexOf('\n');
    out.push({ heading: part.slice(0, nl).trim(), body: part.slice(nl + 1).trim() });
  }
  return out;
}
