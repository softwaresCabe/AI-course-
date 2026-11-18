import { db, json } from '../_lib';

export const dynamic = 'force-dynamic';

/** Tells the client which server features are configured. */
export async function GET() {
  return json({ db: !!db(), ai: !!process.env.ANTHROPIC_API_KEY, auth: !!process.env.COURSE_ACCESS_TOKEN });
}
