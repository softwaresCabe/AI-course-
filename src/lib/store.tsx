import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { getCapability, serverHealth, serverHeaders } from './runtime';

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

function loadLocal(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...empty(), ...JSON.parse(raw) };
  } catch {
    /* storage unavailable */
  }
  return empty();
}

function saveLocal(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
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

export function StoreProvider({ children }: { children: ReactNode }) {
  const [p, setP] = useState<Progress>(loadLocal);
  const [sync, setSync] = useState<SyncState>('connecting');
  // A storage backend: the Claude artifact database, or the Next.js /api/progress route (Postgres).
  const backend = useRef<{ get: () => Promise<Progress | null>; set: (d: Progress) => Promise<void> } | null>(null);
  const pending = useRef<Progress | null>(null);
  const writing = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(async () => {
    if (writing.current || !pending.current || !backend.current) return;
    writing.current = true;
    const data = pending.current;
    pending.current = null;
    setSync('saving');
    try {
      await backend.current.set(JSON.parse(JSON.stringify(data)));
      setSync('synced');
    } catch {
      setSync('error');
    } finally {
      writing.current = false;
      if (pending.current) flush();
    }
  }, []);

  const queueWrite = useCallback(
    (data: Progress) => {
      pending.current = data;
      clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, 1200);
    },
    [flush],
  );

  useEffect(() => {
    let cancelled = false;
    const giveUp = window.setTimeout(() => !cancelled && !backend.current && setSync('local'), 12000);
    (async () => {
      try {
        const [db, user] = await Promise.all([getCapability('db'), getCapability('user')]);
        if (db && user) {
          const id = await user.id();
          const ref = db.collection('data/users/' + id).doc('progress');
          backend.current = {
            get: async () => {
              const snap = await ref.get();
              const v = snap && (typeof snap.data === 'function' ? snap.data() : snap);
              return v && v.version === 1 ? (v as Progress) : null;
            },
            set: (d) => ref.set(d),
          };
        } else {
          const h = await serverHealth();
          if (h?.db) {
            const learner = encodeURIComponent(localStorage.getItem('aie600-learner') || 'default');
            backend.current = {
              get: async () => {
                const r = await fetch(`/api/progress?learner=${learner}`, { headers: serverHeaders(), cache: 'no-store' });
                if (!r.ok) throw new Error(String(r.status));
                return ((await r.json()) as { data: Progress | null }).data;
              },
              set: async (d) => {
                const r = await fetch(`/api/progress?learner=${learner}`, { method: 'PUT', headers: serverHeaders({ 'content-type': 'application/json' }), body: JSON.stringify(d) });
                if (!r.ok) throw new Error(String(r.status));
              },
            };
          }
        }
        if (cancelled) return;
        if (!backend.current) {
          setSync('local');
          return;
        }
        const remote = await backend.current.get();
        setP((local) => {
          const fresh = local.updatedAt > new Date(0).toISOString();
          const winner = remote && (remote.updatedAt ?? '') > local.updatedAt ? { ...empty(), ...remote } : local;
          saveLocal(winner);
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
  }, [queueWrite]);

  const update = useCallback(
    (fn: (p: Progress) => void) => {
      setP((prev) => {
        const next: Progress = structuredClone(prev);
        fn(next);
        next.updatedAt = new Date().toISOString();
        saveLocal(next);
        queueWrite(next);
        return next;
      });
    },
    [queueWrite],
  );

  const replaceAll = useCallback(
    (np: Progress) => {
      const next = { ...empty(), ...np, updatedAt: new Date().toISOString() };
      saveLocal(next);
      queueWrite(next);
      setP(next);
    },
    [queueWrite],
  );

  return <StoreCtx.Provider value={{ p, update, sync, replaceAll }}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('StoreProvider missing');
  return c;
}
