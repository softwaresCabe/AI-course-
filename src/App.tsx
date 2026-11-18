import { useState } from 'react';
import { StoreProvider, useStore } from './lib/store';
import { useRoute, go } from './router';
import { weeks } from './content/course';
import { Home } from './views/Home';
import { WeekPage } from './views/WeekPage';
import { ExamPage } from './views/ExamPage';
import { Gradebook } from './views/Gradebook';
import { Syllabus } from './views/Syllabus';
import { FuturePage } from './views/FuturePage';
import { weekProgress } from './lib/scores';

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const route = useRoute();
  const [menu, setMenu] = useState(false);
  const { p, sync } = useStore();
  const m = route.match(/^week-(\d+)$/);
  const weekN = m ? Number(m[1]) : null;

  let page;
  if (weekN && weekN >= 1 && weekN <= 13) page = <WeekPage key={weekN} n={weekN} />;
  else if (route === 'midterm' || route === 'final') page = <ExamPage key={route} id={route} />;
  else if (route === 'gradebook') page = <Gradebook />;
  else if (route === 'syllabus') page = <Syllabus />;
  else if (route === 'future') page = <FuturePage />;
  else page = <Home />;

  const nav = (r: string) => {
    setMenu(false);
    go(r);
  };

  const Side = (
    <nav className="space-y-6 text-sm">
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
            return (
              <div key={w.n}>
                <NavItem active={weekN === w.n} onClick={() => nav(`week-${w.n}`)}>
                  <span className="flex items-center gap-2">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold ${pr.mastered ? 'bg-emerald-600 text-white' : pr.pct > 0 ? 'bg-brand-soft text-brand-deep' : 'bg-paper-line text-ink-mute'}`}>{pr.mastered ? '✓' : w.n}</span>
                    <span className="truncate">{w.title}</span>
                  </span>
                </NavItem>
                {w.n === 6 && <NavItem active={route === 'midterm'} onClick={() => nav('midterm')}><span className="pl-7 font-medium text-brand">Midterm exam</span></NavItem>}
                {w.n === 13 && <NavItem active={route === 'final'} onClick={() => nav('final')}><span className="pl-7 font-medium text-brand">Final exam</span></NavItem>}
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
          <button className="btn-ghost !px-3 !py-1.5" onClick={() => setMenu((x) => !x)} aria-label="Menu">
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

function NavItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`block w-full rounded-md px-3 py-1.5 text-left transition ${active ? 'bg-brand-soft font-medium text-brand-deep' : 'text-ink-soft hover:bg-paper-line/60'}`}>
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
