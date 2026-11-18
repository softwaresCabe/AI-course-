// Core content model for the course. All course material is plain typed data,
// so it can be moved into a Next.js app (or a Postgres seed) unchanged.

export type QuestionType = 'mcq' | 'multi' | 'numeric' | 'short';

export interface BaseQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  points?: number; // default 1 (short answers default 4)
  explanation: string; // shown after grading
  topic?: string;
}

export interface MCQ extends BaseQuestion {
  type: 'mcq';
  options: string[];
  answer: number; // index into options
}

export interface MultiSelect extends BaseQuestion {
  type: 'multi';
  options: string[];
  answer: number[]; // all correct indices; partial credit = (correct picks - wrong picks) / total correct, floored at 0
}

export interface Numeric extends BaseQuestion {
  type: 'numeric';
  answer: number;
  tolerance: number; // relative tolerance, e.g. 0.05 = ±5%
  unit?: string;
}

export interface ShortAnswer extends BaseQuestion {
  type: 'short';
  rubric: string[]; // each bullet = equal share of points
  modelAnswer: string;
}

export type Question = MCQ | MultiSelect | Numeric | ShortAnswer;

export interface Section {
  heading: string;
  body: string; // markdown
}

export interface Reading {
  title: string;
  author: string;
  url?: string;
  kind: 'paper' | 'book' | 'docs' | 'video' | 'blog' | 'course';
  required?: boolean;
}

export interface Lab {
  title: string;
  goal: string;
  hours: number;
  stack: string;
  steps: string[];
  deliverables: string[];
  rubric: { item: string; points: number }[];
  stretch: string[];
}

export interface Flashcard {
  q: string;
  a: string;
}

export interface Week {
  n: number;
  phase: 1 | 2 | 3 | 4;
  title: string;
  tagline: string;
  hours: number;
  objectives: string[];
  sections: Section[];
  lab: Lab;
  readings: Reading[];
  checklist: string[];
  flashcards: Flashcard[];
  quiz: Question[];
}

export interface Exam {
  id: 'midterm' | 'final';
  title: string;
  description: string;
  timeLimitMin: number;
  coversWeeks: number[];
  questions: Question[];
}

export interface FuturePath {
  title: string;
  why: string;
  problems: string[];
  firstSteps: string[];
  resources: Reading[];
}
