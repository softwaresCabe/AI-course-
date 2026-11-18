import { useRef, useState } from 'react';
import type { Week } from '../content/types';
import { usePlatform, type ChatMsg } from '../lib/platform';
import { formatTokens } from '../lib/format';
import { PlainText } from './Markdown';
import { BuyButton } from './Paywall';

type Turn = ChatMsg & { activity?: string[]; charged?: number };

/** The AI tutor: an agent that can look things up in the course (lectures, labs, your progress) to get you unstuck. */
export function TutorChat({ week }: { week: Week }) {
  const { ai, me, auth, refreshMe } = usePlatform();
  const [msgs, setMsgs] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ code: string; message: string } | null>(null);
  const abort = useRef<AbortController | null>(null);

  const tokens = me?.tokens ?? null;
  const outOfTokens = (tokens !== null && tokens.balance <= 0) || err?.code === 'insufficient_tokens';
  const packs = me?.products.filter((p) => p.kind === 'tokens') ?? [];

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const history: Turn[] = [...msgs, { role: 'user', content: text.trim() }];
    setMsgs([...history, { role: 'assistant', content: '', activity: [] }]);
    setInput('');
    setBusy(true);
    setErr(null);
    abort.current = new AbortController();
    const patchLast = (fn: (t: Turn) => Turn) => setMsgs((m) => [...m.slice(0, -1), fn(m[m.length - 1])]);
    try {
      await ai.tutor(
        week,
        history.map(({ role, content }) => ({ role, content })),
        (e) => {
          if (e.type === 'text') patchLast((t) => ({ ...t, content: t.content + e.text }));
          else if (e.type === 'tool') patchLast((t) => ({ ...t, activity: [...(t.activity ?? []), e.label] }));
          else if (e.type === 'usage') patchLast((t) => ({ ...t, charged: e.charged }));
          else if (e.type === 'error') setErr({ code: e.code, message: e.message });
        },
        abort.current.signal,
      );
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setErr({ code: 'error', message: 'Something went wrong. Try again.' });
    } finally {
      // Drop an empty assistant bubble (error before any text).
      setMsgs((m) => (m[m.length - 1]?.role === 'assistant' && !m[m.length - 1].content ? m.slice(0, -1) : m));
      setBusy(false);
      if (me?.tokens) void refreshMe();
    }
  }

  if (me && !me.features.ai)
    return <div className="card p-4 text-sm text-ink-soft">The AI tutor isn’t enabled on this deployment. Use the flashcards and quiz explanations in the meantime.</div>;

  if (me && !me.signedIn)
    return (
      <div className="card p-5 text-sm text-ink-soft">
        <div className="font-semibold text-ink">AI tutor</div>
        <p className="mt-1">Stuck on a concept or a lab step? The tutor reads the course material and your progress, then walks you through it — hints first, answers when you need them. Free accounts include starter tokens.</p>
        <button className="btn-primary mt-3" onClick={auth.signIn} disabled={!auth.enabled}>
          Sign in to use the tutor
        </button>
      </div>
    );

  const starters = [
    `Explain ${week.sections[1]?.heading.replace(/^\d+\.\d+\s*/, '') ?? 'the key idea'} with a worked example`,
    'Look at my progress — what should I review this week?',
    'I’m stuck on the lab — give me a hint for the next step',
    'What do interviewers ask about this topic?',
  ];

  return (
    <div className="card flex flex-col p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="kicker">Office hours</div>
          <div className="font-semibold">Ask the AI tutor about Week {week.n}</div>
        </div>
        <div className="flex items-center gap-3 text-xs text-ink-mute">
          {tokens && (
            <span title="AI tutor token balance">
              <span className="font-mono">{formatTokens(tokens.balance)}</span> tokens left
            </span>
          )}
          {msgs.length > 0 && !busy && (
            <button className="underline" onClick={() => setMsgs([])}>
              Clear
            </button>
          )}
        </div>
      </div>
      <div className="max-h-[32rem] space-y-3 overflow-y-auto" aria-live="polite">
        {msgs.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {starters.map((s) => (
              <button key={s} className="btn-ghost !px-3 !py-1.5 text-left text-xs" disabled={!me || outOfTokens} onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'ml-8 rounded-lg bg-brand-soft/60 p-3 text-sm' : 'mr-4 rounded-lg bg-paper p-3'}>
            {m.activity && m.activity.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {m.activity.map((a, j) => (
                  <span key={j} className="chip bg-paper-line text-[0.7rem] text-ink-mute">
                    {a}
                  </span>
                ))}
              </div>
            )}
            {m.role === 'assistant' && !m.content ? <span className="text-sm text-ink-mute">Thinking…</span> : <PlainText text={m.content} />}
            {m.charged !== undefined && m.charged > 0 && <div className="mt-1 text-right text-[0.7rem] text-ink-mute">{formatTokens(m.charged)} tokens</div>}
          </div>
        ))}
      </div>
      {err && !outOfTokens && <div className="mt-2 text-sm text-red-700">{err.message}</div>}
      {outOfTokens && (
        <div className="mt-3 rounded-lg border border-brand/30 bg-brand-soft/30 p-3 text-sm">
          <div className="font-medium">You’re out of tutor tokens.</div>
          <div className="mt-1 text-ink-soft">Top up to keep going — tokens never expire.</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {packs.length ? packs.map((p) => <BuyButton key={p.id} product={p} />) : <span className="text-ink-mute">Token packs aren’t available on this deployment.</span>}
          </div>
        </div>
      )}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input className="input" placeholder="Ask a question…" value={input} maxLength={4000} onChange={(e) => setInput(e.target.value)} disabled={busy || outOfTokens} aria-label="Ask the AI tutor" />
        {busy ? (
          <button type="button" className="btn-ghost" onClick={() => abort.current?.abort()}>
            Stop
          </button>
        ) : (
          <button className="btn-primary" disabled={!input.trim() || !me || outOfTokens}>
            Ask
          </button>
        )}
      </form>
      <p className="mt-2 text-[0.7rem] text-ink-mute">The tutor won’t give away quiz answers and isn’t available during exams. It can make mistakes — check important details against the lecture.</p>
    </div>
  );
}
