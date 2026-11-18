-- Progress store for the Next.js deployment (Postgres).
-- Run once: psql "$DATABASE_URL" -f db/schema.sql
CREATE TABLE IF NOT EXISTS course_progress (
  learner_id  text PRIMARY KEY,
  data        jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
