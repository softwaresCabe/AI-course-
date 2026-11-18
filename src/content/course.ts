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

export { course } from './meta';

/** All quiz questions from weeks before `n`, for spaced review. */
export function reviewPool(n: number): { week: number; q: Question }[] {
  return weeks.filter((w) => w.n < n).flatMap((w) => w.quiz.filter((q) => q.type !== 'short').map((q) => ({ week: w.n, q })));
}
