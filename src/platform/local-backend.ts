// Backend for the single-file Claude artifact build: all content is bundled (no paywall — the artifact is
// a personal study copy), AI comes from the artifact runtime, progress from the artifact database.
import { weeks, midterm, finalExam, reviewPool } from '../content/course';
import { getCapability } from '../lib/runtime';
import { gradingPrompt, normaliseGrade } from '../lib/prompts';
import type { Backend, Me } from '../lib/platform';

export function localBackend(): Backend {
  return {
    content: {
      week: async (n) => {
        const w = weeks.find((x) => x.n === n);
        if (!w) throw new Error('no such week');
        return w;
      },
      exam: async (id) => (id === 'midterm' ? midterm : finalExam),
      review: async (n) => reviewPool(n),
    },
    ai: {
      async tutor(week, messages, onEvent, signal) {
        const sample = await getCapability('sample');
        if (!sample) {
          onEvent({ type: 'error', code: 'ai_unavailable', message: 'The AI tutor runs when this course is opened as a Claude artifact or on the hosted course site.' });
          return;
        }
        const system = artifactTutorPrompt(week);
        const convo = [{ role: 'user' as const, content: system + '\n\n---\nStudent: ' + messages[0].content }, ...messages.slice(1)];
        let last = '';
        await sample(convo, {
          onText: ({ text }: { text: string }) => {
            onEvent({ type: 'text', text: text.slice(last.length) });
            last = text;
          },
          signal,
          cache: false,
        });
      },
      async grade(q, answer) {
        const sample = await getCapability('sample');
        if (!sample) return null;
        const out = (await sample.json(gradingPrompt(q, answer) + '\n\nRespond with JSON only: {"scores": [...], "feedback": "..."}', { modelTier: 'default' })) as {
          scores?: unknown;
          feedback?: unknown;
        };
        return normaliseGrade(q, out);
      },
    },
    // The artifact database, keyed by the viewer's artifact user id. Throws when absent → browser-only.
    progress: (() => {
      let ref: Promise<{ get: () => Promise<unknown>; set: (d: unknown) => Promise<void> }> | null = null;
      const doc = () =>
        (ref ??= (async () => {
          const [db, user] = await Promise.all([getCapability('db'), getCapability('user')]);
          if (!db || !user) throw new Error('no artifact database');
          return db.collection('data/users/' + (await user.id())).doc('progress');
        })());
      return {
        async get() {
          const snap = await (await doc()).get();
          const v = snap && (typeof (snap as { data?: unknown }).data === 'function' ? (snap as { data: () => unknown }).data() : snap);
          return v ?? null;
        },
        async put(d: unknown) {
          await (await doc()).set(d);
        },
      };
    })(),
    async loadMe(): Promise<Me> {
      const ai = !!(await getCapability('sample'));
      return { mode: 'artifact', signedIn: true, paid: true, admin: false, tokens: null, features: { ai, db: false, payments: false, mcp: false }, products: [] };
    },
  };
}

function artifactTutorPrompt(week: (typeof weeks)[number]) {
  return `You are the AI tutor for "AIE 600: AI Engineering", a graduate-level course. The student is a professional software engineer studying Week ${week.n}: ${week.title}.

Teaching style: Socratic when the student is working on a problem (hints before full solutions, especially for lab and quiz questions — never give away quiz answers outright); direct and precise when they ask for an explanation. Use concrete examples, small worked numbers and short code (Python or TypeScript). Correct misconceptions clearly. Say when a detail may have changed recently. Keep answers under ~250 words unless asked for more. Plain text only (no markdown headings).

THIS WEEK'S LECTURE NOTES:
${week.sections.map((s) => `## ${s.heading}\n${s.body}`).join('\n\n')}`;
}
