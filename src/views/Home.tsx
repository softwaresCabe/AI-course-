import { course, weeks } from '../content/course';
import { useStore } from '../lib/store';
import { courseGrade, weekProgress } from '../lib/scores';
import { go } from '../router';

export function weekDates(start: string | undefined, n: number) {
  if (!start) return null;
  const d = new Date(start + 'T00:00:00');
  const s = new Date(d.getTime() + (n - 1) * 7 * 86400000);
  const e = new Date(s.getTime() + 6 * 86400000);
  const f = (x: Date) => x.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${f(s)} – ${f(e)}`;
}

export function Home() {
  const { p, update } = useStore();
  const g = courseGrade(p);
  const progress = weeks.map((w) => weekProgress(p, w.n));
  const overall = Math.round(progress.reduce((s, x) => s + x.pct, 0) / weeks.length);
  const current = weeks.find((w) => !weekProgress(p, w.n).mastered) ?? weeks[weeks.length - 1];

  return (
    <div className="space-y-10">
      <section className="pt-2">
        <div className="kicker">{course.code} · Graduate seminar & lab</div>
        <h1 className="mt-2 font-serif text-4xl font-bold leading-[1.1] sm:text-5xl">{course.title}</h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">{course.subtitle}</p>
        <p className="mt-2 max-w-2xl text-sm text-ink-mute">{course.format}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="btn-primary" onClick={() => go(`week-${current.n}`)}>
            {overall === 0 ? 'Start Week 1' : `Continue · Week ${current.n}`}
          </button>
          <button className="btn-ghost" onClick={() => go('syllabus')}>
            Syllabus & grading
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Course progress" value={`${overall}%`} sub={`${progress.filter((x) => x.mastered).length}/13 weeks mastered`} />
        <Stat label="Running grade" value={g.running === null ? '—' : `${Math.round(g.running)}%`} sub={g.running === null ? 'No graded work yet' : `${g.letterRunning} on ${g.weightSeen}% of the grade so far`} />
        <div className="card p-4">
          <div className="kicker">Start date</div>
          <input type="date" className="input mt-2" value={p.startDate ?? ''} onChange={(e) => update((d) => void (d.startDate = e.target.value || undefined))} />
          <div className="mt-1 text-xs text-ink-mute">Sets your week-by-week calendar.</div>
        </div>
      </section>

      {course.phases.map((ph) => (
        <section key={ph.n}>
          <div className="mb-3 flex items-baseline gap-3">
            <div className="kicker">Phase {ph.n}</div>
            <h2 className="font-serif text-2xl font-semibold">{ph.title}</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {ph.weeks.map((n) => {
              const w = weeks.find((x) => x.n === n)!;
              const pr = progress[n - 1];
              const dates = weekDates(p.startDate, n);
              return (
                <button key={n} onClick={() => go(`week-${n}`)} className="card group p-4 text-left transition hover:border-brand/40 hover:shadow-sm">
                  <div className="flex items-center justify-between text-xs text-ink-mute">
                    <span>
                      Week {n}
                      {dates ? ` · ${dates}` : ''}
                    </span>
                    {pr.mastered ? <span className="chip bg-emerald-100 text-emerald-800">Mastered</span> : pr.pct > 0 ? <span className="chip bg-brand-soft text-brand-deep">{pr.pct}%</span> : null}
                  </div>
                  <div className="mt-1 font-semibold leading-snug group-hover:text-brand">{w.title}</div>
                  <div className="mt-1 text-sm text-ink-mute">{w.tagline}</div>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-paper-line">
                    <div className="h-full bg-brand" style={{ width: `${pr.pct}%` }} />
                  </div>
                </button>
              );
            })}
            {ph.n === 2 && <ExamTile id="midterm" label="Midterm exam" sub={`After Week 6${p.startDate ? ' · ' + weekDates(p.startDate, 6)?.split(' – ')[1] : ''} · 90 min`} />}
            {ph.n === 4 && <ExamTile id="final" label="Final exam" sub="End of Week 13 · 150 min, cumulative" />}
            {ph.n === 4 && (
              <button onClick={() => go('future')} className="card p-4 text-left transition hover:border-brand/40">
                <div className="text-xs text-ink-mute">After the course</div>
                <div className="mt-1 font-semibold">Paths to improve the future of AI</div>
                <div className="mt-1 text-sm text-ink-mute">Eight concrete research and engineering directions, with first projects.</div>
              </button>
            )}
          </div>
        </section>
      ))}
    </div>
  );

  function ExamTile({ id, label, sub }: { id: 'midterm' | 'final'; label: string; sub: string }) {
    const a = p.exams[id];
    return (
      <button onClick={() => go(id)} className="card border-brand/30 bg-brand-soft/30 p-4 text-left transition hover:border-brand/60">
        <div className="flex items-center justify-between text-xs text-ink-mute">
          <span>Examination</span>
          {a && <span className="chip bg-brand text-white">{Math.round((100 * a.earned) / a.max)}%</span>}
        </div>
        <div className="mt-1 font-semibold">{label}</div>
        <div className="mt-1 text-sm text-ink-mute">{sub}</div>
      </button>
    );
  }
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card p-4">
      <div className="kicker">{label}</div>
      <div className="mt-1 font-serif text-3xl font-bold">{value}</div>
      <div className="text-xs text-ink-mute">{sub}</div>
    </div>
  );
}
