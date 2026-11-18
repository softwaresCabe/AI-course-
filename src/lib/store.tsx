import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export interface Attempt {
  date: string;
  earned: number;
  max: number;
  answers: Record<string, unknown>;
  perQuestion: Record<string, { earned: number; max: number; feedback?: string }>;
}

export interface LabRecord {
  rubric: number[]; // points awarded per rubric item
  repoUrl?: string;
  notes?: string;
  submitted?: boolean;
}

export interface Progress {
  version: 1;
  startDate?: string; // ISO date
  name?: string;
  read: Record<string, boolean>; // "w3-s2"
  checklist: Record<string, boolean>; // "w3-c4"
  quizzes: Record<string, Attempt[]>; // "w3"
  exams: Record<string, Attempt>; // "midterm" | "final"
  examStarted: Record<string, string>; // examId -> ISO start time
  labs: Record<string, LabRecord>; // "w3"
  review: Record<string, { seen: number; correct: number }>; // question id
  updatedAt: string;
}

const KEY = 'aie600-progress-v1';
// Progress is cached per identity so two people sharing a browser never see each other's work.
const keyFor = (scope: string) => (scope === 'anon' ? KEY : `${KEY}:${scope}`);

const empty = (): Progress => ({
  version: 1,
  read: {},
  checklist: {},
  quizzes: {},
  exams: {},
  examStarted: {},
  labs: {},
  review: {},
  updatedAt: new Date(0).toISOString(),
});

function loadLocal(scope: string): Progress {
  try {
    // First visit as a signed-in user: start from the anonymous progress made before signing in.
    const raw = localStorage.getItem(keyFor(scope)) ?? (scope !== 'anon' ? localStorage.getItem(KEY) : null);
    if (raw) return { ...empty(), ...JSON.parse(raw) };
  } catch {
    /* storage unavailable */
  }
  return empty();
}

function saveLocal(scope: string, p: Progress) {
  try {
    localStorage.setItem(keyFor(scope), JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

type SyncState = 'local' | 'connecting' | 'synced' | 'saving' | 'error';

interface Ctx {
  p: Progress;
  update: (fn: (p: Progress) => void) => void;
  sync: SyncState;
  replaceAll: (p: Progress) => void;
}

const StoreCtx = createContext<Ctx | null>(null);

export interface RemoteProgress {
  get(): Promise<unknown | null>;
  put(data: unknown): Promise<void>;
}

/**
 * scope: who the progress belongs to ('anon' or a user id). remote: server/artifact persistence, if any.
 * Remount (key={scope}) when the identity changes.
 */
export function StoreProvider({ children, scope = 'anon', remote }: { children: ReactNode; scope?: string; remote?: RemoteProgress | null }) {
  const [p, setP] = useState<Progress>(() => loadLocal(scope));
  const [sync, setSync] = useState<SyncState>(remote ? 'connecting' : 'local');
  const backend = useRef<RemoteProgress | null>(null);
  const pending = useRef<Progress | null>(null);
  const writing = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(async function flushNow(): Promise<void> {
    if (writing.current || !pending.current || !backend.current) return;
    writing.current = true;
    const data = pending.current;
    pending.current = null;
    setSync('saving');
    try {
      await backend.current.put(JSON.parse(JSON.stringify(data)));
      if (!pending.current) setSync('synced');
    } catch {
      setSync('error');
    } finally {
      writing.current = false;
      if (pending.current) void flushNow();
    }
  }, []);

  // Debounce writes, but never starve them: a learner clicking steadily still syncs at least every 5s.
  const firstQueued = useRef<number | null>(null);
  const queueWrite = useCallback(
    (data: Progress) => {
      pending.current = data;
      if (backend.current) setSync('saving'); // unsaved changes pending — never show "synced" over them
      clearTimeout(timer.current);
      const now = Date.now();
      firstQueued.current ??= now;
      const wait = now - firstQueued.current >= 5000 ? 0 : 1200;
      timer.current = window.setTimeout(() => {
        firstQueued.current = null;
        void flush();
      }, wait);
    },
    [flush],
  );

  // Flush immediately when the tab is hidden or closed.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && pending.current) {
        clearTimeout(timer.current);
        firstQueued.current = null;
        void flush();
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [flush]);

  useEffect(() => {
    if (!remote) return;
    let cancelled = false;
    const giveUp = window.setTimeout(() => !cancelled && !backend.current && setSync('local'), 12000);
    (async () => {
      try {
        const raw = (await remote.get()) as Progress | null;
        if (cancelled) return;
        backend.current = remote;
        const valid = raw && raw.version === 1 ? raw : null;
        setP((local) => {
          const fresh = local.updatedAt > new Date(0).toISOString();
          const winner = valid && (valid.updatedAt ?? '') > local.updatedAt ? { ...empty(), ...valid } : local;
          saveLocal(scope, winner);
          if (winner === local && fresh) queueWrite(local);
          return winner;
        });
        setSync('synced');
      } catch {
        backend.current = null;
        if (!cancelled) setSync('local');
      } finally {
        clearTimeout(giveUp);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(giveUp);
    };
  }, [remote, scope, queueWrite]);

  const update = useCallback(
    (fn: (p: Progress) => void) => {
      setP((prev) => {
        const next: Progress = structuredClone(prev);
        fn(next);
        next.updatedAt = new Date().toISOString();
        saveLocal(scope, next);
        queueWrite(next);
        return next;
      });
    },
    [queueWrite, scope],
  );

  const replaceAll = useCallback(
    (np: Progress) => {
      const next = { ...empty(), ...np, updatedAt: new Date().toISOString() };
      saveLocal(scope, next);
      queueWrite(next);
      setP(next);
    },
    [queueWrite, scope],
  );

  return <StoreCtx.Provider value={{ p, update, sync, replaceAll }}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('StoreProvider missing');
  return c;
}
