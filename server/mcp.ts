// The course MCP server: the same tools the AI tutor uses, exposed over Streamable HTTP so students can
// use the course from Claude Code, Claude Desktop or any MCP client while working on labs.
// Stateless: a fresh server + transport per request, scoped to the API key's owner.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
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

export async function handleMcp(req: Request, viewer: Viewer): Promise<Response> {
  const server = buildMcpServer(viewer);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    // JSON-response mode has finished writing by the time handleRequest resolves.
    void server.close();
  }
}
