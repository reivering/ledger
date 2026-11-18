import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BIN_NAME, getRecordQuery, type Hit, issueWarning, recentQuery, relatedQuery, searchQuery, whyQuery } from '@ledger/core';
import { z } from 'zod';

/** Compact, citable shape for agents: ids + paths, no bodies. */
const brief = (h: Hit) => ({
  id: h.id,
  type: h.type,
  title: h.title,
  date: h.date,
  record_path: h.path,
  ...(h.type === 'change'
    ? { commit: h.commit, category: h.category, risk: h.risk, issues: h.issues }
    : { external_id: h.external_id, status: h.status, severity: h.severity, fix_commits: h.fix_commits }),
  files: h.files,
  symbols: h.symbols,
  ...(h.match && { match: h.match }),
  ...(h.matched_files && { matched_files: h.matched_files }),
  ...(h.snippet && { snippet: h.snippet }),
});

const text = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] });
const RO = { readOnlyHint: true, openWorldHint: false };

/** Read-only stdio MCP server over the repo's ledger, on the shared engine. Logs go to stderr; stdout is the protocol. */
export async function serve(root: string, version = '0.1.0'): Promise<void> {
  const server = new McpServer({ name: BIN_NAME, version });

  server.registerTool('ledger_why', {
    description:
      'Explain why a file or symbol is the way it is: the timeline of recorded changes and linked bugs/incidents touching it. ' +
      'Call this when you need the intent or history behind code before changing or questioning it. ' +
      'Results include record ids and record paths; cite them. Any entry in `warnings` is a past bug in this code: do not regress it.',
    inputSchema: {
      path: z.string().describe('Repo-relative file or directory path, e.g. "src/auth/refresh.ts"'),
      line: z.number().int().positive().optional().describe('1-based line; resolved to its enclosing function/class'),
      symbol: z.string().optional().describe('Function/class/method, e.g. "refreshToken" or "AuthClient.request"'),
    },
    annotations: RO,
  }, async ({ path, line, symbol }) => {
    const r = await whyQuery(root, root, symbol ? `${path}#${symbol}` : line ? `${path}:${line}` : path);
    return text({ target: r.target, warnings: r.warnings, issues: r.issues.map(brief), anchored: r.anchored.map(brief), file_level: r.file_level.map(brief) });
  });

  server.registerTool('ledger_related', {
    description:
      'Call ledger_related BEFORE modifying files to learn past bugs and decisions that touched them. ' +
      'Returns recorded changes and linked issues for the given files (newest first), with record ids to cite.',
    inputSchema: { files: z.array(z.string()).min(1).describe('Repo-relative paths you are about to edit') },
    annotations: RO,
  }, async ({ files }) => {
    const r = await relatedQuery(root, files);
    return text({ warnings: r.issues.map(issueWarning), issues: r.issues.map(brief), changes: r.changes.map(brief) });
  });

  server.registerTool('ledger_search', {
    description:
      'Full-text (and semantic, if enabled) search over the engineering ledger: change records and issues. ' +
      'Call this for questions like "why do we retry token refresh?" or "past incidents with payments" when you do not know the file.',
    inputSchema: { query: z.string().min(1), limit: z.number().int().min(1).max(50).optional() },
    annotations: RO,
  }, async ({ query, limit }) => {
    const r = await searchQuery(root, query, limit ?? 10);
    return text({ warnings: r.warnings, results: r.hits.map(brief) });
  });

  server.registerTool('ledger_get_record', {
    description: 'Fetch one full record (front-matter and Markdown body) by id ("chg_…", "iss_…") or issue ref ("#142"). Use after why/search/related to read details.',
    inputSchema: { id: z.string().min(1) },
    annotations: RO,
  }, async ({ id }) => {
    const r = await getRecordQuery(root, id);
    return r ? text({ ...brief(r), front: { ...r, body: undefined, path: undefined }, body: r.body }) : { ...text({ error: `no record ${id}` }), isError: true };
  });

  server.registerTool('ledger_recent', {
    description: 'List the most recent ledger records (changes and/or issues), newest first. Use to get oriented in an unfamiliar repo.',
    inputSchema: { limit: z.number().int().min(1).max(100).optional(), type: z.enum(['change', 'issue']).optional() },
    annotations: RO,
  }, async ({ limit, type }) => text({ results: (await recentQuery(root, limit ?? 20, type)).map(brief) }));

  await server.connect(new StdioServerTransport());
}
