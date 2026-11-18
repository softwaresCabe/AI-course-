import type { Week } from '../types';
import { lectures } from './lectures.generated';
import { sections } from '../md';

const week: Week = {
  n: 13,
  phase: 4,
  title: 'Frontiers, Capstone & Career Launch',
  tagline: 'Ship your flagship project, take the final, and plan your contribution to the future of AI.',
  hours: 16,
  objectives: [
    'Discuss current frontiers: multimodality, computer use, reasoning, efficiency, synthetic data, governance',
    'Map the AI-engineer role to the skills in this course',
    'Ship and present a production-grade capstone with evals and cost analysis',
    'Prepare for coding, fundamentals, AI system design and behavioral interviews',
    'Build a sustainable system for staying current',
  ],
  sections: sections(lectures.w13),
  lab: {
    title: 'Capstone — A production-grade AI feature in one of your products',
    goal: 'Design, build, evaluate and present an AI system that would survive real customers. This is your portfolio flagship.',
    hours: 30,
    stack: 'Your choice — recommended: Next.js + TypeScript + Postgres/pgvector + an LLM API, deployed on Vercel/Railway, with tracing',
    steps: [
      'Pick a project (suggestions): (A) Maître voice/text ordering agent with menu RAG, modifiers, and POS submission; (B) Forklines exception-resolution agent with an MCP server over warehouse data; (C) A multi-tenant SOP/knowledge assistant with hybrid RAG; (D) A fine-tuned small model replacing a frontier model for a high-volume task with ≥ parity on your evals.',
      'Write a 2-page design doc: problem, users, requirements (quality, latency, cost, safety), architecture diagram, data, model choices, eval plan, risks.',
      'Build the eval suite FIRST (≥ 75 cases incl. adversarial), and baseline a simple version.',
      'Build the system iteratively; run evals after every significant change and keep a changelog of metric movements.',
      'Harden: injection red team, tenant isolation, budgets, approvals, fallbacks, observability.',
      'Measure: quality (with confidence intervals), p50/p95 latency, cost per task, failure taxonomy.',
      'Deploy a demo and record a 5-minute walkthrough video. Publish a README + technical blog post.',
    ],
    deliverables: ['Design doc', 'Public (or shareable) repo with eval suite', 'Deployed demo + 5-minute video', 'Final report: metrics, cost, failures, next steps', 'Blog post'],
    rubric: [
      { item: 'Problem framing and design doc quality', points: 15 },
      { item: 'Technical depth and correctness of implementation', points: 25 },
      { item: 'Evaluation rigor (eval-first, CIs, error analysis)', points: 25 },
      { item: 'Production readiness (security, reliability, observability, cost)', points: 20 },
      { item: 'Communication (README, video, blog)', points: 15 },
    ],
    stretch: ['Get 3–5 real users (e.g. a client restaurant) to try it and report online metrics.', 'Open-source a reusable component (an MCP server, eval harness, or retrieval module).'],
  },
  readings: [
    { title: 'Denoising Diffusion Probabilistic Models', author: 'Ho, Jain, Abbeel (2020)', url: 'https://arxiv.org/abs/2006.11239', kind: 'paper' },
    { title: 'An Image is Worth 16x16 Words (ViT)', author: 'Dosovitskiy et al. (2020)', url: 'https://arxiv.org/abs/2010.11929', kind: 'paper' },
    { title: 'Learning Transferable Visual Models From Natural Language Supervision (CLIP)', author: 'Radford et al. (2021)', url: 'https://arxiv.org/abs/2103.00020', kind: 'paper', required: true },
    { title: 'AI Engineering: Building Applications with Foundation Models', author: 'Chip Huyen (O’Reilly, 2025)', kind: 'book', required: true },
    { title: 'Designing Machine Learning Systems', author: 'Chip Huyen (O’Reilly, 2022)', kind: 'book' },
    { title: 'The AI Act Explorer', author: 'Future of Life Institute', url: 'https://artificialintelligenceact.eu/', kind: 'docs' },
  ],
  checklist: [
    'Multimodal models: vision tokens, diffusion/flow models, real-time voice',
    'Computer-use and vision-language-action agents',
    'Reasoning faithfulness and verification open problems',
    'Efficiency trends and their product implications',
    'Synthetic data and model-collapse risk',
    'Open vs closed models debate',
    'AI governance landscape (EU AI Act, safety institutes, lab frameworks)',
    'AI-engineer role taxonomy',
    'Portfolio strategy',
    'AI system design interview structure',
    'Capstone design doc completed',
    'Capstone eval suite (≥75 cases) completed',
    'Capstone deployed with observability',
    'Capstone report, video and blog published',
    'Final exam completed',
  ],
  flashcards: [
    { q: 'What do diffusion models learn?', a: 'To reverse a gradual noising process — iteratively denoise random noise into data.' },
    { q: 'CLIP in one line?', a: 'Contrastively trains image and text encoders so matching image–caption pairs have similar embeddings.' },
    { q: 'AI system design answer skeleton?', a: 'Requirements → architecture → data → models → evals → safety → serving/cost → monitoring → iteration.' },
    { q: 'What makes a portfolio project convincing?', a: 'A real problem, working demo, eval numbers, cost/latency analysis and a write-up of trade-offs and failures.' },
  ],
  quiz: [
    { id: 'w13q1', type: 'mcq', prompt: 'Vision is most commonly added to a transformer LLM by:', options: ['Converting images to ASCII art', 'Encoding image patches into embedding vectors (tokens) that the model attends to', 'Training a separate RNN', 'OCR only'], answer: 1, explanation: 'ViT-style patch embeddings, often from a pretrained vision encoder plus a projection.' },
    { id: 'w13q2', type: 'mcq', prompt: '"Faithful" chain-of-thought means:', options: ['The reasoning is long', 'The stated reasoning reflects the computation that actually produced the answer', 'The answer is always correct', 'The reasoning is hidden'], answer: 1, explanation: 'A key open problem for oversight of reasoning models.' },
    { id: 'w13q3', type: 'mcq', prompt: 'Model collapse refers to:', options: ['GPU failure', 'Degradation when models are trained recursively on their own generated data without care', 'Loss spikes', 'Quantization error'], answer: 1, explanation: 'Distribution tails disappear across generations.' },
    { id: 'w13q4', type: 'mcq', prompt: 'In an AI system-design interview, which should you address explicitly that many candidates skip?', options: ['Logo design', 'Evaluation strategy and failure handling', 'Choice of IDE', 'Office location'], answer: 1, explanation: 'Evals, safety and monitoring distinguish senior answers.' },
    { id: 'w13q5', type: 'mcq', prompt: 'CLIP is trained with:', options: ['Next-token prediction only', 'A contrastive objective aligning image and text embeddings', 'RLHF', 'Masked image modeling only'], answer: 1, explanation: 'Contrastive image–text pairs.' },
    { id: 'w13q6', type: 'short', prompt: 'Outline a system design for "an AI voice-ordering agent for 1,000 independent restaurants" in 6–10 bullet points.', rubric: ['Requirements incl. latency targets, accuracy, cost, multi-tenancy', 'Architecture: streaming speech in/out, LLM with tools (menu search, cart, submit), POS integration', 'Per-tenant menu RAG / structured menu data and isolation', 'Evals (order accuracy, modifier handling), monitoring, human fallback/transfer, safety (payments, injection)'], modelAnswer: '• Requirements: sub-second response latency, ≥98% order accuracy incl. modifiers, cost per call target, 1,000 isolated tenants, graceful handoff to staff. • Telephony → streaming speech-to-text (or a realtime speech model) → LLM agent → streaming TTS. • Agent tools: search_menu, add_item(modifiers), get_cart, confirm_order, submit_to_POS, transfer_to_human; schemas validated server-side. • Menu data as structured per-tenant records (Postgres) with hybrid search for item names; tenant_id enforced in every query. • Confirmation step that reads the order back before submission; payments via tokenized links rather than reading card numbers to the model. • Evals: recorded/synthetic calls with labeled orders; metrics: order exact-match, modifier accuracy, transfer rate, latency p95. • Observability: traces per call, cost per order per tenant, alerts on error spikes. • Fallbacks: if the LLM or POS fails, transfer to staff or take a callback. • Iterate: weekly error analysis on failed calls.', explanation: 'A realistic system-design rehearsal for your target roles.' },
  ],
};

export default week;
