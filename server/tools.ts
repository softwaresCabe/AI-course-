// Course tools — one definition shared by the AI tutor (Claude tool use) and the course MCP server.
// Every tool enforces the viewer's entitlements itself: a free user's tutor can't read paid lectures.
// Exams are deliberately absent (they are closed-book, AI-free), and no tool returns quiz answers.
import { z } from 'zod';
import { canReadWeek, publicCatalog, weekByN, weeks } from './content';
import { search } from './search';
import { loadProgress } from './progress';
import { gradeQuestion } from '../src/lib/grading';
import type { Viewer } from './viewer';
import type { Progress } from '../src/lib/store';

export interface CourseTool<S extends z.ZodObject = z.ZodObject> {
  name: string;
  description: string;
  schema: S;
  /** Short status line shown in the tutor UI while the tool runs. */
  label(input: z.infer<S>): string;
  run(input: z.infer<S>, viewer: Viewer): Promise<string>;
}

const define = <S extends z.ZodObject>(t: CourseTool<S>) => t as unknown as CourseTool;

const weekArg = z.number().int().min(1).max(weeks.length).describe('Week number, 1–13');
const LOCKED = (n: number, v: Viewer) =>
  JSON.stringify({ locked: true, week: n, reason: v.signedIn ? 'This week is part of the full course, which the student has not purchased.' : 'This week requires a free account.' });

export const courseTools: CourseTool[] = [
  define({
    name: 'list_weeks',
    description: 'List all 13 weeks of the course with titles, taglines, learning objectives, section headings, and whether the student can open each week.',
    schema: z.object({}),
    label: () => 'Browsing the syllabus',
    async run(_, v) {
      return JSON.stringify(
        publicCatalog.weeks.map((w) => ({
          week: w.n,
          title: w.title,
          tagline: w.tagline,
          objectives: w.objectives,
          sections: w.sectionHeadings.map((h, i) => ({ index: i, heading: h })),
          lab: w.lab.title,
          accessible: canReadWeek(w.n, v),
        })),
      );
    },
  }),
  define({
    name: 'search_course',
    description:
      'Keyword search over lecture sections and lab instructions the student can access. Returns the best-matching sections with snippets; use read_section to get the full text. Prefer specific technical terms ("KV cache", "LoRA rank", "cross-entropy").',
    schema: z.object({ query: z.string().min(2).max(200), limit: z.number().int().min(1).max(10).optional() }),
    label: (i) => `Searching the course for “${i.query.slice(0, 40)}”`,
    async run({ query, limit }, v) {
      const hits = search(query, { limit: limit ?? 6, filter: (d) => canReadWeek(d.week, v) });
      const lockedWeeks = [...new Set(search(query, { limit: 10 }).filter((d) => !canReadWeek(d.week, v)).map((d) => d.week))];
      return JSON.stringify({
        results: hits.map((h) => ({ week: h.week, kind: h.kind, section: h.section, heading: h.heading, snippet: h.snippet })),
        ...(lockedWeeks.length ? { alsoCoveredInLockedWeeks: lockedWeeks } : {}),
      });
    },
  }),
  define({
    name: 'read_section',
    description: 'Read the full text (markdown) of one lecture section. Sections are numbered from 0 within a week (see list_weeks).',
    schema: z.object({ week: weekArg, section: z.number().int().min(0).max(30).describe('0-based section index') }),
    label: (i) => `Reading Week ${i.week}, section ${i.section + 1}`,
    async run({ week, section }, v) {
      if (!canReadWeek(week, v)) return LOCKED(week, v);
      const s = weekByN(week)?.sections[section];
      if (!s) return JSON.stringify({ error: `Week ${week} has no section ${section}` });
      return `# Week ${week} · ${s.heading}\n\n${s.body}`;
    },
  }),
  define({
    name: 'get_lab',
    description: 'Get a week’s lab (or the Week 13 capstone): goal, stack, step-by-step instructions, deliverables, grading rubric and stretch goals.',
    schema: z.object({ week: weekArg }),
    label: (i) => `Opening the Week ${i.week} ${i.week === 13 ? 'capstone' : 'lab'}`,
    async run({ week }, v) {
      if (!canReadWeek(week, v)) return LOCKED(week, v);
      return JSON.stringify(weekByN(week)!.lab);
    },
  }),
  define({
    name: 'get_week_materials',
    description: 'Get a week’s topic checklist, flashcards and readings (titles, authors, links).',
    schema: z.object({ week: weekArg }),
    label: (i) => `Checking Week ${i.week} materials`,
    async run({ week }, v) {
      if (!canReadWeek(week, v)) return LOCKED(week, v);
      const w = weekByN(week)!;
      return JSON.stringify({ checklist: w.checklist, flashcards: w.flashcards, readings: w.readings });
    },
  }),
  define({
    name: 'get_my_progress',
    description:
      'Get the student’s own progress: sections read, checklist topics not yet ticked, best quiz score per week, lab status and exams taken. Use it to personalise help ("what should I review?").',
    schema: z.object({}),
    label: () => 'Looking at your progress',
    async run(_, v) {
      const p = v.userId ? await loadProgress(v.userId) : null;
      if (!p) return JSON.stringify({ available: false, note: 'No saved progress yet (or progress is only stored in the browser).' });
      return JSON.stringify(summarise(p));
    },
  }),
  define({
    name: 'get_missed_questions',
    description:
      'For a week, list the quiz questions the student got wrong or partly wrong in their most recent attempt — question text and topic only, never the answer. Use this to find their gaps; teach the concept, do not reveal the answer.',
    schema: z.object({ week: weekArg }),
    label: (i) => `Reviewing your Week ${i.week} quiz`,
    async run({ week }, v) {
      if (!canReadWeek(week, v)) return LOCKED(week, v);
      const p = v.userId ? await loadProgress(v.userId) : null;
      const attempts = p?.quizzes?.['w' + week] ?? [];
      const last = attempts[attempts.length - 1];
      if (!last) return JSON.stringify({ attempted: false });
      const w = weekByN(week)!;
      const missed = w.quiz.filter((q) => {
        const r = last.perQuestion?.[q.id] ?? gradeQuestion(q, (last.answers?.[q.id] as never) ?? null);
        return r.earned < r.max;
      });
      return JSON.stringify({
        attempted: true,
        score: `${last.earned}/${last.max}`,
        missed: missed.map((q) => ({ topic: q.topic ?? null, type: q.type, question: q.prompt, ...('options' in q ? { options: q.options } : {}) })),
      });
    },
  }),
];

export const toolByName = new Map(courseTools.map((t) => [t.name, t]));

function summarise(p: Progress) {
  return {
    weeks: publicCatalog.weeks.map((w) => {
      const atts = p.quizzes?.['w' + w.n] ?? [];
      const best = atts.reduce<number | null>((b, a) => Math.max(b ?? 0, Math.round((100 * a.earned) / a.max)), null);
      const lab = p.labs?.['w' + w.n];
      return {
        week: w.n,
        title: w.title,
        sectionsRead: `${w.sectionHeadings.filter((_, i) => p.read?.[`w${w.n}-s${i}`]).length}/${w.sectionHeadings.length}`,
        checklistNotYetTicked: w.checklist.filter((_, i) => !p.checklist?.[`w${w.n}-c${i}`]),
        bestQuizPct: best,
        quizAttempts: atts.length,
        lab: lab?.submitted ? 'submitted' : lab ? 'in progress' : 'not started',
      };
    }),
    exams: { midterm: p.exams?.midterm ? 'taken' : 'not taken', final: p.exams?.final ? 'taken' : 'not taken' },
  };
}
