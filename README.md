# AIE 600 — AI Engineering: From First Principles to Production

A 13-week, graduate-level course in how modern AI systems work and how to build them — sold as a web app with lectures, labs, graded quizzes, a timed midterm and final, spaced review, a gradebook, an **AI tutor agent** that students pay for with tokens, and a **course MCP server** they can plug into Claude Code or Claude Desktop.

## Business model: start free, buy to continue

| Tier | What's included |
|---|---|
| **Anonymous** | Overview, syllabus, pricing, and **all of Week 1** (lecture, lab, quiz, review) — no account needed. Progress is saved in the browser. |
| **Free account** (Clerk) | **Week 2**, progress synced to the account, **50k starter AI-tutor tokens**. Anonymous progress carries over on first sign-in. |
| **Full course** (one-time Stripe payment, default $199) | Weeks 3–13, the midterm and final, capstone, certificate checklist, the course MCP server, and **1M bundled tutor tokens**. Lifetime access. |
| **Tutor token packs** | 1M / 3M / 10M tokens (default $10 / $25 / $70). Never expire. |

Why this shape: Week 1 proves the teaching quality with zero friction; Week 2 converts visitors into accounts you can email; the paywall sits at Week 3, right as the course moves from foundations into neural networks, before the high-value LLM-internals and production weeks. A one-time price fits a course better than a subscription. Token packs make the AI tutor sustainable: its cost scales with use, so it's metered rather than "unlimited".

**Tutor tokens** are input-equivalent tokens: one token = one uncached input token; output (including thinking) counts 5×, cache writes 1.25×, cache reads 0.1× — the same ratios as the Claude price list, so the balance tracks real cost. At the default model price ($4/M input), 1M tutor tokens cost about $4 of API usage, and a typical tutor question uses 5–15k.

All prices, bundles and grants are environment variables (see `.env.example`).

## Features

- **Gated content.** The browser only receives a public catalog (titles, objectives, section headings). Lecture bodies, labs, flashcards, quizzes and exams are served by `/api/content/*` after an entitlement check. `npm run build` fails if paid content ever reaches the client bundle (`scripts/check-bundle.mjs`).
- **Auth** with Clerk (`proxy.ts`, `app/client-app.tsx`). Admins (`ADMIN_EMAILS` / `ADMIN_USER_IDS`, verified emails only) get full, unmetered access — use this for your own study account.
- **Payments** with Stripe Checkout (`server/billing.ts`). Fulfilment is idempotent per checkout session and runs from the webhook *and* the success page, so access unlocks immediately. Full refunds and disputes revoke the course and claw back the tokens that purchase granted.
- **Token ledger** (`server/ledger.ts`). Atomic hold → model call → release + usage, under a row lock (no double-spend from parallel requests). The ledger always sums to the balance, and holds orphaned by a crash are released automatically.
- **AI tutor agent** (`server/tutor.ts`). A Claude tool-use loop, streamed to the browser, over the course tools in `server/tools.ts`: `search_course`, `read_section`, `get_lab`, `get_week_materials`, `list_weeks`, `get_my_progress`, `get_missed_questions`. The tools enforce entitlements themselves (a free user's tutor can't read paid weeks), never return quiz answers, and don't cover exams. Uses prompt caching, adaptive thinking, server-side refusal fallbacks, an iteration cap and per-user rate limits.
- **Course MCP server** (`/api/mcp`, `server/mcp.ts`). The same tools over Streamable HTTP, on the v2 MCP TypeScript SDK (`@modelcontextprotocol/server`, which Week 11 teaches). Students who own the course create personal API keys on their Account page:
  ```bash
  claude mcp add --transport http aie600 https://<your-domain>/api/mcp --header "Authorization: Bearer aie_…"
  ```
  Keys are stored as SHA-256 hashes, revocable, capped at 10 per user, and never grant more than the owner currently has.
- **Rubric grading** of written answers (`/api/grade`). The prompt is built server-side from the stored question (no open proxy to the model), uses structured outputs, is included with access and is rate limited.
- **Open mode** for personal study: with no Clerk keys in `npm run dev` (or `OPEN_ACCESS=true`), everything is unlocked and unmetered. A production build without Clerk keys **fails closed**.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind · Postgres · Clerk · Stripe · Anthropic SDK · MCP TypeScript SDK v2 · Vitest · Playwright.

| Path | What |
|---|---|
| `app/` | Next.js entry, layout (Clerk provider), API routes |
| `server/` | Server-only logic: config, viewer/entitlements, content gating, ledger, billing, tutor, tools, MCP, search |
| `src/` | The course UI (React) and all course content as typed data (`src/content/weeks/wNN.md` + `wNN.ts`) |
| `src/platform/` | Two backends for the same UI: `server-backend.ts` (the product) and `local-backend.ts` (single-file artifact build) |
| `db/schema.sql` | Idempotent schema |
| `tests/` | Vitest: content integrity (every quiz/exam answer key), grading, catalog/search, and Postgres-backed ledger, billing/webhook, API, MCP and tutor-agent tests |
| `e2e/` | Playwright: walks all 13 weeks in a production build; verifies a misconfigured production deployment fails closed |

## Run it locally

```bash
npm install
cp .env.example .env.local      # everything is optional for local study
npm run dev                     # http://localhost:3000 — open mode if Clerk keys are absent
```

To use it as the paid product locally: fill in the Clerk, Stripe, Anthropic and `DATABASE_URL` values, run `npm run db:migrate`, and forward webhooks with `stripe listen --forward-to localhost:3000/api/stripe/webhook` (use the `whsec_…` it prints as `STRIPE_WEBHOOK_SECRET`).

## Tests

```bash
npm run typecheck && npm run lint
TEST_DATABASE_URL=postgres://…/course_test npm test       # DB suites are skipped without it
npm run build && E2E_DATABASE_URL=postgres://…/course_e2e npm run test:e2e
npm run ci                                                 # typecheck, lint, tests, build, artifact build
```

Use disposable databases for `TEST_DATABASE_URL` and `E2E_DATABASE_URL`: the tests truncate them.

## Deploy (e.g. Vercel + Neon)

1. Create a Postgres database and set `DATABASE_URL`; run `npm run db:migrate` (re-run on each deploy; it's idempotent).
2. Create a Clerk application (enable the sign-in methods you want, e.g. Google OAuth and email) and set both Clerk keys. Add your production domain in Clerk.
3. In Stripe, set `STRIPE_SECRET_KEY`, add a webhook endpoint at `https://<domain>/api/stripe/webhook` with the four events listed in `.env.example`, and set `STRIPE_WEBHOOK_SECRET`. Set `NEXT_PUBLIC_SITE_URL` to your domain.
4. Set `ANTHROPIC_API_KEY`, plus `ADMIN_EMAILS` with your own email.
5. Set `SUPPORT_EMAIL` and decide your refund policy (the pricing page links to the support address; it makes no refund promise by itself).
6. Check `GET /api/health`: `{"ok":true,"database":"ok","auth":true,"openAccess":false,…}`.

Never set `OPEN_ACCESS=true` on a public deployment that has an Anthropic key: it unlocks everything and makes the tutor free for anyone.

### Single-file build (Claude artifact)

`npm run build:artifact` emits `dist/index.html`: the whole course as one self-contained page for personal study. It bundles all content (no paywall), and uses the Claude artifact runtime for the tutor, grading and sync.

## Known limits

- Quiz and exam grading runs in the learner's browser, and progress is learner-writable JSON. That's fine for a self-paced course, but the gradebook and certificate checklist are self-reported. Issuing verifiable certificates would need server-side grading and attempt storage.
- Signed-in learners who own the course receive answer keys with the quiz payload (needed for client-side grading).
- Clerk's hosted UI needs real keys, so sign-in itself is covered by the Clerk stub in the API tests, not by the browser E2E run.

## Academic honesty

Exams are closed-book and AI-free by design, and the tutor and MCP tools won't help with them. Labs: use any tools you like, but be able to explain every line, and write the eval before the feature.
