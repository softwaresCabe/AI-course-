import { useEffect, useMemo, useState } from 'react';
import type { Question, ShortAnswer } from '../content/types';
import { gradeQuestion, pointsOf, type Answer, type QResult } from '../lib/grading';
import type { Attempt } from '../lib/store';
import { usePlatform } from '../lib/platform';
import { Inline } from './Markdown';

interface Props {
  questions: Question[];
  title?: string;
  timeLimitMin?: number;
  startedAt?: string;
  onComplete: (a: Attempt) => void;
  onStart?: () => void;
  existing?: Attempt; // show a past attempt read-only
  labelFor?: (q: Question) => string | undefined; // e.g. "Week 3"
  /** Persist in-progress answers under this key (exams), so leaving the page doesn't lose work. */
  draftKey?: string;
}

const DRAFT = 'aie600-draft:';
function loadDraft(key?: string): Record<string, Answer> | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(DRAFT + key);
    return raw ? (JSON.parse(raw) as Record<string, Answer>) : null;
  } catch {
    return null;
  }
}
function saveDraft(key: string | undefined, a: Record<string, Answer> | null) {
  if (!key) return;
  try {
    if (a) localStorage.setItem(DRAFT + key, JSON.stringify(a));
    else localStorage.removeItem(DRAFT + key);
  } catch {
    /* storage unavailable */
  }
}

type Phase = 'answering' | 'grading' | 'done';

export function QuizRunner({ questions, title, timeLimitMin, startedAt, onComplete, onStart, existing, labelFor, draftKey }: Props) {
  const { ai, me } = usePlatform();
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => (existing?.answers as Record<string, Answer>) ?? loadDraft(draftKey) ?? {});
  const [phase, setPhase] = useState<Phase>(existing ? 'done' : 'answering');
  const [results, setResults] = useState<Record<string, QResult>>(() =>
    existing
      ? Object.fromEntries(Object.entries(existing.perQuestion).map(([id, r]) => [id, { id, ...r, correct: r.earned === r.max }]))
      : {},
  );
  const [shortScores, setShortScores] = useState<Record<string, number[]>>({});
  const [aiGraded, setAiGraded] = useState<Record<string, { feedback: string }>>({});
  const [aiState, setAiState] = useState<'idle' | 'working' | 'unavailable' | 'done'>('idle');
  const remaining = useCountdown(timeLimitMin, startedAt, phase === 'answering');

  useEffect(() => {
    if (!existing) onStart?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (remaining === 0 && phase === 'answering') submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const shorts = useMemo(() => questions.filter((q): q is ShortAnswer => q.type === 'short'), [questions]);
  const answeredCount = questions.filter((q) => isAnswered(answers[q.id])).length;

  function set(id: string, a: Answer) {
    if (phase !== 'answering') return;
    setAnswers((s) => {
      const next = { ...s, [id]: a };
      saveDraft(draftKey, next);
      return next;
    });
  }

  async function submit() {
    const r: Record<string, QResult> = {};
    for (const q of questions) r[q.id] = gradeQuestion(q, answers[q.id] ?? null);
    setResults(r);
    if (!shorts.length) return finalize(r, {});
    setPhase('grading');
    setAiState('working');
    try {
      const graded: Record<string, number[]> = {};
      const fb: Record<string, { feedback: string }> = {};
      for (const q of shorts) {
        const ans = String(answers[q.id] ?? '').trim();
        if (!ans) {
          graded[q.id] = q.rubric.map(() => 0);
          fb[q.id] = { feedback: 'No answer submitted.' };
          continue;
        }
        const out = me?.features.ai ? await ai.grade(q, ans) : null;
        if (out === null) {
          setAiState('unavailable');
          return;
        }
        graded[q.id] = q.rubric.map((_, i) => clamp01(Number(out.scores?.[i] ?? 0)));
        fb[q.id] = { feedback: String(out.feedback ?? '').slice(0, 1200) };
      }
      setShortScores(graded);
      setAiGraded(fb);
      setAiState('done');
    } catch {
      setAiState('unavailable');
    }
  }

  function finalize(base: Record<string, QResult>, scores: Record<string, number[]>) {
    const r = { ...base };
    for (const q of shorts) r[q.id] = { ...gradeQuestion(q, answers[q.id] ?? null, scores[q.id] ?? q.rubric.map(() => 0)), feedback: aiGraded[q.id]?.feedback };
    setResults(r);
    setPhase('done');
    saveDraft(draftKey, null);
    if (!existing) setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
    const earned = Object.values(r).reduce((s, x) => s + x.earned, 0);
    const max = questions.reduce((s, q) => s + pointsOf(q), 0);
    onComplete({
      date: new Date().toISOString(),
      earned: Math.round(earned * 100) / 100,
      max,
      answers,
      perQuestion: Object.fromEntries(Object.values(r).map((x) => [x.id, { earned: x.earned, max: x.max, ...(x.feedback ? { feedback: x.feedback } : {}) }])),
    });
  }

  const total = questions.reduce((s, q) => s + pointsOf(q), 0);
  const earned = Object.values(results).reduce((s, x) => s + x.earned, 0);

  return (
    <div className="space-y-5">
      {(title || timeLimitMin) && (
        <div className="sticky top-[57px] z-10 -mx-4 lg:top-0 flex items-center justify-between gap-3 border-b border-paper-line bg-paper/95 px-4 py-2 backdrop-blur">
          <div className="text-sm font-medium">{title}</div>
          <div className="flex items-center gap-3 text-sm">
            {phase === 'answering' && (
              <span className="text-ink-mute">
                {answeredCount}/{questions.length} answered
              </span>
            )}
            {remaining !== null && phase === 'answering' && (
              <span className={`chip font-mono ${remaining < 300 ? 'bg-red-100 text-red-700' : 'bg-paper-line text-ink'}`}>{fmt(remaining)}</span>
            )}
            {phase === 'done' && (
              <span className="chip bg-brand text-white">
                {round1(earned)}/{total} · {Math.round((100 * earned) / total)}%
              </span>
            )}
          </div>
        </div>
      )}

      {phase === 'done' && !existing && (
        <div className="card border-2 border-brand/40 bg-brand-soft/30 p-4">
          <div className="kicker">Result</div>
          <div className="mt-1 font-serif text-3xl font-bold">
            {Math.round((100 * earned) / total)}% <span className="text-base font-normal text-ink-mute">({round1(earned)}/{total} points)</span>
          </div>
          <div className="mt-1 text-sm text-ink-soft">Recorded in your gradebook. Review each explanation below — especially the ones you missed — then revisit those checklist topics.</div>
        </div>
      )}

      {questions.map((q, i) => (
        <QuestionCard
          key={q.id}
          q={q}
          index={i}
          label={labelFor?.(q)}
          answer={answers[q.id] ?? null}
          onChange={(a) => set(q.id, a)}
          result={phase === 'done' ? results[q.id] : phase === 'grading' && q.type !== 'short' ? results[q.id] : undefined}
          reveal={phase !== 'answering'}
          shortControl={
            q.type === 'short' && phase === 'grading' ? (
              <ShortGrader
                q={q}
                ai={aiState}
                feedback={aiGraded[q.id]?.feedback}
                scores={shortScores[q.id] ?? q.rubric.map(() => 0)}
                onChange={(s) => setShortScores((m) => ({ ...m, [q.id]: s }))}
              />
            ) : undefined
          }
        />
      ))}

      {phase === 'answering' && (
        <div className="flex items-center justify-end gap-3">
          {answeredCount < questions.length && <span className="text-sm text-ink-mute">{questions.length - answeredCount} unanswered</span>}
          <button className="btn-primary" onClick={submit}>
            Submit for grading
          </button>
        </div>
      )}
      {phase === 'grading' && (
        <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-ink-soft">
            {aiState === 'working' && 'The AI TA is grading your written answers against the rubric…'}
            {aiState === 'done' && 'Written answers graded by the AI TA. Review the feedback, then record your grade.'}
            {aiState === 'unavailable' &&
              'AI grading isn’t available here, so grade your written answers yourself: compare with the model answer and tick each rubric point you genuinely covered.'}
          </div>
          <button className="btn-primary shrink-0" disabled={aiState === 'working'} onClick={() => finalize(results, shortScores)}>
            Record grade
          </button>
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  q,
  index,
  label,
  answer,
  onChange,
  result,
  reveal,
  shortControl,
}: {
  q: Question;
  index: number;
  label?: string;
  answer: Answer;
  onChange: (a: Answer) => void;
  result?: QResult;
  reveal: boolean;
  shortControl?: React.ReactNode;
}) {
  const pts = pointsOf(q);
  const border = result ? (result.pending ? 'border-paper-line' : result.correct ? 'border-emerald-400' : result.earned > 0 ? 'border-amber-400' : 'border-red-300') : 'border-paper-line';
  return (
    <div className={`card border-2 p-4 sm:p-5 ${border}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="font-medium leading-snug">
          <span className="mr-2 text-ink-mute">{index + 1}.</span>
          <Inline text={q.prompt} />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="chip bg-paper-line text-ink-soft">
            {result && !result.pending ? `${round1(result.earned)}/` : ''}
            {pts} pt{pts > 1 ? 's' : ''}
          </span>
          {label && <span className="text-[0.7rem] text-ink-mute">{label}</span>}
        </div>
      </div>

      {(q.type === 'mcq' || q.type === 'multi') && (
        <div className="space-y-2">
          {q.type === 'multi' && <div className="text-xs text-ink-mute">Select all that apply. Wrong picks cancel right ones.</div>}
          {q.options.map((opt, i) => {
            const picked = q.type === 'mcq' ? answer === i : Array.isArray(answer) && answer.includes(i);
            const isRight = q.type === 'mcq' ? q.answer === i : q.answer.includes(i);
            const tone = reveal ? (isRight ? 'border-emerald-400 bg-emerald-50' : picked ? 'border-red-300 bg-red-50' : 'border-paper-line') : picked ? 'border-brand bg-brand-soft/50' : 'border-paper-line hover:bg-paper';
            return (
              <button
                key={i}
                type="button"
                disabled={reveal}
                onClick={() => {
                  if (q.type === 'mcq') onChange(i);
                  else {
                    const cur = Array.isArray(answer) ? answer : [];
                    onChange(cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort());
                  }
                }}
                className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition ${tone}`}
              >
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border ${q.type === 'mcq' ? 'rounded-full' : 'rounded'} ${picked ? 'border-brand bg-brand' : 'border-ink-mute'}`}>
                  {picked && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <span>
                  <Inline text={opt} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {q.type === 'numeric' && (
        <div className="flex items-center gap-2">
          <input
            className="input max-w-[14rem] font-mono"
            inputMode="decimal"
            placeholder="Your answer"
            disabled={reveal}
            value={typeof answer === 'string' ? answer : ''}
            onChange={(e) => onChange(e.target.value)}
          />
          {q.unit && <span className="text-sm text-ink-mute">{q.unit}</span>}
          {reveal && (
            <span className="text-sm text-ink-soft">
              Key: <span className="font-mono">{q.answer}</span> (±{Math.round(q.tolerance * 100)}%)
            </span>
          )}
        </div>
      )}

      {q.type === 'short' && (
        <textarea
          className="input min-h-[8rem] font-serif text-[0.98rem]"
          placeholder="Write your answer…"
          disabled={reveal}
          value={typeof answer === 'string' ? answer : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {shortControl}

      {reveal && (q.type !== 'short' || result) && !shortControl && (
        <div className="mt-3 rounded-lg bg-paper p-3 text-sm text-ink-soft">
          <Inline text={q.explanation} />
          {q.type === 'short' && (
            <details className="mt-2">
              <summary className="cursor-pointer font-medium text-ink">Model answer & rubric</summary>
              <p className="mt-2 font-serif">{q.modelAnswer}</p>
              <ul className="mt-2 list-disc pl-5">
                {q.rubric.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </details>
          )}
          {result?.feedback && (
            <div className="mt-2 border-t border-paper-line pt-2">
              <span className="font-medium text-ink">AI TA feedback: </span>
              {result.feedback}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ShortGrader({ q, ai, feedback, scores, onChange }: { q: ShortAnswer; ai: string; feedback?: string; scores: number[]; onChange: (s: number[]) => void }) {
  const manual = ai === 'unavailable';
  return (
    <div className="mt-3 space-y-3 rounded-lg bg-paper p-3 text-sm">
      <details open={manual}>
        <summary className="cursor-pointer font-medium">Model answer</summary>
        <p className="mt-2 font-serif text-ink-soft">{q.modelAnswer}</p>
      </details>
      <div>
        <div className="mb-1 font-medium">Rubric {manual ? '(tick what you covered)' : ''}</div>
        <ul className="space-y-1.5">
          {q.rubric.map((r, i) => (
            <li key={i} className="flex items-start gap-2">
              {manual ? (
                <select className="rounded border border-paper-line bg-white px-1 py-0.5 text-xs" value={scores[i]} onChange={(e) => onChange(scores.map((s, j) => (j === i ? Number(e.target.value) : s)))}>
                  <option value={0}>0</option>
                  <option value={0.5}>½</option>
                  <option value={1}>1</option>
                </select>
              ) : (
                <span className={`chip ${scores[i] >= 1 ? 'bg-emerald-100 text-emerald-800' : scores[i] > 0 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'}`}>{ai === 'working' ? '…' : scores[i] === 0.5 ? '½' : scores[i]}</span>
              )}
              <span className="text-ink-soft">{r}</span>
            </li>
          ))}
        </ul>
      </div>
      {feedback && (
        <div className="border-t border-paper-line pt-2 text-ink-soft">
          <span className="font-medium text-ink">AI TA feedback: </span>
          {feedback}
        </div>
      )}
    </div>
  );
}

function useCountdown(limitMin: number | undefined, startedAt: string | undefined, active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!limitMin || !active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [limitMin, active]);
  if (!limitMin) return null;
  const start = startedAt ? Date.parse(startedAt) : now;
  return Math.max(0, Math.round((start + limitMin * 60000 - now) / 1000));
}

function isAnswered(a: Answer | undefined) {
  if (a === null || a === undefined) return false;
  if (Array.isArray(a)) return a.length > 0;
  if (typeof a === 'string') return a.trim().length > 0;
  return true;
}
const clamp01 = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(1, Math.round(x * 2) / 2)) : 0);
const round1 = (x: number) => Math.round(x * 10) / 10;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
