// The only module that talks to Clerk. Kept tiny so tests can replace it.
import { auth, clerkClient } from '@clerk/nextjs/server';

export async function sessionUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

export async function primaryEmail(userId: string): Promise<string | null> {
  try {
    const u = await (await clerkClient()).users.getUser(userId);
    const primary = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId);
    // Only trust verified addresses (admin access is granted by email).
    return primary && primary.verification?.status === 'verified' ? primary.emailAddress.toLowerCase() : null;
  } catch {
    return null;
  }
}
