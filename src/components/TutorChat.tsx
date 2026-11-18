import { useEffect, useRef, useState } from 'react';
import type { Week } from '../content/types';
import { aiAvailable, askText } from '../lib/runtime';
import { PlainText } from './Markdown';

type Msg = { role: 'user' | 'assistant'; content: string };

/** "Office hours" — an AI teaching assistant grounded in this week's lecture. */
export function TutorChat({ week }: { week: Week }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    aiAvailable().then(setAvailable);
  }, []);

  useEffect(() => {
    setMsgs([]);
    setErr(null);
  }, [week.n]);

  const system = `You are the teaching assistant for "AIE 600: AI Engineering", a graduate-level course. The student is a professional software engineer (TypeScript/Next.js/Postgres background, ex-warehouse-systems engineer) studying Week ${week.n}: ${week.title}.

Teaching style: Socratic when the student is working on a problem (give hints before full solutions, especially for lab and quiz questions — do not give away quiz answers outright); direct and precise when they ask for an explanation. Use concrete examples, small worked numbers and short code (Python or TypeScript) where helpful. Correct misconceptions clearly. If something is outside the lecture, you may use general knowledge but say when a detail may have changed recently. Keep answers under ~250 words unless asked for more. Plain text only (no markdown headings).

THIS WEEK'S LECTURE NOTES:
${week.sections.map((s) => `## ${s.heading}\n${s.body}`).join('\n\n').slice(0, 24000)}`;

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const history: Msg[] = [...msgs, { role: 'user', content: text.trim() }];
    setMsgs([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);
    setErr(null);
    abort.current = new AbortController();
    try {
      const convo: Msg[] = [{ role: 'user', content: system + '\n\n---\nStudent: ' + history[0].content }, ...history.slice(1)];
      const out = await askText(convo, (t) => setMsgs((m) => [...m.slice(0, -1), { role: 'assistant', content: t }]), abort.current.signal);
      if (out === null) {
        setAvailable(false);
        setMsgs(history);
      }
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      setErr(code === 'rate_limited' ? 'The TA is busy (rate limited). Try again in a minute.' : code === 'not_granted' ? 'AI access was not granted for this page.' : 'Something went wrong. Try again.');
      if (code === 'not_granted') setAvailable(false);
      setMsgs((m) => (m[m.length - 1]?.content ? m : m.slice(0, -1)));
    } finally {
      setBusy(false);
    }
  }

  if (available === false)
    return (
      <div className="card p-4 text-sm text-ink-soft">
        The AI TA runs when this course is opened as a Claude artifact, or when the Next.js app is deployed with ANTHROPIC_API_KEY set. Until then, use the flashcards and quiz explanations.
      </div>
    );

  const starters = [`Explain ${week.sections[1]?.heading.replace(/^\d+\.\d+\s*/, '') ?? 'the key idea'} with a worked example`, 'Quiz me with 3 harder questions on this week', 'What do interviewers ask about this topic?', 'I’m stuck on the lab — give me a hint'];

  return (
    <div className="card flex flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="kicker">Office hours</div>
          <div className="font-semibold">Ask the AI TA about Week {week.n}</div>
        </div>
        {msgs.length > 0 && (
          <button className="text-xs text-ink-mute underline" onClick={() => setMsgs([])}>
            Clear
          </button>
        )}
      </div>
      <div className="max-h-[28rem] space-y-3 overflow-y-auto">
        {msgs.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {starters.map((s) => (
              <button key={s} className="btn-ghost !px-3 !py-1.5 text-left text-xs" disabled={available === null} onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'ml-8 rounded-lg bg-brand-soft/60 p-3 text-sm' : 'mr-4 rounded-lg bg-paper p-3'}>
            {m.role === 'assistant' && !m.content ? <span className="text-sm text-ink-mute">Thinking…</span> : <PlainText text={m.content} />}
          </div>
        ))}
      </div>
      {err && <div className="mt-2 text-sm text-red-700">{err}</div>}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input className="input" placeholder="Ask a question…" value={input} onChange={(e) => setInput(e.target.value)} disabled={busy} />
        {busy ? (
          <button type="button" className="btn-ghost" onClick={() => abort.current?.abort()}>
            Stop
          </button>
        ) : (
          <button className="btn-primary" disabled={!input.trim() || available === null}>
            Ask
          </button>
        )}
      </form>
    </div>
  );
}
