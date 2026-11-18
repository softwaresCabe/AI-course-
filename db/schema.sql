-- AIE 600 database schema (Postgres 13+). Idempotent: safe to run on every deploy.
--   npm run db:migrate

-- One row per Clerk user (id = Clerk user id, e.g. "user_2abc…").
CREATE TABLE IF NOT EXISTS users (
  id          text PRIMARY KEY,
  email       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Course progress as a JSONB document (the client's Progress object).
CREATE TABLE IF NOT EXISTS course_progress (
  learner_id  text PRIMARY KEY,
  data        jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Full-course ownership. A row with revoked_at set (refund/chargeback) no longer grants access.
CREATE TABLE IF NOT EXISTS entitlements (
  user_id     text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  source      text NOT NULL,            -- 'stripe:<checkout session id>' | 'admin'
  granted_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz
);

-- Every completed checkout (course or token pack).
CREATE TABLE IF NOT EXISTS purchases (
  id                 bigserial PRIMARY KEY,
  user_id            text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product            text NOT NULL,
  stripe_session_id  text NOT NULL UNIQUE,
  payment_intent     text,
  amount_cents       integer NOT NULL,
  currency           text NOT NULL,
  tokens             bigint NOT NULL DEFAULT 0,
  refunded_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS purchases_payment_intent ON purchases (payment_intent);

-- AI tutor token balance (fast, atomic check-and-reserve) …
CREATE TABLE IF NOT EXISTS token_balances (
  user_id  text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance  bigint NOT NULL DEFAULT 0
);

-- … and the append-only ledger that explains it. (reason, ref) makes grants idempotent.
CREATE TABLE IF NOT EXISTS token_ledger (
  id             bigserial PRIMARY KEY,
  user_id        text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta          bigint NOT NULL,
  reason         text NOT NULL,         -- signup_grant | purchase | course_bundle | usage | refund | admin
  ref            text,                  -- checkout session id, request id, …
  model          text,
  input_tokens   integer,
  output_tokens  integer,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS token_ledger_idem ON token_ledger (reason, ref) WHERE ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS token_ledger_user ON token_ledger (user_id, created_at DESC);

-- Personal API keys for the course MCP server. Only a SHA-256 hash is stored.
CREATE TABLE IF NOT EXISTS api_keys (
  id            text PRIMARY KEY,
  user_id       text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  prefix        text NOT NULL,
  hash          text NOT NULL UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);
CREATE INDEX IF NOT EXISTS api_keys_user ON api_keys (user_id);

-- Stripe webhook idempotency.
CREATE TABLE IF NOT EXISTS stripe_events (
  id           text PRIMARY KEY,
  type         text NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now()
);

-- Fixed-window rate limits (AI grading, tutor requests, MCP calls).
CREATE TABLE IF NOT EXISTS rate_limits (
  key          text NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
