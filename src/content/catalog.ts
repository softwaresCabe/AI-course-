// The public catalog: everything the UI needs to render navigation, the syllabus, the gradebook and
// progress math — without shipping lecture bodies, lab steps, flashcards or quiz questions to the browser.
import type { Exam, Question, Week } from './types';
import { EXAM_ACCESS, weekAccess, type AccessLevel } from '../lib/access';

export interface CatalogWeek {
  n: number;
  phase: Week['phase'];
  title: string;
  tagline: string;
  hours: number;
  objectives: string[];
  sectionHeadings: string[];
  checklist: string[];
  lab: { title: string; hours: number; rubric: Week['lab']['rubric'] };
  quiz: { count: number; points: number };
  readingCount: number;
  access: AccessLevel;
}

export interface CatalogExam {
  id: Exam['id'];
  title: string;
  description: string;
  timeLimitMin: number;
  coversWeeks: number[];
  questionCount: number;
  typeCounts: Partial<Record<Question['type'], number>>;
  maxPoints: number;
  shortPoints: number;
  access: AccessLevel;
}

export interface Catalog {
  weeks: CatalogWeek[];
  exams: Record<Exam['id'], CatalogExam>;
}

const pts = (q: Question) => q.points ?? (q.type === 'short' ? 4 : 1);

export function buildCatalog(weeks: Week[], exams: Exam[]): Catalog {
  return {
    weeks: weeks.map((w) => ({
      n: w.n,
      phase: w.phase,
      title: w.title,
      tagline: w.tagline,
      hours: w.hours,
      objectives: w.objectives,
      sectionHeadings: w.sections.map((s) => s.heading),
      checklist: w.checklist,
      lab: { title: w.lab.title, hours: w.lab.hours, rubric: w.lab.rubric },
      quiz: { count: w.quiz.length, points: w.quiz.reduce((s, q) => s + pts(q), 0) },
      readingCount: w.readings.length,
      access: weekAccess(w.n),
    })),
    exams: Object.fromEntries(
      exams.map((e) => [
        e.id,
        {
          id: e.id,
          title: e.title,
          description: e.description,
          timeLimitMin: e.timeLimitMin,
          coversWeeks: e.coversWeeks,
          questionCount: e.questions.length,
          typeCounts: e.questions.reduce<Partial<Record<Question['type'], number>>>((m, q) => ((m[q.type] = (m[q.type] ?? 0) + 1), m), {}),
          maxPoints: e.questions.reduce((s, q) => s + pts(q), 0),
          shortPoints: e.questions.filter((q) => q.type === 'short').reduce((s, q) => s + pts(q), 0),
          access: EXAM_ACCESS,
        },
      ]),
    ) as Catalog['exams'],
  };
}

// The catalog is static for the lifetime of the page; it is installed once before the app renders.
let current: Catalog | null = null;
export function setCatalog(c: Catalog) {
  current = c;
}
export function catalog(): Catalog {
  if (!current) throw new Error('catalog not initialised — call setCatalog() before rendering');
  return current;
}
export const catalogWeek = (n: number) => catalog().weeks.find((w) => w.n === n);
