import { db } from './db';
import type { Progress } from '../src/lib/store';

export async function loadProgress(learnerId: string): Promise<Progress | null> {
  const pool = db();
  if (!pool) return null;
  const { rows } = await pool.query<{ data: Progress }>('SELECT data FROM course_progress WHERE learner_id = $1', [learnerId]);
  return rows[0]?.data ?? null;
}

const MAX = 1_000_000;

/** Validate the shape loosely (it's the learner's own data) and cap size. */
export function validProgress(x: unknown): x is Progress {
  if (!x || typeof x !== 'object') return false;
  const p = x as Record<string, unknown>;
  if (p.version !== 1) return false;
  for (const k of ['read', 'checklist', 'quizzes', 'exams', 'examStarted', 'labs', 'review']) {
    if (p[k] !== undefined && (typeof p[k] !== 'object' || p[k] === null || Array.isArray(p[k]))) return false;
  }
  return JSON.stringify(x).length <= MAX;
}

export async function saveProgress(learnerId: string, data: Progress) {
  const pool = db();
  if (!pool) throw new Error('no database');
  await pool.query(
    `INSERT INTO course_progress (learner_id, data, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (learner_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [learnerId, data],
  );
}
