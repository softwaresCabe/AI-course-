import { futurePaths } from '../content/course';

export function FuturePage() {
  return (
    <div className="space-y-8">
      <header>
        <div className="kicker">After the course</div>
        <h1 className="mt-1 font-serif text-3xl font-bold sm:text-4xl">Paths to improve the future of AI</h1>
        <p className="mt-3 max-w-2xl font-serif text-lg leading-relaxed text-ink-soft">
          The most important problems in AI are still open, and many need exactly the skills you now have: engineers who can build, measure and harden real systems. Pick one path, do the first project within 90 days, and publish what you learn.
        </p>
      </header>
      <div className="grid gap-4">
        {futurePaths.map((f, i) => (
          <section key={f.title} className="card p-5">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-sm text-ink-mute">{String(i + 1).padStart(2, '0')}</span>
              <h2 className="font-serif text-2xl font-semibold">{f.title}</h2>
            </div>
            <p className="mt-2 text-ink-soft">{f.why}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="kicker mb-1">Open problems</div>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {f.problems.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="kicker mb-1">Your first steps</div>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {f.firstSteps.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {f.resources.map((r) =>
                r.url ? (
                  <a key={r.title} href={r.url} target="_blank" rel="noreferrer" className="chip bg-brand-soft text-brand-deep hover:underline">
                    {r.title} ↗
                  </a>
                ) : (
                  <span key={r.title} className="chip bg-paper-line">
                    {r.title} — {r.author}
                  </span>
                ),
              )}
            </div>
          </section>
        ))}
      </div>
      <section className="card p-5">
        <h2 className="font-serif text-xl font-semibold">A 90-day plan after graduation</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
          <li>Days 1–14: polish and publish your capstone (repo, demo video, blog post with eval numbers).</li>
          <li>Days 15–45: pick one path above; reproduce one published result or build one open-source component.</li>
          <li>Days 46–75: apply to roles weekly with the capstone as the centerpiece; practice two AI system-design questions per week.</li>
          <li>Days 76–90: publish a second write-up from your chosen path and share it with the relevant community.</li>
        </ol>
      </section>
    </div>
  );
}
