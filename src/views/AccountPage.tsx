import { useEffect, useState } from 'react';
import { usePlatform } from '../lib/platform';
import { formatTokens } from '../lib/format';
import { BuyButton } from '../components/Paywall';
import { go } from '../router';

type Key = { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null };

export function AccountPage() {
  const { me, auth, refreshMe, confirmCheckout } = usePlatform();
  const [notice, setNotice] = useState<string | null>(null);

  // Returning from Stripe Checkout: entitlements arrive via webhook, so poll briefly.
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const status = q.get('checkout');
    const sessionId = q.get('session_id');
    if (!status) return;
    history.replaceState(null, '', location.pathname + location.hash);
    if (status === 'cancel') return setNotice('Checkout cancelled — you have not been charged.');
    setNotice('Payment received — unlocking your purchase…');
    if (sessionId && confirmCheckout) void confirmCheckout(sessionId).then(refreshMe, () => {});
    let n = 0;
    const t = setInterval(async () => {
      await refreshMe();
      if (++n >= 6) {
        clearInterval(t);
        setNotice('Payment received. If anything is still locked, reload in a minute.');
      }
    }, 2000);
    return () => clearInterval(t);
  }, [refreshMe, confirmCheckout]);

  if (!auth.enabled || !me) return <div className="text-sm text-ink-mute">Accounts aren’t enabled on this deployment.</div>;
  if (!me.signedIn)
    return (
      <div className="card p-6">
        <h1 className="font-serif text-2xl font-semibold">Your account</h1>
        <button className="btn-primary mt-4" onClick={auth.signIn}>
          Sign in
        </button>
      </div>
    );

  const packs = me.products.filter((p) => p.kind === 'tokens');
  return (
    <div className="space-y-8">
      <header>
        <div className="kicker">Account</div>
        <h1 className="mt-1 font-serif text-3xl font-bold">Plan, tutor tokens & integrations</h1>
      </header>
      {notice && <div className="card border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</div>}

      <section className="card p-5">
        <div className="kicker">Plan</div>
        <div className="mt-1 text-xl font-semibold">{me.admin ? 'Admin — full access' : me.paid ? 'Full course' : 'Free'}</div>
        <p className="mt-1 text-sm text-ink-soft">
          {me.paid ? 'All 13 weeks, exams, capstone and certificate requirements are unlocked.' : 'Week 1 and Week 2 are free. Unlock the full course to continue past Week 2.'}
        </p>
        {!me.paid && (
          <button className="btn-primary mt-3" onClick={() => go('pricing')}>
            See the full course
          </button>
        )}
      </section>

      <section className="card p-5">
        <div className="kicker">AI tutor tokens</div>
        {me.tokens ? (
          <>
            <div className="mt-1 font-serif text-3xl font-bold">{formatTokens(me.tokens.balance)}</div>
            <p className="mt-1 text-sm text-ink-soft">
              Each tutor reply uses tokens for what the tutor reads and writes (a typical question costs 5–15k). Tokens never expire.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {packs.map((p) => (
                <BuyButton key={p.id} product={p} />
              ))}
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-ink-soft">Unmetered on this account.</p>
        )}
      </section>

      {me.features.mcp && me.paid && <McpKeys />}
    </div>
  );
}

function McpKeys() {
  const { apiKeys } = usePlatform();
  const [keys, setKeys] = useState<Key[] | null>(null);
  const [name, setName] = useState('');
  const [created, setCreated] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const reload = () => apiKeys?.list().then(setKeys, () => setErr('Couldn’t load keys.'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void reload(), []);
  if (!apiKeys) return null;
  const url = `${location.origin}/api/mcp`;
  return (
    <section className="card p-5">
      <div className="kicker">Course MCP server</div>
      <p className="mt-1 text-sm text-ink-soft">
        Connect Claude Code, Claude Desktop or any MCP client to the course: search lectures, read sections and labs, and check your own progress from your editor while you work on a lab.
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-paper p-3 font-mono text-xs">{`claude mcp add --transport http aie600 ${url} \\\n  --header "Authorization: Bearer <your key>"`}</pre>
      {created && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          <div className="font-medium">Copy your new key now — it won’t be shown again.</div>
          <code className="mt-1 block break-all font-mono text-xs">{created}</code>
        </div>
      )}
      <form
        className="mt-3 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          try {
            const r = await apiKeys.create(name.trim() || 'MCP key');
            setCreated(r.key);
            setName('');
            reload();
          } catch {
            setErr('Couldn’t create a key.');
          }
        }}
      >
        <input className="input" placeholder="Key name (e.g. laptop)" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary shrink-0">Create key</button>
      </form>
      {err && <div className="mt-2 text-sm text-red-700">{err}</div>}
      <ul className="mt-3 divide-y divide-paper-line text-sm">
        {keys?.map((k) => (
          <li key={k.id} className="flex items-center justify-between gap-3 py-2">
            <div>
              <div className="font-medium">{k.name}</div>
              <div className="font-mono text-xs text-ink-mute">
                {k.prefix}… · created {new Date(k.createdAt).toLocaleDateString()} · {k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : 'never used'}
              </div>
            </div>
            <button className="btn-ghost !px-3 !py-1 text-xs" onClick={() => apiKeys.revoke(k.id).then(reload)}>
              Revoke
            </button>
          </li>
        ))}
        {keys?.length === 0 && <li className="py-2 text-ink-mute">No keys yet.</li>}
      </ul>
    </section>
  );
}
