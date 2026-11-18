import { existsSync, watch } from 'node:fs';
import { join } from 'node:path';
import {
  check, type CheckOptions, docsStatus, fileSummary, getRecordQuery, LEDGER_DIR, recentQuery, recordCommit, reindex,
  relatedQuery, searchQuery, syncIndex, whyQuery, withIndex,
} from '@ledger/core';
import { frame, type Message, reader } from '@ledger/core/rpc';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- params are validated by each engine call
type Params = Record<string, any>;

/** JSON-RPC 2.0 over stdio (LSP framing) on the shared engine. stdout is the protocol; logs go to stderr. */
export function serveStdio(root: string): void {
  const send = (m: Message): boolean => process.stdout.write(frame(m));
  const target = (p: Params): string => (p.symbol ? `${p.path}#${p.symbol}` : p.line ? `${p.path}:${p.line}` : String(p.path));
  const methods: Record<string, (p: Params) => unknown> = {
    status: () => withIndex(root, (ix) => ({ root, records: (ix.db.prepare('SELECT count(*) AS n FROM records').get() as { n: number }).n, errors: ix.errors })),
    why: (p) => whyQuery(root, root, target(p), { ai: Boolean(p.ai) }),
    search: (p) => searchQuery(root, String(p.query), p.limit),
    getRecord: (p) => getRecordQuery(root, String(p.id)),
    related: (p) => relatedQuery(root, p.files),
    recent: (p) => recentQuery(root, p.limit, p.type),
    fileSummary: (p) => fileSummary(root, String(p.path), p.text),
    check: (p) => check(root, p as CheckOptions),
    docsStatus: () => docsStatus(root),
    reindex: () => reindex(root),
    record: (p) => recordCommit(root, { rev: p.rev }),
  };

  process.stdin.on('data', reader(async (m) => {
    if (m.id === undefined || !m.method) return; // client notifications: none defined
    const fn = methods[m.method];
    if (!fn) return void send({ jsonrpc: '2.0', id: m.id, error: { code: -32601, message: `unknown method ${m.method}` } });
    try {
      send({ jsonrpc: '2.0', id: m.id, result: (await fn((m.params ?? {}) as Params)) ?? null });
    } catch (e) {
      send({ jsonrpc: '2.0', id: m.id, error: { code: -32603, message: (e as Error).message } });
    }
  }));
  process.stdin.on('end', () => process.exit(0));

  // Records written by hooks, git pulls or hand edits: resync the index, then tell the client.
  const dir = join(root, LEDGER_DIR);
  if (!existsSync(dir)) return;
  let timer: NodeJS.Timeout | undefined;
  watch(dir, { recursive: true }, (_, file) => {
    if (file && String(file).startsWith('.cache')) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        syncIndex(root);
      } catch (e) {
        console.error(`reindex failed: ${(e as Error).message}`);
      }
      send({ jsonrpc: '2.0', method: 'ledger/indexChanged', params: {} });
    }, 200);
  });
}
