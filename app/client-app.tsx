'use client';
import dynamic from 'next/dynamic';

// The course UI is a client-side app (hash routing, localStorage); render it only in the browser.
const App = dynamic(() => import('../src/App'), { ssr: false, loading: () => <div className="p-8 text-sm text-ink-mute">Loading course…</div> });

export default function ClientApp() {
  return <App />;
}
