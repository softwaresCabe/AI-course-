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

React + TypeScript + Tailwind CSS, built with Vite into a **single self-contained HTML file** (`vite-plugin-singlefile`) so the whole course runs as one shareable page with no server. All course material is plain typed data in `src/content/` (markdown lecture files + TypeScript modules), so it drops straight into a Next.js app or a Postgres seed.

```
src/
  content/
    types.ts          # content model (Week, Lab, Question, Exam…)
    weeks/wNN.md      # lecture notes
    weeks/wNN.ts      # objectives, lab, readings, checklist, flashcards, quiz
    exams.ts          # midterm + final
    future.ts         # future-of-AI paths
    course.ts         # syllabus, grading weights, policies
  lib/
    grading.ts        # auto-grading (MC, partial-credit multi-select, numeric tolerance)
    store.tsx         # progress state: localStorage + optional account sync
    runtime.ts        # optional Claude artifact runtime (AI TA, AI grading, sync)
    scores.ts         # gradebook math
  components/         # QuizRunner, TutorChat, Markdown
  pages/              # Home, WeekPage, ExamPage, Gradebook, Syllabus, FuturePage
```

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # → dist/index.html (single file)
```

Progress is saved in your browser. When opened as a Claude artifact, progress also syncs to your account and the AI TA / AI grading light up; elsewhere the app falls back to self-grading.

## Academic honesty

Exams are closed-book and AI-free by design — the interview won't let you use notes either. Labs: use any tools you like, but be able to explain every line, and write the eval before the feature.
