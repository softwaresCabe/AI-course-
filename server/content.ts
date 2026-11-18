// Server-side access to the full course content. This module (and anything importing it) must only
// be imported by server code — it is what keeps paid lectures out of the browser bundle.
import 'server-only';
import { weeks, midterm, finalExam } from '../src/content/course';
import { buildCatalog } from '../src/content/catalog';
import type { Exam, Question, ShortAnswer, Week } from '../src/content/types';
import { EXAM_ACCESS, canAccess, denial, weekAccess, type Entitlement } from '../src/lib/access';

export { weeks, midterm, finalExam };
export const exams: Exam[] = [midterm, finalExam];
export const publicCatalog = buildCatalog(weeks, exams);

export const weekByN = (n: number): Week | undefined => weeks.find((w) => w.n === n);
export const examById = (id: string): Exam | undefined => exams.find((e) => e.id === id);

export type Where = { kind: 'week'; week: number } | { kind: 'exam'; exam: Exam['id'] };
const questionIndex = new Map<string, { q: Question; where: Where }>();
for (const w of weeks) for (const q of w.quiz) questionIndex.set(q.id, { q, where: { kind: 'week', week: w.n } });
for (const e of exams) for (const q of e.questions) questionIndex.set(q.id, { q, where: { kind: 'exam', exam: e.id } });

export const questionById = (id: string) => questionIndex.get(id);

export function weekDenied(n: number, e: Entitlement) {
  return denial(weekAccess(n), e);
}
export function examDenied(e: Entitlement) {
  return denial(EXAM_ACCESS, e);
}
export const canReadWeek = (n: number, e: Entitlement) => canAccess(weekAccess(n), e);

/** Objective quiz questions from earlier weeks (the viewer can open), for spaced review. */
export function reviewPool(n: number, e: Entitlement) {
  return weeks.filter((w) => w.n < n && canReadWeek(w.n, e)).flatMap((w) => w.quiz.filter((q) => q.type !== 'short').map((q) => ({ week: w.n, q })));
}

/** Can this viewer have this question graded? Only questions from content they can open. */
export function canGrade(id: string, e: Entitlement): ShortAnswer | null {
  const hit = questionIndex.get(id);
  if (!hit || hit.q.type !== 'short') return null;
  const ok = hit.where.kind === 'week' ? canReadWeek(hit.where.week, e) : !examDenied(e);
  return ok ? hit.q : null;
}
