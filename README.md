# AIE 600 — AI Engineering: From First Principles to Production

A 13-week (~3-month), graduate-level course in how modern AI systems work and how to build them — packaged as a web app with lectures, labs, graded quizzes, a timed midterm and final, topic checklists, spaced review, a gradebook, and an AI teaching assistant.

## What's inside

| | |
|---|---|
| **13 weeks** | Foundations (math, ML, neural nets, tokens/attention) → Transformers & LLM internals (architecture, pretraining & scaling, post-training, inference) → AI engineering (prompting & tools, RAG on Postgres/pgvector, agents & MCP, evals/security/alignment/LLMOps) → Frontiers, capstone & career |
| **Lectures** | Written lecture notes per week with worked examples and code (Python + TypeScript) |
| **12 labs + capstone** | From a NumPy toolkit and a from-scratch autograd engine, through nanoGPT, LoRA/DPO fine-tuning, a vLLM load test, a Next.js tool-using agent, multi-tenant RAG on pgvector, an MCP server, to a full eval/red-team harness. Each has a points rubric. |
| **Assessment** | 13 weekly quizzes (MC, select-all, numeric, written), a 90-min midterm, a 150-min cumulative final. Objective questions auto-grade; written answers are graded against a rubric by the AI TA (or self-graded against a model answer when AI isn't available). |
| **Review** | Per-week flashcards + spaced-retrieval review sets drawn from earlier weeks, weighted toward questions you've missed |
| **Checklists** | A "topics covered" checklist for every week |
| **Gradebook** | Weighted grade (quizzes 20%, labs 25%, midterm 15%, final 20%, capstone 20%), letter grade, certificate requirements |
| **Future of AI** | Eight concrete paths to contribute (reliable agents, eval science, interpretability, alignment, security, efficient/local AI, applied AI for underserved industries, governance) with first projects |

## Stack

**Next.js 16 (App Router) + TypeScript + Tailwind CSS + Postgres**, with the Anthropic SDK for the AI teaching assistant.

| Piece | What it does |
|---|---|
| `app/` | Next.js app: the course UI (client component) plus API routes |
| `app/api/progress` | Saves/loads your progress as JSONB in Postgres (`db/schema.sql`) |
| `app/api/ai` | AI TA chat (streamed) and rubric grading of written answers via the Anthropic API |
| `app/api/health` | Tells the UI which server features are configured |
| `src/content/` | All course material as typed data: `weeks/wNN.md` lectures + `weeks/wNN.ts` (objectives, lab, readings, checklist, flashcards, quiz), `exams.ts`, `future.ts`, `course.ts` |
| `src/lib/` | Auto-grading (MC, partial-credit select-all, numeric tolerance), gradebook math, progress store |
| `src/views/`, `src/components/` | Pages and UI (QuizRunner, TutorChat, Markdown) |

Every server feature is optional: with no `DATABASE_URL`, progress stays in the browser; with no `ANTHROPIC_API_KEY`, written answers are self-graded against the model answer and rubric.

```
src/content/weeks/wNN.md  ──(npm run content)──▶  lectures.generated.ts  ──▶  Next.js app / artifact build
```

## Run it

```bash
npm install
cp .env.example .env.local          # fill in DATABASE_URL and ANTHROPIC_API_KEY (both optional)
npm run db:init                     # creates the course_progress table
npm run dev                         # http://localhost:3000
```

Deploy: push to GitHub → import into **Vercel** → add the env vars (use a Railway/Neon Postgres for `DATABASE_URL`) → set `COURSE_ACCESS_TOKEN` and enter it once in the Gradebook on each device.

### Single-file build (Claude artifact)

`npm run build:artifact` uses Vite to emit `dist/index.html`, the whole course as one self-contained page. When opened as a Claude artifact it uses the artifact runtime for sync and the AI TA instead of the API routes.

## Academic honesty

Exams are closed-book and AI-free by design — the interview won't let you use notes either. Labs: use any tools you like, but be able to explain every line, and write the eval before the feature.
