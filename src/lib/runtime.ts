// Backends for AI + sync, in order of preference:
//  1. Claude artifact runtime (window.claude.use) — when the course is opened as a Claude artifact.
//  2. Next.js API routes (/api/ai, /api/progress) — when deployed with ANTHROPIC_API_KEY / DATABASE_URL.
//  3. Nothing — the app falls back to localStorage and self-grading.

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    claude?: { use: (name: string) => Promise<any> };
  }
}

const cache = new Map<string, Promise<any>>();

export function getCapability(name: string): Promise<any | null> {
  if (!cache.has(name)) {
    const p = (async () => {
      // window.claude may be injected after our first script run; wait briefly.
      for (let i = 0; i < 20 && !window.claude; i++) await new Promise((r) => setTimeout(r, 100));
      if (!window.claude) return null;
      try {
        return await Promise.race([window.claude.use(name), new Promise((r) => setTimeout(() => r(null), 10000))]);
      } catch {
        return null;
      }
    })();
    cache.set(name, p);
  }
  return cache.get(name)!;
}

// ---------- Next.js server (optional) ----------

export interface ServerHealth {
  db: boolean;
  ai: boolean;
  auth: boolean;
}

let healthP: Promise<ServerHealth | null> | null = null;
export function serverHealth(): Promise<ServerHealth | null> {
  healthP ??= (async () => {
    if (location.protocol === 'file:') return null;
    try {
      const r = await fetch('/api/health', { cache: 'no-store' });
      if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return null;
      return (await r.json()) as ServerHealth;
    } catch {
      return null;
    }
  })();
  return healthP;
}

const TOKEN_KEY = 'aie600-server-token';
export function serverToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}
export function setServerToken(t: string) {
  try {
    localStorage.setItem(TOKEN_KEY, t);
  } catch {
    /* ignore */
  }
}
export function serverHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const t = serverToken();
  return t ? { ...extra, authorization: `Bearer ${t}` } : extra;
}

/** Ask Claude for JSON. Returns null if no AI backend is available. Throws on refusal/rate limit. */
export async function askJson<T>(prompt: string): Promise<T | null> {
  const sample = await getCapability('sample');
  if (sample) return (await sample.json(prompt, { modelTier: 'default' })) as T;
  const h = await serverHealth();
  if (!h?.ai) return null;
  const r = await fetch('/api/ai', {
    method: 'POST',
    headers: serverHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ mode: 'json', messages: [{ role: 'user', content: prompt }] }),
  });
  if (!r.ok) throw Object.assign(new Error('ai error'), { code: r.status === 429 ? 'rate_limited' : r.status === 401 ? 'not_granted' : 'error' });
  return ((await r.json()) as { value: T }).value;
}

/** Stream a text answer from Claude. Returns null if no AI backend is available. */
export async function askText(
  messages: { role: 'user' | 'assistant'; content: string }[],
  onText: (t: string) => void,
  signal?: AbortSignal,
): Promise<string | null> {
  const sample = await getCapability('sample');
  if (sample) {
    const res = await sample(messages, { onText: ({ text }: { text: string }) => onText(text), signal, cache: false });
    return res.text as string;
  }
  const h = await serverHealth();
  if (!h?.ai) return null;
  const r = await fetch('/api/ai', {
    method: 'POST',
    headers: serverHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ mode: 'text', messages }),
    signal,
  });
  if (!r.ok || !r.body) throw Object.assign(new Error('ai error'), { code: r.status === 429 ? 'rate_limited' : r.status === 401 ? 'not_granted' : 'error' });
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += dec.decode(value, { stream: true });
    onText(text);
  }
  return text;
}

/** True if any AI backend is available. */
export async function aiAvailable(): Promise<boolean> {
  if (await getCapability('sample')) return true;
  return !!(await serverHealth())?.ai;
}
