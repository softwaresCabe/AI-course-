import { json, rateLimit } from '../../../server/http';
import { getViewer } from '../../../server/viewer';
import { handleMcp } from '../../../server/mcp';

export const dynamic = 'force-dynamic';

/**
 * Course MCP server (Streamable HTTP, stateless JSON responses).
 *   claude mcp add --transport http aie600 https://<site>/api/mcp --header "Authorization: Bearer aie_…"
 */
async function handle(req: Request) {
  const v = await getViewer(req, { allowApiKey: true });
  if (!v.signedIn)
    return json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized: create a key on your course Account page and send it as "Authorization: Bearer aie_…".' }, id: null }, 401, {
      'www-authenticate': 'Bearer realm="aie600"',
    });
  if (!v.open && !(await rateLimit(`mcp:${v.userId}`, 600, 3600))) return json({ jsonrpc: '2.0', error: { code: -32029, message: 'Rate limited' }, id: null }, 429);
  return handleMcp(req, v);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
