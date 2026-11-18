// Claude artifact runtime (window.claude.use) — only present when the course is opened as a Claude artifact.

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
