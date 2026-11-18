import { useMemo, useState } from 'react';
import { catalogWeek } from '../content/catalog';
import type { Week } from '../content/types';
import { useContent, usePlatform } from '../lib/platform';
import { Paywall } from '../components/Paywall';
import { useStore } from '../lib/store';
import { Markdown, Inline } from '../components/Markdown';
import { QuizRunner } from '../components/QuizRunner';
import { TutorChat } from '../components/TutorChat';
import { bestQuiz, weekProgress, labPct } from '../lib/scores';
import { shuffle } from '../lib/grading';
import { go } from '../router';

const TABS = ['Lecture', 'Lab', 'Readings', 'Checklist', 'Review', 'Quiz', 'AI tutor'] as const;
type Tab = (typeof TABS)[number];

export function WeekPage({ n }: { n: number }) {
  const meta = catalogWeek(n)!;
  const { content, me } = usePlatform();
  // Re-request when entitlements change (sign-in, purchase).
  const state = useContent(() => content.week(n), [n, me?.signedIn, me?.paid]);
  const week = state.data;
  const [tab, setTab] = useState<Tab>('Lecture');
  const { p } = useStore();
  const prog = weekProgress(p, n);

  return (
    <div>
      <header className="mb-5">
        <div className="kicker">
          Week {meta.n} · Phase {meta.phase} · ~{meta.hours} hrs
        </div>
        <h1 className="mt-1 font-serif text-3xl font-bold leading-tight sm:text-4xl">{meta.title}</h1>
        <p className="mt-2 text-ink-soft">{meta.tagline}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="chip bg-paper-line">
            Read {prog.read}/{meta.sectionHeadings.length}
          </span>
          <span className="chip bg-paper-line">
            Checklist {prog.checks}/{meta.checklist.length}
          </span>
          <span className={`chip ${prog.mastered ? 'bg-emerald-100 text-emerald-800' : 'bg-paper-line'}`}>Quiz {prog.quiz === null ? '—' : Math.round(prog.quiz) + '%'}</span>
          <span className={`chip ${prog.lab ? 'bg-emerald-100 text-emerald-800' : 'bg-paper-line'}`}>{n === 13 ? 'Capstone' : 'Lab'} {prog.lab ? 'submitted' : 'open'}</span>
        </div>
      </header>

      {state.locked && (
        <div className="space-y-6">
          <Paywall reason={state.locked} what={`Week ${n}`} />
          <section className="card p-5">
            <div className="kicker mb-2">What you’ll learn</div>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {meta.objectives.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
            <div className="kicker mb-2 mt-5">Lecture outline</div>
            <ol className="space-y-1 text-sm text-ink-soft">
              {meta.sectionHeadings.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ol>
            <div className="mt-5 text-sm text-ink-soft">
              <span className="font-medium text-ink">{meta.lab.title}</span> · ~{meta.lab.hours} hrs · graded quiz ({meta.quiz.count} questions)
            </div>
          </section>
        </div>
      )}
      {state.loading && <div className="card animate-pulse p-8 text-sm text-ink-mute">Loading Week {n}…</div>}
      {state.error && <div className="card p-5 text-sm text-red-700">Couldn’t load this week. Check your connection and reload.</div>}

      {week && (<>
      <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-paper-line px-4">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${tab === t ? 'border-brand text-brand' : 'border-transparent text-ink-mute hover:text-ink'}`}>
            {t === 'Lab' && n === 13 ? 'Capstone' : t}
          </button>
        ))}
      </nav>

      {tab === 'Lecture' && <Lecture week={week} />}
      {tab === 'Lab' && <LabView week={week} />}
      {tab === 'Readings' && <Readings week={week} />}
      {tab === 'Checklist' && <Checklist week={week} />}
      {tab === 'Review' && <Review week={week} />}
      {tab === 'Quiz' && <WeekQuiz week={week} />}
      {tab === 'AI tutor' && <TutorChat week={week} />}
      </>)}

      <div className="mt-10 flex justify-between border-t border-paper-line pt-4 text-sm">
        {n > 1 ? (
          <button className="text-brand" onClick={() => go(`week-${n - 1}`)}>
            ← Week {n - 1}
          </button>
        ) : (
          <span />
        )}
        {n === 6 && (
          <button className="text-brand" onClick={() => go('midterm')}>
            Midterm →
          </button>
        )}
        {n < 13 && n !== 6 && (
          <button className="text-brand" onClick={() => go(`week-${n + 1}`)}>
            Week {n + 1} →
          </button>
        )}
        {n === 13 && (
          <button className="text-brand" onClick={() => go('final')}>
            Final exam →
          </button>
        )}
      </div>
    </div>
  );
}

function Lecture({ week }: { week: Week }) {
  const { p, update } = useStore();
  return (
    <div className="space-y-8">
      <section className="card p-5">
        <div className="kicker mb-2">Learning objectives</div>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {week.objectives.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </section>
      {week.sections.map((s, i) => {
        const key = `w${week.n}-s${i}`;
        return (
          <section key={key} id={`sec-${i}`}>
            <h2 className="mb-2 font-serif text-2xl font-semibold">{s.heading}</h2>
            <Markdown src={s.body} />
            <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-ink-mute">
              <input type="checkbox" className="accent-brand" checked={!!p.read[key]} onChange={(e) => update((d) => void (d.read[key] = e.target.checked))} />
              Mark section as read
            </label>
          </section>
        );
      })}
      <div className="card flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-ink-soft">Finished reading? Do the lab, tick the checklist, then take the graded quiz.</div>
      </div>
    </div>
  );
}

function LabView({ week }: { week: Week }) {
  const { p, update } = useStore();
  const lab = week.lab;
  const key = 'w' + week.n;
  const rec = p.labs[key] ?? { rubric: lab.rubric.map(() => 0) };
  const max = lab.rubric.reduce((s, r) => s + r.points, 0);
  const got = rec.rubric.reduce((s, x) => s + (x || 0), 0);
  const pct = labPct(p, week.n);

  function patch(fn: (r: typeof rec) => void) {
    update((d) => {
      const r = d.labs[key] ?? { rubric: lab.rubric.map(() => 0) };
      fn(r);
      d.labs[key] = r;
    });
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-serif text-2xl font-semibold">{lab.title}</h2>
        <p className="mt-2 text-ink-soft">{lab.goal}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="chip bg-paper-line">~{lab.hours} hrs</span>
          <span className="chip bg-paper-line">{lab.stack}</span>
        </div>
      </section>
      <section className="card p-5">
        <div className="kicker mb-2">Steps</div>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
          {lab.steps.map((s) => (
            <li key={s}>
              <Inline text={s} />
            </li>
          ))}
        </ol>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <div className="kicker mb-2">Deliverables</div>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {lab.deliverables.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <div className="kicker mb-2">Stretch goals</div>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {lab.stretch.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </section>
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="kicker">Grading rubric · self-assessment</div>
            <div className="text-sm text-ink-mute">Award yourself points honestly per criterion. Partial credit is fine.</div>
          </div>
          <div className="text-right font-mono text-lg">
            {got}/{max}
          </div>
        </div>
        <div className="space-y-3">
          {lab.rubric.map((r, i) => (
            <div key={r.item} className="flex flex-col gap-2 border-t border-paper-line pt-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm">{r.item}</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={r.points}
                  step={Math.max(1, Math.round(r.points / 10))}
                  value={rec.rubric[i] ?? 0}
                  onChange={(e) => patch((x) => void (x.rubric[i] = Number(e.target.value)))}
                  className="w-36 accent-brand"
                />
                <span className="w-14 text-right font-mono text-sm">
                  {rec.rubric[i] ?? 0}/{r.points}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input className="input" placeholder="Repo / notebook URL" value={rec.repoUrl ?? ''} onChange={(e) => patch((x) => void (x.repoUrl = e.target.value))} />
          <input className="input" placeholder="Notes (what you learned, what broke)" value={rec.notes ?? ''} onChange={(e) => patch((x) => void (x.notes = e.target.value))} />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-ink-mute">{pct !== null ? `Recorded: ${Math.round(pct)}%` : 'Not yet submitted'}</span>
          <button className="btn-primary" onClick={() => patch((x) => void (x.submitted = !x.submitted))}>
            {rec.submitted ? 'Reopen' : 'Submit lab grade'}
          </button>
        </div>
      </section>
    </div>
  );
}

function Readings({ week }: { week: Week }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-mute">Required readings are marked. Read papers in three passes: abstract + figures → method → details you need for the lab.</p>
      {week.readings.map((r) => (
        <div key={r.title} className="card flex items-start justify-between gap-3 p-4">
          <div>
            <div className="font-medium">{r.url ? <a className="text-brand underline-offset-2 hover:underline" href={r.url} target="_blank" rel="noreferrer">{r.title}</a> : r.title}</div>
            <div className="text-sm text-ink-mute">{r.author}</div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="chip bg-paper-line capitalize">{r.kind}</span>
            {r.required && <span className="chip bg-brand-soft text-brand-deep">Required</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Checklist({ week }: { week: Week }) {
  const { p, update } = useStore();
  const done = week.checklist.filter((_, i) => p.checklist[`w${week.n}-c${i}`]).length;
  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center justify-between">
        <div className="kicker">Topics covered</div>
        <span className="font-mono text-sm">
          {done}/{week.checklist.length}
        </span>
      </div>
      <p className="mb-4 text-sm text-ink-mute">Tick a topic only when you could explain it to an interviewer without notes.</p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-line">
        <div className="h-full bg-brand transition-all" style={{ width: `${(100 * done) / week.checklist.length}%` }} />
      </div>
      <ul className="mt-4 space-y-2">
        {week.checklist.map((c, i) => {
          const key = `w${week.n}-c${i}`;
          return (
            <li key={key}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-paper">
                <input type="checkbox" className="mt-1 accent-brand" checked={!!p.checklist[key]} onChange={(e) => update((d) => void (d.checklist[key] = e.target.checked))} />
                <span className={`text-sm ${p.checklist[key] ? 'text-ink-mute line-through' : ''}`}>{c}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Review({ week }: { week: Week }) {
  const { p, update } = useStore();
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const [session, setSession] = useState(0);
  const { content } = usePlatform();
  const poolState = useContent(() => (week.n > 1 ? content.review(week.n) : Promise.resolve([])), [week.n]);
  const pool = useMemo(() => poolState.data ?? [], [poolState.data]);
  const picks = useMemo(() => {
    // Spaced retrieval: weight questions you've missed and older weeks you haven't revisited.
    const scored = pool.map(({ week: wn, q }) => {
      const s = p.review[q.id];
      const miss = s ? 1 - s.correct / s.seen : 0.6;
      const recency = wn === week.n - 1 ? 1.2 : wn >= week.n - 3 ? 1 : 0.8;
      return { wn, q, w: (miss + 0.2) * recency * (0.5 + seeded(q.id, session)) };
    });
    return scored.sort((a, b) => b.w - a.w).slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, session, week.n]);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-serif text-2xl font-semibold">Flashcards</h2>
        <p className="mb-3 text-sm text-ink-mute">Try to answer aloud before flipping.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {week.flashcards.map((f, i) => (
            <button key={i} onClick={() => setFlipped((s) => ({ ...s, [i]: !s[i] }))} className={`card min-h-[7rem] p-4 text-left transition ${flipped[i] ? 'bg-brand-soft/50' : ''}`}>
              <div className="kicker mb-1">{flipped[i] ? 'Answer' : 'Question'}</div>
              <div className="text-sm">{flipped[i] ? f.a : f.q}</div>
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2 className="font-serif text-2xl font-semibold">Spaced review</h2>
        {week.n === 1 ? (
          <p className="text-sm text-ink-mute">Spaced review starts in Week 2 — it pulls questions from earlier weeks, prioritizing ones you missed.</p>
        ) : poolState.loading ? (
          <p className="text-sm text-ink-mute">Loading review questions…</p>
        ) : !picks.length ? (
          <p className="text-sm text-ink-mute">Review questions couldn’t be loaded right now.</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-ink-mute">8 questions from Weeks 1–{week.n - 1}, weighted toward ones you’ve missed. Not graded — it trains retention.</p>
            <QuizRunner
              key={session}
              questions={picks.map((x) => x.q)}
              labelFor={(q) => `Week ${picks.find((x) => x.q.id === q.id)?.wn}`}
              onComplete={(a) =>
                update((d) => {
                  for (const [id, r] of Object.entries(a.perQuestion)) {
                    const s = d.review[id] ?? { seen: 0, correct: 0 };
                    s.seen += 1;
                    s.correct += r.earned === r.max ? 1 : 0;
                    d.review[id] = s;
                  }
                })
              }
            />
            <button className="btn-ghost mt-4" onClick={() => setSession((s) => s + 1)}>
              New review set
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function WeekQuiz({ week }: { week: Week }) {
  const { p, update } = useStore();
  const [attemptKey, setAttemptKey] = useState<number | null>(null);
  const attempts = p.quizzes['w' + week.n] ?? [];
  const best = bestQuiz(p, week.n);
  const questions = useMemo(() => shuffle(week.quiz, attemptKey ?? 1), [week.quiz, attemptKey]);

  if (attemptKey === null)
    return (
      <div className="space-y-4">
        <div className="card p-5">
          <div className="kicker mb-1">Graded quiz · Week {week.n}</div>
          <div className="font-serif text-xl font-semibold">{week.quiz.length} questions · {week.quiz.reduce((s, q) => s + (q.points ?? (q.type === 'short' ? 4 : 1)), 0)} points</div>
          <p className="mt-2 text-sm text-ink-soft">Closed-book. Multiple choice, select-all, numeric (calculator OK) and one written answer graded against a rubric. Score ≥ 80% to master the week. Your best attempt counts toward 20% of the course grade.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className="btn-primary" onClick={() => setAttemptKey(Date.now())}>
              {attempts.length ? 'Retake quiz' : 'Start quiz'}
            </button>
            {best && <span className="text-sm text-ink-mute">Best: {Math.round((100 * best.earned) / best.max)}% · {attempts.length} attempt{attempts.length > 1 ? 's' : ''}</span>}
          </div>
        </div>
        {attempts.length > 0 && (
          <div className="card p-5">
            <div className="kicker mb-2">Attempt history</div>
            <ul className="space-y-1 text-sm">
              {attempts.map((a, i) => (
                <li key={i} className="flex justify-between">
                  <span>{new Date(a.date).toLocaleString()}</span>
                  <span className="font-mono">
                    {a.earned}/{a.max} ({Math.round((100 * a.earned) / a.max)}%)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );

  return (
    <div>
      <QuizRunner
        key={attemptKey}
        title={`Week ${week.n} quiz`}
        questions={questions}
        onComplete={(a) =>
          update((d) => {
            d.quizzes['w' + week.n] = [...(d.quizzes['w' + week.n] ?? []), a];
          })
        }
      />
      <button className="btn-ghost mt-4" onClick={() => setAttemptKey(null)}>
        Back to quiz overview
      </button>
    </div>
  );
}

function seeded(id: string, s: number) {
  let h = 2166136261 ^ s;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}
