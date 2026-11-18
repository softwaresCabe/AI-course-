import { useState } from 'react';
import { StoreProvider, useStore } from './lib/store';
import { useRoute, go } from './router';
import { catalog, setCatalog, type Catalog } from './content/catalog';
import { Home } from './views/Home';
import { WeekPage } from './views/WeekPage';
import { ExamPage } from './views/ExamPage';
import { Gradebook } from './views/Gradebook';
import { Syllabus } from './views/Syllabus';
import { FuturePage } from './views/FuturePage';
import { AccountPage } from './views/AccountPage';
import { PricingPage } from './views/PricingPage';
import { weekProgress } from './lib/scores';
import { PlatformProvider, usePlatform, type AuthState, type Backend } from './lib/platform';
import { canAccess } from './lib/access';
import { formatTokens } from './lib/format';

const NO_AUTH: AuthState = { enabled: false, loaded: true, signedIn: false, userId: null, signIn() {}, signOut() {} };

export default function App({ catalog: cat, backend, auth = NO_AUTH }: { catalog: Catalog; backend: Backend; auth?: AuthState }) {
  setCatalog(cat);
  return (
    <PlatformProvider backend={backend} auth={auth}>
      <ScopedStore>
        <Shell />
      </ScopedStore>
    </PlatformProvider>
  );
}

/** Progress belongs to the signed-in user; sync it to the server only once we know the deployment has a database. */
function ScopedStore({ children }: { children: React.ReactNode }) {
  const { auth, me, progress } = usePlatform();
  const scope = auth.signedIn && auth.userId ? auth.userId : 'anon';
  const remote = me && progress && (me.mode === 'artifact' || (me.features.db && me.signedIn)) ? progress : null;
  return (
    <StoreProvider key={`${scope}:${remote ? 1 : 0}`} scope={scope} remote={remote}>
      {children}
    </StoreProvider>
  );
}

function Shell() {
  const route = useRoute();
  const [menu, setMenu] = useState(false);
  const { p, sync } = useStore();
  const { me } = usePlatform();
  const weeks = catalog().weeks;
  const m = route.match(/^week-(\d+)$/);
  const weekN = m ? Number(m[1]) : null;
  const ent = { signedIn: !!me?.signedIn, paid: !!me?.paid };

  let page;
  if (weekN && weekN >= 1 && weekN <= weeks.length) page = <WeekPage key={weekN} n={weekN} />;
  else if (route === 'midterm' || route === 'final') page = <ExamPage key={route} id={route} />;
  else if (route === 'gradebook') page = <Gradebook />;
  else if (route === 'syllabus') page = <Syllabus />;
  else if (route === 'future') page = <FuturePage />;
  else if (route === 'account') page = <AccountPage />;
  else if (route === 'pricing') page = <PricingPage />;
  else page = <Home />;

  const nav = (r: string) => {
    setMenu(false);
    go(r);
  };

  const Side = (
    <nav className="space-y-6 text-sm">
      <AccountBox onNav={nav} />
      <div className="space-y-0.5">
        <NavItem active={route === 'home'} onClick={() => nav('home')}>Overview</NavItem>
        <NavItem active={route === 'syllabus'} onClick={() => nav('syllabus')}>Syllabus & grading</NavItem>
        <NavItem active={route === 'gradebook'} onClick={() => nav('gradebook')}>Gradebook</NavItem>
      </div>
      <div>
        <div className="kicker mb-1 px-3">Weeks</div>
        <div className="space-y-0.5">
          {weeks.map((w) => {
            const pr = weekProgress(p, w.n);
            const open = !me || canAccess(w.access, ent);
            return (
              <div key={w.n}>
                <NavItem active={weekN === w.n} onClick={() => nav(`week-${w.n}`)}>
                  <span className="flex items-center gap-2">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold ${pr.mastered ? 'bg-emerald-600 text-white' : pr.pct > 0 ? 'bg-brand-soft text-brand-deep' : 'bg-paper-line text-ink-mute'}`}>{pr.mastered ? '✓' : w.n}</span>
                    <span className="truncate">{w.title}</span>
                    {!open && <LockIcon />}
                    {open && w.access !== 'paid' && me?.mode === 'auth' && !me.paid && <span className="chip ml-auto shrink-0 bg-emerald-100 !px-1.5 !py-0 text-[0.6rem] text-emerald-800">Free</span>}
                  </span>
                </NavItem>
                {w.n === 6 && (
                  <NavItem active={route === 'midterm'} onClick={() => nav('midterm')}>
                    <span className="flex items-center gap-2 pl-7 font-medium text-brand">Midterm exam {me && !me.paid && <LockIcon />}</span>
                  </NavItem>
                )}
                {w.n === 13 && (
                  <NavItem active={route === 'final'} onClick={() => nav('final')}>
                    <span className="flex items-center gap-2 pl-7 font-medium text-brand">Final exam {me && !me.paid && <LockIcon />}</span>
                  </NavItem>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="space-y-0.5">
        <NavItem active={route === 'future'} onClick={() => nav('future')}>Future of AI paths</NavItem>
      </div>
      <SyncBadge sync={sync} />
    </nav>
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-paper-line bg-paper/90 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <button className="font-serif text-lg font-bold" onClick={() => nav('home')}>
            AIE 600
          </button>
          <button className="btn-ghost !px-3 !py-1.5" onClick={() => setMenu((x) => !x)} aria-label="Menu" aria-expanded={menu}>
            {menu ? 'Close' : 'Menu'}
          </button>
        </div>
        {menu && <div className="max-h-[75vh] overflow-y-auto border-t border-paper-line bg-paper px-2 py-4">{Side}</div>}
      </header>
      <div className="mx-auto flex max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 overflow-y-auto border-r border-paper-line px-3 py-6 lg:block">
          <button className="mb-6 px-3 text-left" onClick={() => nav('home')}>
            <div className="font-serif text-xl font-bold leading-tight">AIE 600</div>
            <div className="text-xs text-ink-mute">AI Engineering: First Principles to Production</div>
          </button>
          {Side}
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-12 lg:py-10">
          <div className="mx-auto max-w-3xl">{page}</div>
          <footer className="mx-auto mt-16 max-w-3xl border-t border-paper-line pt-4 text-xs text-ink-mute">
            Course content reviewed for technical accuracy as of November 2026. Fast-moving details (specific products, SDK method names, benchmarks) change — verify against current docs.
          </footer>
        </main>
      </div>
    </div>
  );
}

function AccountBox({ onNav }: { onNav: (r: string) => void }) {
  const { auth, me } = usePlatform();
  if (!auth.enabled) return null;
  if (!auth.loaded || !me)
    return <div className="mx-3 h-16 animate-pulse rounded-lg bg-paper-line/60" />;
  if (!auth.signedIn)
    return (
      <div className="card mx-1 space-y-2 p-3">
        <div className="text-xs text-ink-soft">Week 1 is open to everyone. Create a free account to save progress and unlock Week 2.</div>
        <button className="btn-primary w-full !py-1.5" onClick={auth.signIn}>
          Sign in / create account
        </button>
      </div>
    );
  return (
    <div className="card mx-1 space-y-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <button className="text-left text-xs font-medium text-ink-soft hover:text-brand" onClick={() => onNav('account')}>
          {me.admin ? 'Admin · full access' : me.paid ? 'Full course unlocked' : 'Free plan'}
        </button>
        {auth.accountButton}
      </div>
      {me.tokens && (
        <button className="flex w-full items-center justify-between text-xs text-ink-mute hover:text-brand" onClick={() => onNav('account')}>
          <span>AI tutor tokens</span>
          <span className="font-mono">{formatTokens(me.tokens.balance)}</span>
        </button>
      )}
      {!me.paid && (
        <button className="btn-primary w-full !py-1.5" onClick={() => onNav('pricing')}>
          Unlock the full course
        </button>
      )}
    </div>
  );
}

function LockIcon() {
  return (
    <svg aria-label="Locked" className="ml-auto h-3.5 w-3.5 shrink-0 text-ink-mute" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-.5V4.5A3.5 3.5 0 0 0 8 1Zm2 6H6V4.5a2 2 0 1 1 4 0V7Z" />
    </svg>
  );
}

function NavItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-current={active ? 'page' : undefined} className={`block w-full rounded-md px-3 py-1.5 text-left transition ${active ? 'bg-brand-soft font-medium text-brand-deep' : 'text-ink-soft hover:bg-paper-line/60'}`}>
      {children}
    </button>
  );
}

function SyncBadge({ sync }: { sync: string }) {
  const label = { local: 'Saved in this browser', connecting: 'Connecting…', synced: 'Progress synced', saving: 'Saving…', error: 'Sync error — saved locally' }[sync] ?? sync;
  const dot = sync === 'synced' ? 'bg-emerald-500' : sync === 'error' ? 'bg-red-500' : sync === 'saving' || sync === 'connecting' ? 'bg-amber-400' : 'bg-ink-mute';
  return (
    <div className="flex items-center gap-2 px-3 text-xs text-ink-mute">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </div>
  );
}
