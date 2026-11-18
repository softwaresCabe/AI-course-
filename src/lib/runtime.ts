// Thin wrappers around the optional Claude artifact runtime (window.claude.use).
// Everything degrades gracefully: locally or when a capability is unavailable,
// these resolve to null and the app falls back to localStorage / self-grading.

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

/** Ask Claude for JSON. Returns null if the capability isn't available. Throws on refusal/rate limit. */
export async function askJson<T>(prompt: string): Promise<T | null> {
  const sample = await getCapability('sample');
  if (!sample) return null;
  return (await sample.json(prompt, { modelTier: 'default' })) as T;
}

/** Stream a text answer from Claude. */
export async function askText(
  messages: { role: 'user' | 'assistant'; content: string }[],
  onText: (t: string) => void,
  signal?: AbortSignal,
): Promise<string | null> {
  const sample = await getCapability('sample');
  if (!sample) return null;
  const res = await sample(messages, { onText: ({ text }: { text: string }) => onText(text), signal, cache: false });
  return res.text as string;
}
