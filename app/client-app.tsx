'use client';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { UserButton, useAuth, useClerk } from '@clerk/nextjs';
import type { Catalog } from '../src/content/catalog';
import type { AuthState } from '../src/lib/platform';
import { serverBackend } from '../src/platform/server-backend';

// The course UI is a client-side app (hash routing, localStorage); render it only in the browser.
const App = dynamic(() => import('../src/App'), { ssr: false, loading: () => <div className="p-8 text-sm text-ink-mute">Loading course…</div> });

export default function ClientApp({ catalog, clerkEnabled }: { catalog: Catalog; clerkEnabled: boolean }) {
  const backend = useMemo(() => serverBackend(), []);
  return clerkEnabled ? <WithClerk catalog={catalog} backend={backend} /> : <App catalog={catalog} backend={backend} />;
}

function WithClerk({ catalog, backend }: { catalog: Catalog; backend: ReturnType<typeof serverBackend> }) {
  const { isLoaded, isSignedIn, userId, signOut } = useAuth();
  const clerk = useClerk();
  const auth = useMemo<AuthState>(
    () => ({
      enabled: true,
      loaded: isLoaded,
      signedIn: !!isSignedIn,
      userId: userId ?? null,
      signIn: () => clerk.openSignIn({ forceRedirectUrl: location.href }),
      signOut: () => void signOut(),
      accountButton: <UserButton />,
    }),
    [isLoaded, isSignedIn, userId, clerk, signOut],
  );
  return <App catalog={catalog} backend={backend} auth={auth} />;
}
