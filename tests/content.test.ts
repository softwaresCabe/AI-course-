// Integrity checks over every week, quiz and exam. These catch broken answer keys, missing
// explanations, bad links and numbering drift before a learner does.
import { describe, expect, it } from 'vitest';
import { weeks, midterm, finalExam } from '../src/content/course';
import { course } from '../src/content/meta';
import type { Question } from '../src/content/types';
import { pointsOf } from '../src/lib/grading';

const exams = [midterm, finalExam];
const allQuestions: { where: string; q: Question }[] = [
  ...weeks.flatMap((w) => w.quiz.map((q) => ({ where: `week ${w.n}`, q }))),
  ...exams.flatMap((e) => e.questions.map((q) => ({ where: e.id, q }))),
];

describe('course structure', () => {
  it('has 13 consecutively numbered weeks in the declared phases', () => {
    expect(weeks.map((w) => w.n)).toEqual([...Array(13)].map((_, i) => i + 1));
    for (const ph of course.phases) for (const n of ph.weeks) expect(weeks[n - 1].phase).toBe(ph.n);
    expect(course.phases.flatMap((p) => p.weeks).sort((a, b) => a - b)).toEqual(weeks.map((w) => w.n));
  });

  it('grading weights sum to 100 and the letter scale is descending', () => {
    expect(course.grading.reduce((s, g) => s + g.weight, 0)).toBe(100);
    const mins = course.letterScale.map((s) => s.min);
    expect([...mins].sort((a, b) => b - a)).toEqual(mins);
    expect(mins.at(-1)).toBe(0);
  });

  for (const w of weeks) {
    describe(`week ${w.n}: ${w.title}`, () => {
      it('has lecture sections numbered N.1, N.2, … with real bodies', () => {
        expect(w.sections.length).toBeGreaterThanOrEqual(5);
        w.sections.forEach((s, i) => {
          expect(s.heading, `section ${i}`).toMatch(new RegExp(`^${w.n}\\.${i + 1}\\s+\\S`));
          expect(s.body.length, s.heading).toBeGreaterThan(/summary/i.test(s.heading) ? 150 : 300);
          expect(s.body, `${s.heading} should not contain an h1/h2 heading`).not.toMatch(/^#{1,2} /m);
        });
      });

      it('has objectives, checklist, flashcards and readings', () => {
        expect(w.objectives.length).toBeGreaterThanOrEqual(3);
        expect(w.checklist.length).toBeGreaterThanOrEqual(8);
        expect(new Set(w.checklist).size).toBe(w.checklist.length);
        expect(w.flashcards.length).toBeGreaterThanOrEqual(4);
        for (const f of w.flashcards) expect(f.q.trim() && f.a.trim()).toBeTruthy();
        expect(w.readings.some((r) => r.required)).toBe(true);
        for (const r of w.readings) if (r.url) expect(() => new URL(r.url!), r.url).not.toThrow(), expect(r.url).toMatch(/^https:\/\//);
      });

      it('has a complete lab with a 100-point rubric', () => {
        const lab = w.lab;
        expect(lab.title).toMatch(w.n === 13 ? /^Capstone/ : new RegExp(`^Lab ${w.n} — `));
        expect(lab.steps.length).toBeGreaterThanOrEqual(4);
        expect(lab.deliverables.length).toBeGreaterThanOrEqual(1);
        expect(lab.rubric.reduce((s, r) => s + r.points, 0)).toBe(100);
        for (const r of lab.rubric) expect(r.points).toBeGreaterThan(0);
        expect(lab.hours).toBeLessThanOrEqual(w.n === 13 ? 40 : w.hours);
      });

      it('has a quiz with at least one written question', () => {
        expect(w.quiz.length).toBeGreaterThanOrEqual(5);
        expect(w.quiz.some((q) => q.type === 'short')).toBe(true);
      });
    });
  }
});

describe('every question (weekly quizzes + exams)', () => {
  it('has a globally unique id', () => {
    const ids = allQuestions.map((x) => x.q.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  for (const { where, q } of allQuestions) {
    it(`${where} · ${q.id} has a valid answer key`, () => {
      expect(q.prompt.trim().length).toBeGreaterThan(10);
      expect(q.explanation.trim().length).toBeGreaterThan(5);
      expect(pointsOf(q)).toBeGreaterThan(0);
      switch (q.type) {
        case 'mcq':
          expect(q.options.length).toBeGreaterThanOrEqual(2);
          expect(new Set(q.options).size, 'duplicate options').toBe(q.options.length);
          expect(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length).toBe(true);
          break;
        case 'multi':
          expect(q.answer.length).toBeGreaterThanOrEqual(1);
          expect(new Set(q.answer).size).toBe(q.answer.length);
          expect(new Set(q.options).size, 'duplicate options').toBe(q.options.length);
          for (const a of q.answer) expect(a >= 0 && a < q.options.length).toBe(true);
          break;
        case 'numeric':
          expect(Number.isFinite(q.answer)).toBe(true);
          expect(q.tolerance).toBeGreaterThan(0);
          expect(q.tolerance).toBeLessThanOrEqual(0.25);
          break;
        case 'short':
          expect(q.rubric.length).toBeGreaterThanOrEqual(2);
          expect(q.modelAnswer.trim().length).toBeGreaterThan(40);
          break;
      }
    });
  }
});

describe('exams', () => {
  it('midterm covers weeks 1–6 and the final is cumulative', () => {
    expect(midterm.coversWeeks).toEqual([1, 2, 3, 4, 5, 6]);
    expect(finalExam.coversWeeks).toEqual(weeks.map((w) => w.n));
  });
  it('have realistic time limits for their length', () => {
    for (const e of exams) {
      const pts = e.questions.reduce((s, q) => s + pointsOf(q), 0);
      expect(e.timeLimitMin / pts, e.id).toBeGreaterThan(1); // > 1 minute per point
    }
  });
});
