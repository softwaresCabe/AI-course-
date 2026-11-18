import { usePlatform } from '../lib/platform';
import { formatPrice, formatTokens } from '../lib/format';
import { BuyButton } from '../components/Paywall';
import { go } from '../router';

export function PricingPage() {
  const { me, auth } = usePlatform();
  const course = me?.products.find((p) => p.kind === 'course');
  const packs = me?.products.filter((p) => p.kind === 'tokens') ?? [];
  return (
    <div className="space-y-8">
      <header>
        <div className="kicker">Pricing</div>
        <h1 className="mt-1 font-serif text-3xl font-bold sm:text-4xl">Start free. Unlock the rest when you’re sure.</h1>
        <p className="mt-2 text-ink-soft">Weeks 1 and 2 are free, so you can see exactly how the course teaches before you pay. One payment unlocks everything for life.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <div className="kicker">Free</div>
          <div className="mt-1 font-serif text-3xl font-bold">$0</div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-soft">
            <li>Week 1 — open to everyone, no account needed</li>
            <li>Week 2 — with a free account</li>
            <li>Lectures, labs, quizzes, flashcards and checklists for both weeks</li>
            <li>Progress saved to your account</li>
            <li>Starter AI tutor tokens</li>
          </ul>
          <div className="mt-4">
            {me?.signedIn ? (
              <button className="btn-ghost" onClick={() => go('week-1')}>
                Go to Week 1
              </button>
            ) : (
              <button className="btn-ghost" onClick={auth.enabled ? auth.signIn : () => go('week-1')}>
                {auth.enabled ? 'Create a free account' : 'Start Week 1'}
              </button>
            )}
          </div>
        </div>
        <div className="card border-2 border-brand/40 p-5">
          <div className="kicker">Full course</div>
          <div className="mt-1 font-serif text-3xl font-bold">{course ? formatPrice(course.priceCents) : '—'}</div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-soft">
            <li>All 13 weeks: lectures, 12 labs and the capstone</li>
            <li>13 graded quizzes, spaced review, the midterm and final</li>
            <li>Gradebook and certificate requirements</li>
            {course?.tokens ? <li>{formatTokens(course.tokens)} AI tutor tokens included</li> : null}
            <li>Course MCP server for Claude Code / Claude Desktop</li>
            <li>Lifetime access, including content updates</li>
          </ul>
          <div className="mt-4">
            {me?.paid ? <span className="chip bg-emerald-100 text-emerald-800">You own the full course</span> : course ? <BuyButton product={course} label="Unlock the full course" /> : <span className="text-sm text-ink-mute">Purchasing isn’t enabled on this deployment.</span>}
          </div>
        </div>
      </section>

      {packs.length > 0 && (
        <section className="card p-5">
          <h2 className="font-serif text-xl font-semibold">AI tutor token packs</h2>
          <p className="mt-1 text-sm text-ink-soft">The tutor is an AI agent that reads the course and your progress to help where you’re stuck. Top up any time; tokens never expire.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {packs.map((p) => (
              <div key={p.id} className="rounded-lg border border-paper-line p-4">
                <div className="font-semibold">{formatTokens(p.tokens)} tokens</div>
                <div className="text-sm text-ink-mute">{p.blurb}</div>
                <BuyButton product={p} className="mt-3 block" label={formatPrice(p.priceCents)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {me?.supportEmail && (
        <section className="card p-5 text-sm text-ink-soft">
          <h2 className="mb-2 font-serif text-xl font-semibold text-ink">Questions about billing or refunds?</h2>
          Email <a className="text-brand underline" href={`mailto:${me.supportEmail}`}>{me.supportEmail}</a>.
        </section>
      )}
    </div>
  );
}
