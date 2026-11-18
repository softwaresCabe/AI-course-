import { describe, expect, it } from 'vitest';
import { publicCatalog, weeks, midterm, finalExam } from '../server/content';
import { search } from '../server/search';
import { canAccess, denial, weekAccess } from '../src/lib/access';

describe('access policy', () => {
  it('week 1 public, week 2 free account, the rest paid', () => {
    expect(weeks.map((w) => weekAccess(w.n))).toEqual(['public', 'account', ...Array(11).fill('paid')]);
  });
  it('maps to the right denial', () => {
    expect(denial('public', { signedIn: false, paid: false })).toBeNull();
    expect(denial('account', { signedIn: false, paid: false })).toBe('signin_required');
    expect(denial('paid', { signedIn: false, paid: false })).toBe('signin_required');
    expect(denial('paid', { signedIn: true, paid: false })).toBe('purchase_required');
    expect(canAccess('paid', { signedIn: true, paid: true })).toBe(true);
  });
});

describe('public catalog', () => {
  const json = JSON.stringify(publicCatalog);
  it('contains no lecture bodies, lab steps, flashcards or questions', () => {
    for (const w of weeks) {
      for (const s of w.sections) expect(json.includes(s.body.slice(0, 120))).toBe(false);
      for (const step of w.lab.steps) expect(json.includes(step)).toBe(false);
      for (const f of w.flashcards) expect(json.includes(f.a)).toBe(false);
      for (const q of w.quiz) expect(json.includes(q.prompt)).toBe(false);
    }
    for (const q of [...midterm.questions, ...finalExam.questions]) expect(json.includes(q.prompt)).toBe(false);
  });
  it('still has what the UI needs for navigation and grading math', () => {
    expect(publicCatalog.weeks).toHaveLength(13);
    expect(publicCatalog.weeks[2].sectionHeadings.length).toBe(weeks[2].sections.length);
    expect(publicCatalog.exams.midterm.maxPoints).toBe(midterm.questions.reduce((s, q) => s + (q.points ?? (q.type === 'short' ? 4 : 1)), 0));
    expect(json.length).toBeLessThan(60_000);
  });
});

describe('course search', () => {
  it.each([
    ['KV cache memory per token', 8],
    ['LoRA low-rank adapters', 7],
    ['pgvector HNSW index', 10],
    ['Model Context Protocol server', 11],
    ['prompt injection', 12],
    ['backpropagation chain rule', 3],
    ['scaling laws Chinchilla', 6],
    ['byte pair encoding tokenizer', 4],
  ])('“%s” → week %d', (q, w) => {
    expect(search(q, { limit: 3 }).map((h) => h.week)).toContain(w);
  });
  it('respects the filter (only accessible weeks)', () => {
    const hits = search('attention', { filter: (d) => d.week <= 2 });
    expect(hits.every((h) => h.week <= 2)).toBe(true);
  });
  it('returns nothing for stopwords / empty queries', () => {
    expect(search('the and of')).toEqual([]);
  });
});
