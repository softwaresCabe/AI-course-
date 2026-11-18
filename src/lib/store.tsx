import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { getCapability } from './runtime';

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
  const docRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const pending = useRef<Progress | null>(null);
  const writing = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  // Connect to the artifact database (per-person private doc) if available.
  useEffect(() => {
    let cancelled = false;
    const giveUp = window.setTimeout(() => !cancelled && !docRef.current && setSync('local'), 12000);
    (async () => {
      const [db, user] = await Promise.all([getCapability('db'), getCapability('user')]);
      if (cancelled) return;
      if (!db || !user) {
        setSync('local');
        return;
      }
      try {
        const id = await user.id();
        const ref = db.collection('data/users/' + id).doc('progress');
        docRef.current = ref;
        const snap = await ref.get();
        const remote = snap && (typeof snap.data === 'function' ? snap.data() : snap);
        if (remote && remote.version === 1) {
          setP((local) => {
            const winner = (remote.updatedAt ?? '') > local.updatedAt ? { ...empty(), ...remote } : local;
            saveLocal(winner);
            if (winner === local && local.updatedAt > new Date(0).toISOString()) queueWrite(local);
            return winner;
          });
        } else {
          setP((local) => {
            if (local.updatedAt > new Date(0).toISOString()) queueWrite(local);
            return local;
          });
        }
        setSync('synced');
      } catch {
        setSync('local');
      } finally {
        clearTimeout(giveUp);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(giveUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flush = useCallback(async () => {
    if (writing.current || !pending.current || !docRef.current) return;
    writing.current = true;
    const data = pending.current;
    pending.current = null;
    setSync('saving');
    try {
      await docRef.current.set(JSON.parse(JSON.stringify(data)));
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
