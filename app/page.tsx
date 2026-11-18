import ClientApp from './client-app';
import { publicCatalog } from '../server/content';

export const dynamic = 'force-dynamic'; // auth mode depends on runtime env

export default function Page() {
  const clerkEnabled = !!(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  // Only the public catalog crosses to the client; lecture content is fetched per week, after access checks.
  return <ClientApp catalog={publicCatalog} clerkEnabled={clerkEnabled} />;
}
