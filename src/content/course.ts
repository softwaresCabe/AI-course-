import type { Week, Question } from './types';
import w01 from './weeks/w01';
import w02 from './weeks/w02';
import w03 from './weeks/w03';
import w04 from './weeks/w04';
import w05 from './weeks/w05';
import w06 from './weeks/w06';
import w07 from './weeks/w07';
import w08 from './weeks/w08';
import w09 from './weeks/w09';
import w10 from './weeks/w10';
import w11 from './weeks/w11';
import w12 from './weeks/w12';
import w13 from './weeks/w13';
export { midterm, finalExam } from './exams';
export { futurePaths } from './future';

export const weeks: Week[] = [w01, w02, w03, w04, w05, w06, w07, w08, w09, w10, w11, w12, w13];

export const course = {
  code: 'AIE 600',
  title: 'AI Engineering: From First Principles to Production',
  subtitle: 'A 13-week, graduate-level course in how modern AI systems work and how to build them.',
  prerequisites: 'Professional programming experience (Python or TypeScript), comfort with SQL and web services. High-school algebra; the math you need is taught in Week 1.',
  format: '13 weeks · ~12–16 hours/week · lectures, readings, 12 labs, weekly graded quizzes, spaced review, a midterm, a final exam and a capstone.',
  phases: [
    { n: 1, title: 'Foundations', weeks: [1, 2, 3, 4] },
    { n: 2, title: 'Transformers & LLM Internals', weeks: [5, 6, 7, 8] },
    { n: 3, title: 'AI Engineering in Production', weeks: [9, 10, 11, 12] },
    { n: 4, title: 'Capstone & Frontiers', weeks: [13] },
  ],
  // Grading weights (sum = 100)
  grading: [
    { key: 'quizzes', label: 'Weekly quizzes (13)', weight: 20, note: 'Best attempt counts. Retakes allowed (questions reshuffle) — but wait a day and re-study first.' },
    { key: 'labs', label: 'Labs (12)', weight: 25, note: 'Scored against each lab’s rubric. Self-assess honestly or ask the AI TA to review your write-up.' },
    { key: 'midterm', label: 'Midterm exam', weight: 15, note: 'Weeks 1–6, 90 minutes, one attempt.' },
    { key: 'final', label: 'Final exam', weight: 20, note: 'Cumulative, 150 minutes, one attempt.' },
    { key: 'capstone', label: 'Capstone project', weight: 20, note: 'Scored against the capstone rubric.' },
  ],
  letterScale: [
    { min: 93, letter: 'A' }, { min: 90, letter: 'A−' }, { min: 87, letter: 'B+' }, { min: 83, letter: 'B' },
    { min: 80, letter: 'B−' }, { min: 77, letter: 'C+' }, { min: 73, letter: 'C' }, { min: 70, letter: 'C−' },
    { min: 60, letter: 'D' }, { min: 0, letter: 'F' },
  ],
  policies: [
    'Mastery threshold: score ≥ 80% on a weekly quiz to mark the week mastered. Below that, review the flagged checklist items and retake.',
    'Exams are closed-book and AI-free. Using AI on exams defeats the purpose — the interview won’t allow it either.',
    'Labs: use any tools you like, including AI coding assistants, but you must be able to explain every line. Write the eval before the feature.',
    'Spaced review: each week, complete the Review session (questions from earlier weeks) before starting new material.',
    'Certificate of completion requires: overall ≥ 70%, all 13 quizzes ≥ 80%, midterm and final taken, capstone submitted.',
  ],
};

/** All quiz questions from weeks before `n`, for spaced review. */
export function reviewPool(n: number): { week: number; q: Question }[] {
  return weeks.filter((w) => w.n < n).flatMap((w) => w.quiz.filter((q) => q.type !== 'short').map((q) => ({ week: w.n, q })));
}
