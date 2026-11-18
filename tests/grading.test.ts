import { describe, expect, it } from 'vitest';
import { gradeQuestion, parseNumber, shuffle, withinTolerance } from '../src/lib/grading';
import type { MCQ, MultiSelect, Numeric, ShortAnswer } from '../src/content/types';
import { normaliseGrade } from '../src/lib/prompts';

const mcq: MCQ = { id: 'a', type: 'mcq', prompt: 'p', options: ['x', 'y'], answer: 1, explanation: 'e' };
const multi: MultiSelect = { id: 'b', type: 'multi', prompt: 'p', options: ['1', '2', '3', '4'], answer: [0, 2], points: 2, explanation: 'e' };
const num: Numeric = { id: 'c', type: 'numeric', prompt: 'p', answer: 1.31, tolerance: 0.03, explanation: 'e' };
const short: ShortAnswer = { id: 'd', type: 'short', prompt: 'p', rubric: ['r1', 'r2', 'r3', 'r4'], modelAnswer: 'm', explanation: 'e' };

describe('gradeQuestion', () => {
  it('grades MCQ', () => {
    expect(gradeQuestion(mcq, 1)).toMatchObject({ earned: 1, correct: true });
    expect(gradeQuestion(mcq, 0)).toMatchObject({ earned: 0, correct: false });
    expect(gradeQuestion(mcq, null)).toMatchObject({ earned: 0 });
  });
  it('gives partial credit on select-all, with wrong picks cancelling right ones', () => {
    expect(gradeQuestion(multi, [0, 2]).earned).toBe(2);
    expect(gradeQuestion(multi, [0]).earned).toBe(1);
    expect(gradeQuestion(multi, [0, 1]).earned).toBe(0);
    expect(gradeQuestion(multi, [0, 1, 2, 3]).earned).toBe(0);
    expect(gradeQuestion(multi, []).earned).toBe(0);
  });
  it('grades numeric answers within relative tolerance, accepting common formats', () => {
    expect(gradeQuestion(num, '1.31').correct).toBe(true);
    expect(gradeQuestion(num, '1.34').correct).toBe(true);
    expect(gradeQuestion(num, '1.35').correct).toBe(false); // 3.05% off
    expect(gradeQuestion(num, '1.4').correct).toBe(false);
    expect(gradeQuestion(num, 'abc').correct).toBe(false);
    expect(gradeQuestion(num, '').correct).toBe(false);
    // A blank answer must not match a key of zero.
    expect(gradeQuestion({ ...num, answer: 0, tolerance: 0.01 }, '').correct).toBe(false);
    expect(gradeQuestion({ ...num, answer: 0, tolerance: 0.01 }, '0').correct).toBe(true);
  });
  it('leaves short answers pending until rubric scores arrive', () => {
    expect(gradeQuestion(short, 'text').pending).toBe(true);
    expect(gradeQuestion(short, 'text', [1, 1, 0.5, 0]).earned).toBe(2.5);
    expect(gradeQuestion(short, 'text', [1, 1, 1, 0]).correct).toBe(true);
  });
});

describe('parseNumber', () => {
  it.each([
    ['1,234', 1234],
    ['1.2e3', 1200],
    ['58k', 58000],
    ['1.5M', 1.5e6],
    ['2b', 2e9],
    ['12%', 12],
    ['$0.02', 0.02],
    [' 7 ', 7],
    ['-3.5', -3.5],
    ['1.2×10^3', 1200],
  ])('%s → %d', (s, n) => expect(parseNumber(s)).toBeCloseTo(n));
  it('rejects junk', () => {
    expect(parseNumber('')).toBeNaN();
    expect(parseNumber('twelve')).toBeNaN();
  });
});

describe('helpers', () => {
  it('tolerance at zero is absolute', () => {
    expect(withinTolerance(0.001, 0, 0.01)).toBe(true);
    expect(withinTolerance(0.1, 0, 0.01)).toBe(false);
  });
  it('shuffle is a deterministic permutation', () => {
    const a = [1, 2, 3, 4, 5, 6];
    expect(shuffle(a, 42).sort()).toEqual(a);
    expect(shuffle(a, 42)).toEqual(shuffle(a, 42));
  });
  it('normaliseGrade snaps scores to the rubric', () => {
    expect(normaliseGrade(short, { scores: [1, 0.7, 2, 'x'], feedback: 'ok' }).scores).toEqual([1, 0.5, 1, 0]);
    expect(normaliseGrade(short, { scores: [1] }).scores).toEqual([1, 0, 0, 0]);
    expect(normaliseGrade(short, {}).feedback).toBe('');
  });
});
