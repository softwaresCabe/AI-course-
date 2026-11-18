import { weeks, course, midterm, finalExam } from '../content/course';
import type { Progress } from './store';
import { letterFor, pointsOf } from './grading';

export function bestQuiz(p: Progress, n: number) {
  const atts = p.quizzes['w' + n] ?? [];
  if (!atts.length) return null;
  return atts.reduce((b, a) => (a.earned / a.max > b.earned / b.max ? a : b));
}

export function quizPct(p: Progress, n: number): number | null {
  const b = bestQuiz(p, n);
  return b ? (100 * b.earned) / b.max : null;
}

export function labPct(p: Progress, n: number): number | null {
  const rec = p.labs['w' + n];
  if (!rec?.submitted) return null;
  const w = weeks.find((x) => x.n === n)!;
  const max = w.lab.rubric.reduce((s, r) => s + r.points, 0);
  const got = rec.rubric.reduce((s, x) => s + (x || 0), 0);
  return (100 * got) / max;
}

export function examPct(p: Progress, id: 'midterm' | 'final'): number | null {
  const a = p.exams[id];
  return a ? (100 * a.earned) / a.max : null;
}

export function examMax(id: 'midterm' | 'final') {
  return (id === 'midterm' ? midterm : finalExam).questions.reduce((s, q) => s + pointsOf(q), 0);
}

export function weekProgress(p: Progress, n: number) {
  const w = weeks.find((x) => x.n === n)!;
  const read = w.sections.filter((_, i) => p.read[`w${n}-s${i}`]).length;
  const checks = w.checklist.filter((_, i) => p.checklist[`w${n}-c${i}`]).length;
  const q = quizPct(p, n);
  const lab = p.labs['w' + n]?.submitted ? 1 : 0;
  const parts = [read / w.sections.length, checks / w.checklist.length, q === null ? 0 : Math.min(1, q / 80), lab];
  return { read, checks, quiz: q, lab: !!lab, pct: Math.round((100 * parts.reduce((s, x) => s + x, 0)) / parts.length), mastered: q !== null && q >= 80 };
}

/** Weighted course grade.
 * running: each component averaged over the work completed so far (what you're "on track" for).
 * final: missing work counts as zero. */
export function courseGrade(p: Progress) {
  const quizzes = weeks.map((w) => quizPct(p, w.n)).filter((x): x is number => x !== null);
  const labs = weeks.filter((w) => w.n < 13).map((w) => labPct(p, w.n)).filter((x): x is number => x !== null);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const comp: Record<string, number | null> = {
    quizzes: mean(quizzes),
    labs: mean(labs),
    midterm: examPct(p, 'midterm'),
    final: examPct(p, 'final'),
    capstone: labPct(p, 13),
  };
  const finalComp: Record<string, number> = {
    quizzes: sum(quizzes) / weeks.length,
    labs: sum(labs) / 12,
    midterm: comp.midterm ?? 0,
    final: comp.final ?? 0,
    capstone: comp.capstone ?? 0,
  };
  let earned = 0;
  let weightSeen = 0;
  let final = 0;
  for (const g of course.grading) {
    const v = comp[g.key];
    final += (finalComp[g.key] * g.weight) / 100;
    if (v !== null && v !== undefined) {
      earned += (v * g.weight) / 100;
      weightSeen += g.weight;
    }
  }
  const running = weightSeen ? (100 * earned) / weightSeen : null;
  return { comp, running, final, letterRunning: running === null ? '—' : letterFor(running, course.letterScale), weightSeen };
}

export function certificateStatus(p: Progress) {
  const g = courseGrade(p);
  const allQuizzes = weeks.every((w) => (quizPct(p, w.n) ?? 0) >= 80);
  return {
    overall: g.final >= 70,
    allQuizzes,
    exams: !!p.exams.midterm && !!p.exams.final,
    capstone: !!p.labs['w13']?.submitted,
  };
}
