import type { Question } from '../content/types';

export type Answer = number | number[] | string | null;

export interface QResult {
  id: string;
  earned: number;
  max: number;
  correct: boolean;
  pending?: boolean; // short answer awaiting grading
  feedback?: string;
  rubricScores?: number[]; // 0..1 per rubric item
}

export function pointsOf(q: Question): number {
  return q.points ?? (q.type === 'short' ? 4 : 1);
}

/** Auto-grade objective questions. Short answers return pending unless rubricScores provided. */
export function gradeQuestion(q: Question, a: Answer, rubricScores?: number[]): QResult {
  const max = pointsOf(q);
  switch (q.type) {
    case 'mcq': {
      const ok = a === q.answer;
      return { id: q.id, earned: ok ? max : 0, max, correct: ok };
    }
    case 'multi': {
      const picked = Array.isArray(a) ? a : [];
      const right = picked.filter((i) => q.answer.includes(i)).length;
      const wrong = picked.filter((i) => !q.answer.includes(i)).length;
      const frac = Math.max(0, (right - wrong) / q.answer.length);
      return { id: q.id, earned: round(frac * max), max, correct: frac === 1 };
    }
    case 'numeric': {
      const v = typeof a === 'string' ? parseNumber(a) : typeof a === 'number' ? a : NaN;
      const ok = Number.isFinite(v) && withinTolerance(v, q.answer, q.tolerance);
      return { id: q.id, earned: ok ? max : 0, max, correct: ok };
    }
    case 'short': {
      if (!rubricScores) return { id: q.id, earned: 0, max, correct: false, pending: true };
      const frac = rubricScores.reduce((s, x) => s + x, 0) / q.rubric.length;
      return { id: q.id, earned: round(frac * max), max, correct: frac >= 0.75, rubricScores };
    }
  }
}

export function withinTolerance(v: number, target: number, tol: number): boolean {
  if (target === 0) return Math.abs(v) <= tol;
  return Math.abs(v - target) <= Math.abs(target) * tol;
}

/** Accept "1,234", "1.2e3", "58k", "12%" (as 12), "$0.02" */
export function parseNumber(s: string): number {
  let t = s.trim().toLowerCase().replace(/[,$\s]/g, '').replace(/%$/, '');
  let mult = 1;
  if (/[kmb]$/.test(t)) {
    mult = { k: 1e3, m: 1e6, b: 1e9 }[t.slice(-1) as 'k' | 'm' | 'b'];
    t = t.slice(0, -1);
  }
  t = t.replace(/×10\^?/, 'e').replace(/x10\^?/, 'e');
  const n = Number(t);
  return Number.isFinite(n) ? n * mult : NaN;
}

function round(x: number) {
  return Math.round(x * 100) / 100;
}

export function letterFor(pct: number, scale: { min: number; letter: string }[]) {
  return scale.find((s) => pct >= s.min)?.letter ?? 'F';
}

export function shuffle<T>(arr: T[], seed = Date.now()): T[] {
  const a = arr.slice();
  let s = seed % 2147483647;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
