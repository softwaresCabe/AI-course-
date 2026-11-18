// Deployment configuration, read from the environment. Every paid/AI feature is optional and
// reported to the client via /api/me so the UI never offers something the server can't do.

const env = (k: string) => process.env[k]?.trim() || undefined;
const int = (k: string, d: number) => {
  const v = Number(env(k));
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : d;
};

export const config = {
  get authEnabled() {
    return !!(env('CLERK_SECRET_KEY') && env('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'));
  },
  /**
   * Open mode = no accounts, everything unlocked, AI unmetered. For local study and personal deployments.
   * Never implicit in production: there it requires OPEN_ACCESS=true, otherwise a missing Clerk key
   * fails closed (paid content stays locked).
   */
  get openAccess() {
    if (env('OPEN_ACCESS') === 'true') return true;
    if (env('OPEN_ACCESS') === 'false') return false;
    return !this.authEnabled && process.env.NODE_ENV !== 'production';
  },
  get dbEnabled() {
    return !!env('DATABASE_URL');
  },
  get aiEnabled() {
    return !!env('ANTHROPIC_API_KEY');
  },
  get paymentsEnabled() {
    return !!(env('STRIPE_SECRET_KEY') && env('STRIPE_WEBHOOK_SECRET'));
  },
  get model() {
    return env('ANTHROPIC_MODEL') ?? 'claude-opus-5-5';
  },
  get tutorEffort(): 'low' | 'medium' | 'high' {
    const e = env('TUTOR_EFFORT');
    return e === 'low' || e === 'high' ? e : 'medium';
  },
  /** Comma-separated emails or Clerk user ids that get full, unmetered access (e.g. the course author). */
  get admins(): string[] {
    return (env('ADMIN_EMAILS') ?? '')
      .concat(',', env('ADMIN_USER_IDS') ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  },
  get siteUrl() {
    return (env('NEXT_PUBLIC_SITE_URL') ?? env('SITE_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
  },
  get supportEmail() {
    return env('SUPPORT_EMAIL');
  },
  /** Tutor tokens granted once to every new account. */
  get signupTokens() {
    return int('FREE_TUTOR_TOKENS', 50_000);
  },
  get currency() {
    return (env('CURRENCY') ?? 'usd').toLowerCase();
  },
  get coursePriceCents() {
    return int('COURSE_PRICE_CENTS', 19_900);
  },
  /** Tutor tokens bundled with the course purchase. */
  get courseTokens() {
    return int('COURSE_INCLUDED_TOKENS', 1_000_000);
  },
  /** Daily cap on AI rubric gradings per user (they are free, so cap abuse). */
  get gradesPerDay() {
    return int('GRADES_PER_DAY', 60);
  },
  get tutorRequestsPerHour() {
    return int('TUTOR_REQUESTS_PER_HOUR', 60);
  },
};
