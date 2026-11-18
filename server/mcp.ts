// The course MCP server: the same tools the AI tutor uses, exposed over Streamable HTTP so students can
// use the course from Claude Code, Claude Desktop or any MCP client while working on labs.
// Built on the v2 TypeScript SDK (@modelcontextprotocol/server), the same one Week 11 teaches.
// Stateless: createMcpHandler builds a fresh server per request, scoped to the API key's owner, and
// also serves 2025-era clients through its stateless legacy fallback.
import { McpServer, createMcpHandler, type McpRequestContext } from '@modelcontextprotocol/server';
import { courseTools } from './tools';
import type { Viewer } from './viewer';

const INSTRUCTIONS = `Tools for the AIE 600 AI Engineering course. Use list_weeks to see the syllabus, search_course to find where a topic is taught, then read_section / get_lab for the full text. get_my_progress and get_missed_questions show the student's own progress (never quiz answers). Exams are closed-book: don't use these tools to help with the midterm or final.`;

export function buildMcpServer(viewer: Viewer) {
  const server = new McpServer({ name: 'aie600-course', version: '1.0.0' }, { instructions: INSTRUCTIONS });
  for (const t of courseTools) {
    server.registerTool(
      t.name,
      { description: t.description, inputSchema: t.schema, annotations: { readOnlyHint: true, openWorldHint: false } },
      async (input: unknown) => {
        const parsed = t.schema.safeParse(input ?? {});
        if (!parsed.success) return { isError: true, content: [{ type: 'text' as const, text: `Invalid input: ${parsed.error.message}` }] };
        try {
          return { content: [{ type: 'text' as const, text: await t.run(parsed.data, viewer) }] };
        } catch {
          return { isError: true, content: [{ type: 'text' as const, text: 'Tool failed.' }] };
        }
      },
    );
  }
  return server;
}

const DENY: Viewer = { userId: null, signedIn: false, paid: false, admin: false, open: false, via: 'anonymous' };
const viewerOf = (ctx: McpRequestContext) => (ctx.authInfo?.extra?.viewer as Viewer | undefined) ?? DENY;

const handler = createMcpHandler((ctx) => buildMcpServer(viewerOf(ctx)), {
  responseMode: 'json',
  maxRequestBodySize: 256 * 1024,
  onerror: (e) => console.error('mcp error', e.message),
});

/** Serve one MCP request as `viewer` (already authenticated by the route). */
export function handleMcp(req: Request, viewer: Viewer): Promise<Response> {
  return handler.fetch(req, { authInfo: { token: 'verified', clientId: viewer.userId ?? 'local', scopes: ['course:read'], extra: { viewer } } });
}
