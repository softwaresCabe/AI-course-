import { useState } from 'react';
import { usePlatform, type LockReason, type Product } from '../lib/platform';
import { formatPrice, formatTokens } from '../lib/format';
import { go } from '../router';

/** Shown in place of gated content: sign-in prompt (free tier) or the course purchase. */
export function Paywall({ reason, what }: { reason: LockReason; what: string }) {
  const { auth, me } = usePlatform();
  const course = me?.products.find((p) => p.kind === 'course');
  if (reason === 'signin_required')
    return (
      <div className="card border-2 border-brand/30 p-6 text-center">
        <div className="kicker">Free with an account</div>
        <h2 className="mt-1 font-serif text-2xl font-semibold">Sign in to open {what}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
          A free account unlocks Week 2, saves your progress across devices, and includes starter tokens for the AI tutor.
        </p>
        <button className="btn-primary mt-4" onClick={auth.signIn} disabled={!auth.enabled}>
          Create a free account
        </button>
      </div>
    );
  return (
    <div className="card border-2 border-brand/30 p-6">
      <div className="kicker">Part of the full course</div>
      <h2 className="mt-1 font-serif text-2xl font-semibold">Unlock {what}</h2>
      <p className="mt-2 text-sm text-ink-soft">
        The full course covers all 13 weeks of lectures and labs, 13 graded quizzes, the midterm and final, the capstone, the certificate checklist
        {course?.tokens ? `, and ${formatTokens(course.tokens)} AI tutor tokens` : ''}. One payment, lifetime access, no subscription.
      </p>
      {course ? <BuyButton product={course} className="mt-4" /> : <p className="mt-4 text-sm text-ink-mute">Purchasing isn’t enabled on this deployment yet.</p>}
      <button className="ml-3 mt-4 text-sm text-brand underline-offset-2 hover:underline" onClick={() => go('pricing')}>
        What’s included
      </button>
    </div>
  );
}

export function BuyButton({ product, className = '', label }: { product: Product; className?: string; label?: string }) {
  const { checkout, auth, me } = usePlatform();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const disabled = busy || !checkout || !me?.features.payments;
  return (
    <span className={className}>
      <button
        className="btn-primary"
        disabled={disabled}
        onClick={async () => {
          if (!me?.signedIn) return auth.signIn();
          setBusy(true);
          setErr(null);
          try {
            location.assign(await checkout!(product.id));
          } catch {
            setErr('Couldn’t start checkout. Please try again.');
            setBusy(false);
          }
        }}
      >
        {busy ? 'Redirecting…' : (label ?? `${product.name} · ${formatPrice(product.priceCents)}`)}
      </button>
      {err && <span className="ml-3 text-sm text-red-700">{err}</span>}
    </span>
  );
}
