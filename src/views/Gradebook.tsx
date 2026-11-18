import { useEffect, useState } from 'react';
import { serverHealth, serverToken, setServerToken } from '../lib/runtime';
import { course, weeks } from '../content/course';
import { useStore, type Progress } from '../lib/store';
import { certificateStatus, courseGrade, examPct, labPct, quizPct, weekProgress } from '../lib/scores';
import { go } from '../router';

export function Gradebook() {
  const { p, replaceAll, sync } = useStore();
  const g = courseGrade(p);
  const cert = certificateStatus(p);
  const [io, setIo] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [needsToken, setNeedsToken] = useState(false);
  const [token, setToken] = useState(serverToken());
  useEffect(() => {
    serverHealth().then((h) => setNeedsToken(!!h?.auth));
  }, []);
  const fmt = (x: number | null) => (x === null ? '—' : `${Math.round(x)}%`);

  return (
    <div className="space-y-8">
      <header>
        <div className="kicker">Gradebook</div>
        <h1 className="mt-1 font-serif text-3xl font-bold sm:text-4xl">Your transcript</h1>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <div className="kicker">Running grade</div>
          <div className="mt-1 font-serif text-4xl font-bold">{g.running === null ? '—' : `${Math.round(g.running)}%`}</div>
          <div className="text-xs text-ink-mute">{g.letterRunning} · based on completed components ({g.weightSeen}% of weight)</div>
        </div>
        <div className="card p-4">
          <div className="kicker">Final grade if you stopped now</div>
          <div className="mt-1 font-serif text-4xl font-bold">{Math.round(g.final)}%</div>
          <div className="text-xs text-ink-mute">Missing work counts as zero</div>
        </div>
        <div className="card p-4">
          <div className="kicker">Certificate requirements</div>
          <ul className="mt-2 space-y-1 text-sm">
            <Req ok={cert.overall}>Overall ≥ 70%</Req>
            <Req ok={cert.allQuizzes}>All 13 quizzes ≥ 80%</Req>
            <Req ok={cert.exams}>Midterm and final taken</Req>
            <Req ok={cert.capstone}>Capstone submitted</Req>
          </ul>
        </div>
      </section>

      <section className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-mute">
            <tr>
              <th className="px-4 py-3">Component</th>
              <th className="px-4 py-3">Weight</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Contribution</th>
            </tr>
          </thead>
          <tbody>
            {course.grading.map((c) => {
              const v = g.comp[c.key];
              return (
                <tr key={c.key} className="border-t border-paper-line">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.label}</div>
                    <div className="text-xs text-ink-mute">{c.note}</div>
                  </td>
                  <td className="px-4 py-3 font-mono">{c.weight}%</td>
                  <td className="px-4 py-3 font-mono">{fmt(v)}</td>
                  <td className="px-4 py-3 font-mono">{v === null ? '—' : ((v * c.weight) / 100).toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-mute">
            <tr>
              <th className="px-4 py-3">Week</th>
              <th className="px-4 py-3">Read</th>
              <th className="px-4 py-3">Checklist</th>
              <th className="px-4 py-3">Quiz / exam</th>
              <th className="px-4 py-3">Lab</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => {
              const pr = weekProgress(p, w.n);
              const q = quizPct(p, w.n);
              return (
                <tr key={w.n} className="cursor-pointer border-t border-paper-line hover:bg-paper" onClick={() => go(`week-${w.n}`)}>
                  <td className="px-4 py-2.5">
                    <span className="mr-2 font-mono text-ink-mute">{w.n}</span>
                    {w.title}
                  </td>
                  <td className="px-4 py-2.5 font-mono">
                    {pr.read}/{w.sections.length}
                  </td>
                  <td className="px-4 py-2.5 font-mono">
                    {pr.checks}/{w.checklist.length}
                  </td>
                  <td className={`px-4 py-2.5 font-mono ${q !== null && q >= 80 ? 'text-emerald-700' : q !== null ? 'text-amber-700' : ''}`}>{fmt(q)}</td>
                  <td className="px-4 py-2.5 font-mono">{fmt(labPct(p, w.n))}</td>
                </tr>
              );
            })}
            <tr className="border-t border-paper-line bg-brand-soft/30">
              <td className="px-4 py-2.5 font-medium">Midterm</td>
              <td colSpan={2} />
              <td className="px-4 py-2.5 font-mono">{fmt(examPct(p, 'midterm'))}</td>
              <td />
            </tr>
            <tr className="border-t border-paper-line bg-brand-soft/30">
              <td className="px-4 py-2.5 font-medium">Final</td>
              <td colSpan={2} />
              <td className="px-4 py-2.5 font-mono">{fmt(examPct(p, 'final'))}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </section>

      <section className="card p-5">
        <div className="kicker mb-1">Backup & transfer</div>
        <p className="mb-3 text-sm text-ink-mute">
          {sync === 'synced' || sync === 'saving'
            ? 'Your progress syncs automatically (Claude account or the course database), so it follows you across devices.'
            : 'Progress is saved in this browser. Copy a backup to move it to another device.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-ghost"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(JSON.stringify(p));
                setMsg('Backup copied to clipboard.');
              } catch {
                setIo(JSON.stringify(p));
                setMsg('Clipboard unavailable — the backup is in the box below; copy it manually.');
              }
            }}
          >
            Copy backup
          </button>
          <button
            className="btn-ghost"
            onClick={() => {
              try {
                const parsed = JSON.parse(io) as Progress;
                if (parsed.version !== 1) throw new Error();
                replaceAll(parsed);
                setMsg('Backup restored.');
              } catch {
                setMsg('That doesn’t look like a valid backup.');
              }
            }}
          >
            Restore from box
          </button>
        </div>
        <textarea className="input mt-3 h-20 font-mono text-xs" placeholder="Paste a backup here to restore" value={io} onChange={(e) => setIo(e.target.value)} />
        {msg && <div className="mt-2 text-sm text-ink-soft">{msg}</div>}
        {needsToken && (
          <div className="mt-4 border-t border-paper-line pt-4">
            <div className="mb-1 text-sm font-medium">Server access token</div>
            <p className="mb-2 text-xs text-ink-mute">This deployment requires COURSE_ACCESS_TOKEN for sync and the AI TA. Enter it once per device, then reload.</p>
            <div className="flex gap-2">
              <input className="input font-mono" type="password" value={token} onChange={(e) => setToken(e.target.value)} />
              <button className="btn-ghost" onClick={() => { setServerToken(token); location.reload(); }}>Save</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Req({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[0.6rem] ${ok ? 'bg-emerald-600 text-white' : 'border border-ink-mute'}`}>{ok ? '✓' : ''}</span>
      <span className={ok ? '' : 'text-ink-mute'}>{children}</span>
    </li>
  );
}
