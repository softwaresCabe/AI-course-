import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Exam, Question, ShortAnswer, Week } from '../content/types';

// The UI talks to "a platform" rather than to fetch() or bundled content directly, so the same
// React app runs as (a) the paid Next.js product (content + AI served by gated API routes) and
// (b) the single-file Claude artifact build (everything local, AI via the artifact runtime).

export type LockReason = 'signin_required' | 'purchase_required';

export class LockedError extends Error {
  readonly reason: LockReason;
  constructor(reason: LockReason) {
    super(reason);
    this.reason = reason;
  }
}

export interface ReviewItem {
  week: number;
  q: Question;
}

export interface ContentSource {
  week(n: number): Promise<Week>;
  exam(id: Exam['id']): Promise<Exam>;
  review(n: number): Promise<ReviewItem[]>;
}

export type TutorEvent =
  | { type: 'text'; text: string }
  | { type: 'tool'; name: string; label: string }
  | { type: 'usage'; charged: number; balance: number | null }
  | { type: 'error'; code: string; message: string };

export type ChatMsg = { role: 'user' | 'assistant'; content: string };

export interface AiClient {
  /** Streams tutor events. Resolves when the turn ends. */
  tutor(week: Week, messages: ChatMsg[], onEvent: (e: TutorEvent) => void, signal?: AbortSignal): Promise<void>;
  /** Rubric-grade a written answer. null = AI grading unavailable (fall back to self-grading). */
  grade(q: ShortAnswer, answer: string): Promise<{ scores: number[]; feedback: string } | null>;
}

export interface Product {
  id: string;
  kind: 'course' | 'tokens';
  name: string;
  priceCents: number;
  tokens: number;
  blurb: string;
}

export interface Me {
  mode: 'open' | 'auth' | 'artifact';
  signedIn: boolean;
  paid: boolean;
  admin: boolean;
  /** null = no metering (open mode, admin or artifact). */
  tokens: { balance: number } | null;
  features: { ai: boolean; db: boolean; payments: boolean; mcp: boolean };
  products: Product[];
  supportEmail?: string;
}

export interface AuthState {
  enabled: boolean;
  loaded: boolean;
  signedIn: boolean;
  userId: string | null;
  signIn(): void;
  signOut(): void;
  /** Rendered in the sidebar when signed in (e.g. Clerk's <UserButton/>). */
  accountButton?: ReactNode;
}

export interface Backend {
  content: ContentSource;
  ai: AiClient;
  loadMe(): Promise<Me>;
  /** Start a Stripe checkout for a product; resolves to a redirect URL. */
  checkout?(productId: string): Promise<string>;
  /** After returning from checkout: fulfil the session now rather than waiting for the webhook. */
  confirmCheckout?(sessionId: string): Promise<void>;
  /** Progress persistence for the signed-in learner, if the deployment has a database. */
  progress?: { get(): Promise<unknown | null>; put(data: unknown): Promise<void> };
  /** Course MCP API keys (Next.js deployment only). */
  apiKeys?: {
    list(): Promise<{ id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null }[]>;
    create(name: string): Promise<{ id: string; key: string }>;
    revoke(id: string): Promise<void>;
  };
}

interface Ctx extends Backend {
  auth: AuthState;
  me: Me | null;
  refreshMe(): Promise<void>;
}

const PlatformCtx = createContext<Ctx | null>(null);

export function PlatformProvider({ backend, auth, children }: { backend: Backend; auth: AuthState; children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const refreshMe = useCallback(async () => {
    try {
      setMe(await backend.loadMe());
    } catch {
      /* keep the last known state */
    }
  }, [backend]);
  // Reload entitlements whenever the signed-in identity changes.
  useEffect(() => {
    if (!auth.loaded) return;
    let live = true;
    backend
      .loadMe()
      .then((m) => live && setMe(m))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [backend, auth.loaded, auth.userId]);
  return <PlatformCtx.Provider value={{ ...backend, auth, me, refreshMe }}>{children}</PlatformCtx.Provider>;
}

export function usePlatform(): Ctx {
  const c = useContext(PlatformCtx);
  if (!c) throw new Error('PlatformProvider missing');
  return c;
}

/** Load a piece of gated content; exposes locked state for upsell UI. */
export function useContent<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; locked?: LockReason; error?: boolean; loading: boolean }>({ loading: true });
  useEffect(() => {
    let live = true;
    setState({ loading: true });
    load().then(
      (data) => live && setState({ data, loading: false }),
      (e) => live && setState(e instanceof LockedError ? { locked: e.reason, loading: false } : { error: true, loading: false }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
