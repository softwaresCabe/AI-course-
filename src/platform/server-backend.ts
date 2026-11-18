// Backend for the Next.js deployment: gated content, AI, progress and billing all go through /api routes.
import type { Exam, Week } from '../content/types';
import { LockedError, type Backend, type Me, type ReviewItem, type TutorEvent } from '../lib/platform';

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
  }
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: 'no-store', ...init });
  const body = (await r.json().catch(() => ({}))) as { error?: string } & T;
  if (r.status === 401 && body.error === 'signin_required') throw new LockedError('signin_required');
  if (r.status === 402 && body.error === 'purchase_required') throw new LockedError('purchase_required');
  if (!r.ok) throw new HttpError(r.status, body.error ?? 'error');
  return body;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export function serverBackend(): Backend {
  // Content never changes during a session; cache per entitlement (cleared when /api/me changes).
  const weeks = new Map<number, Promise<Week>>();
  const cached = <K, V>(m: Map<K, Promise<V>>, k: K, load: () => Promise<V>) => {
    if (!m.has(k)) {
      const p = load();
      m.set(k, p);
      p.catch(() => m.delete(k)); // don't cache failures (e.g. locked before purchase)
    }
    return m.get(k)!;
  };

  return {
    content: {
      week: (n) => cached(weeks, n, () => getJson<{ week: Week }>(`/api/content/week/${n}`).then((r) => r.week)),
      exam: (id) => getJson<{ exam: Exam }>(`/api/content/exam/${id}`).then((r) => r.exam),
      review: (n) => getJson<{ items: ReviewItem[] }>(`/api/content/review?week=${n}`).then((r) => r.items),
    },
    ai: {
      async tutor(week, messages, onEvent, signal) {
        const r = await fetch('/api/tutor', { ...jsonInit('POST', { week: week.n, messages }), signal });
        if (!r.ok || !r.body) {
          const body = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
          onEvent({ type: 'error', code: body.error ?? `http_${r.status}`, message: body.message ?? 'The tutor is unavailable right now.' });
          return;
        }
        // NDJSON: one TutorEvent per line.
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (line) onEvent(JSON.parse(line) as TutorEvent);
          }
        }
      },
      async grade(q, answer) {
        const r = await fetch('/api/grade', jsonInit('POST', { questionId: q.id, answer }));
        if (!r.ok) return null;
        return (await r.json()) as { scores: number[]; feedback: string };
      },
    },
    async loadMe() {
      const me = await getJson<Me>('/api/me');
      weeks.clear();
      return me;
    },
    async checkout(productId) {
      const { url } = await getJson<{ url: string }>('/api/checkout', jsonInit('POST', { product: productId }));
      return url;
    },
    async confirmCheckout(sessionId) {
      await getJson('/api/checkout/confirm', jsonInit('POST', { sessionId }));
    },
    progress: {
      async get() {
        return (await getJson<{ data: unknown | null }>('/api/progress')).data;
      },
      async put(data) {
        const init = jsonInit('PUT', data);
        // keepalive lets the final save survive the tab closing (browsers cap keepalive bodies at 64 KB).
        await getJson('/api/progress', { ...init, keepalive: String(init.body).length < 60_000 });
      },
    },
    apiKeys: {
      list: () => getJson<{ keys: { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null }[] }>('/api/keys').then((r) => r.keys),
      create: (name) => getJson<{ id: string; key: string }>('/api/keys', jsonInit('POST', { name })),
      revoke: (id) => getJson(`/api/keys?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).then(() => undefined),
    },
  };
}
