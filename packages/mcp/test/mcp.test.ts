import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterEach, expect, it } from 'vitest';
import { env, seededRepo } from '../../core/test/fixture.js';

const CLI = fileURLToPath(new URL('../../cli/dist/index.js', import.meta.url));
let repo: Awaited<ReturnType<typeof seededRepo>> | undefined;
afterEach(() => repo?.cleanup());

const json = (r: unknown): Record<string, unknown> => JSON.parse((r as { content: { text: string }[] }).content[0]!.text);

it('`ledger mcp` serves read-only tools: why + related flag the linked bug', async () => {
  repo = await seededRepo();
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [CLI, 'mcp'], cwd: repo.dir, env: env as Record<string, string> }));
  try {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['ledger_get_record', 'ledger_recent', 'ledger_related', 'ledger_search', 'ledger_why']);
    expect(tools.every((t) => t.annotations?.readOnlyHint)).toBe(true);

    const w = json(await client.callTool({ name: 'ledger_why', arguments: { path: 'src/auth.ts', symbol: 'refreshToken' } }));
    expect(w.warnings).toEqual(['⚠ This code was involved in #1 (open): Login times out under load']);
    expect((w.anchored as { record_path: string }[])[0]!.record_path).toMatch(/^\.ledger\/changes\/.*fix-1/);

    const rel = json(await client.callTool({ name: 'ledger_related', arguments: { files: ['src/auth.ts', 'src/other.ts'] } }));
    expect((rel.changes as unknown[]).length).toBe(2);
    expect((rel.issues as { external_id: string }[])[0]!.external_id).toBe('#1');

    const got = json(await client.callTool({ name: 'ledger_get_record', arguments: { id: '#1' } }));
    expect(got.body).toContain('thundering herd');
  } finally {
    await client.close();
  }
});
