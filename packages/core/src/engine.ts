import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { docsStatus } from './docs.js';
import { explain, getRecord, type Hit, type Index, issueWarning, openIndex, recent, related, resolveTarget, search, why, type WhyResult } from './db.js';
import { git } from './git.js';
import { getSection } from './issues.js';
import { LEDGER_DIR } from './product.js';
import type { Provider } from './providers.js';
import { loadConfig, SEVERITY } from './store.js';
import { changedLines, enclosingSymbols, listSymbols } from './symbols.js';

/**
 * The one engine behind the CLI, MCP server and `ledger serve` (VS Code). Every call opens the
 * index, which syncs it with .ledger/ on disk, so callers never see stale records.
 */
export async function withIndex<T>(root: string, fn: (ix: Index) => T | Promise<T>): Promise<T> {
  const ix = openIndex(root);
  try {
    for (const e of ix.errors) console.error(`invalid record: ${e}`);
    return await fn(ix);
  } finally {
    ix.db.close();
  }
}

export type WhyAnswer = WhyResult & { warnings: string[]; answer?: string; ai_error?: string };

/** `spec` is `path`, `path:line` or `path#symbol`, relative to `cwd`. */
export async function whyQuery(root: string, cwd: string, spec: string, o: { ai?: boolean; provider?: Provider } = {}): Promise<WhyAnswer> {
  const target = await resolveTarget(root, cwd, spec);
  return withIndex(root, async (ix) => {
    const r = why(ix, target);
    const out: WhyAnswer = { ...r, warnings: r.issues.map(issueWarning) };
    if (o.ai && (r.anchored.length || r.file_level.length)) {
      try {
        out.answer = await explain(ix, loadConfig(root), r, o.provider);
      } catch (e) {
        out.ai_error = (e as Error).message;
      }
    }
    return out;
  });
}

export const searchQuery = (root: string, query: string, limit = 10) =>
  withIndex(root, (ix) => search(ix, loadConfig(root), query, limit));
export const getRecordQuery = (root: string, id: string) => withIndex(root, (ix) => getRecord(ix, id));
export const relatedQuery = (root: string, files: string[]) => withIndex(root, (ix) => related(ix, files));
export const recentQuery = (root: string, limit = 20, type?: 'change' | 'issue') => withIndex(root, (ix) => recent(ix, limit, type));

export interface IssueBrief {
  id: string;
  external_id: string;
  title: string;
  status: string;
  severity: string;
  date: string;
  resolved_at?: string;
  root_cause: string;
  path: string;
}

function issueBrief(ix: Index, h: Hit): IssueBrief | null {
  if (h.type !== 'issue') return null;
  const rc = getSection(getRecord(ix, h.id)?.body ?? '', 'Root cause');
  return {
    id: h.id, external_id: h.external_id, title: h.title, status: h.status, severity: h.severity, date: h.date,
    ...(h.resolved_at && { resolved_at: h.resolved_at }),
    root_cause: rc.startsWith('_') ? '' : rc, // placeholder "_Unknown…_" is not a root cause
    path: h.path,
  };
}

export interface SymbolSummary {
  name: string;
  line: number;
  endLine: number;
  changes: number; // == `ledger why <path>#<name>` anchored count
  bugs: number;
  records: { id: string; title: string; date: string; category: string; path: string }[]; // newest 3
  issues: IssueBrief[];
}

/** Per-symbol record and bug counts for one file (CodeLens, hover, diagnostics). `text` = unsaved buffer. */
export async function fileSummary(root: string, path: string, text?: string): Promise<{ path: string; symbols: SymbolSummary[] }> {
  const file = join(root, path);
  const source = text ?? (existsSync(file) ? readFileSync(file, 'utf8') : '');
  const syms = (await listSymbols(path, source)) ?? [];
  return withIndex(root, (ix) => ({
    path,
    symbols: syms.flatMap((s) => {
      const r = why(ix, { path, symbol: s.name });
      if (!r.anchored.length && !r.issues.length) return [];
      return [{
        name: s.name, line: s.line, endLine: s.endLine,
        changes: r.anchored.length,
        bugs: r.issues.length,
        records: r.anchored.slice(0, 3).map((h) => ({ id: h.id, title: h.title, date: h.date, category: h.type === 'change' ? h.category : '', path: h.path })),
        issues: r.issues.flatMap((h) => issueBrief(ix, h) ?? []),
      }];
    }),
  }));
}

// ---- check ---------------------------------------------------------------------------------

export const FINDING_SEVERITY = ['info', ...SEVERITY] as const; // info < low < medium < high < critical
export type FindingSeverity = (typeof FINDING_SEVERITY)[number];
export const severityRank = (s: FindingSeverity): number => FINDING_SEVERITY.indexOf(s);

export interface Finding {
  severity: FindingSeverity;
  kind: 'repeat-bug' | 'high-risk-change' | 'stale-doc';
  path: string;
  symbol?: string;
  message: string;
  records: string[];
}

export interface CheckOptions {
  staged?: boolean; // index vs HEAD
  diff?: string; // unified diff text; new side = working tree
  range?: string; // "a..b"
}

const show = (root: string, spec: string): string => {
  try {
    return git(root, ['show', spec]);
  } catch {
    return '';
  }
};

/** Maps changed lines to symbols and reports past bugs, high-risk changes and stale docs touching them. */
export async function check(root: string, o: CheckOptions = {}): Promise<Finding[]> {
  let diff: string;
  let oldSide: (p: string) => string;
  let newSide: (p: string) => string;
  const worktree = (p: string): string => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : '');
  if (o.range) {
    const [a, b] = o.range.split('..');
    if (!a || !b) throw new Error('--range must look like <a>..<b>');
    diff = git(root, ['diff', '--no-color', '--no-ext-diff', '--no-renames', a, b]);
    oldSide = (p) => show(root, `${a}:${p}`);
    newSide = (p) => show(root, `${b}:${p}`);
  } else if (o.staged) {
    diff = git(root, ['diff', '--cached', '--no-color', '--no-ext-diff', '--no-renames']);
    oldSide = (p) => show(root, `HEAD:${p}`);
    newSide = (p) => show(root, `:${p}`);
  } else {
    diff = o.diff ?? git(root, ['diff', 'HEAD', '--no-color', '--no-ext-diff', '--no-renames']);
    oldSide = (p) => show(root, `HEAD:${p}`);
    newSide = worktree;
  }

  const touched: { path: string; symbols: string[] | null }[] = [];
  for (const chunk of diff.split(/^(?=diff --git )/m)) {
    const path = /^\+\+\+ b\/(.+)$/m.exec(chunk)?.[1] ?? /^--- a\/(.+)$/m.exec(chunk)?.[1];
    if (!path || path.startsWith(`${LEDGER_DIR}/`)) continue;
    const { added, removed } = changedLines(chunk);
    const a = added.length ? await enclosingSymbols(path, newSide(path), added) : [];
    const r = removed.length ? await enclosingSymbols(path, oldSide(path), removed) : [];
    touched.push({ path, symbols: a === null || r === null ? null : [...new Set([...a, ...r])] });
  }

  const findings = new Map<string, Finding>();
  const add = (f: Finding): void => void findings.set(`${f.kind}:${f.records.join()}:${f.path}:${f.symbol ?? ''}`, f);
  await withIndex(root, (ix) => {
    for (const t of touched) {
      // Unsupported language: fall back to file-level.
      for (const symbol of t.symbols ?? [undefined]) {
        const r = why(ix, { path: t.path, ...(symbol && { symbol }) });
        const where = symbol ? `${t.path}#${symbol}` : t.path;
        for (const h of r.issues) {
          const i = issueBrief(ix, h);
          if (!i) continue;
          const when = i.status === 'open' ? 'open' : `${i.status} ${(i.resolved_at ?? i.date).slice(0, 10)}`;
          add({
            severity: i.severity as FindingSeverity,
            kind: 'repeat-bug',
            path: t.path,
            ...(symbol && { symbol }),
            message: `${where} previously caused ${i.external_id} (${when}): ${i.title}.${i.root_cause ? ` Root cause: ${i.root_cause.split('\n')[0]}` : ''}`,
            records: [i.id],
          });
        }
        for (const h of symbol ? r.anchored : []) {
          if (h.type === 'change' && h.risk === 'high') {
            add({ severity: 'medium', kind: 'high-risk-change', path: t.path, symbol, message: `${where} was changed in a high-risk change ${h.commit}: ${h.title}`, records: [h.id] });
          }
        }
      }
    }
  });
  for (const d of await docsStatus(root)) {
    if (!d.stale) continue;
    const what = d.changes.map((c) => `${c.file}#${c.symbol} ${c.change}`).join(', ');
    add({ severity: 'info', kind: 'stale-doc', path: d.path, message: `doc for module "${d.module}" is stale (${what}); run \`ledger docs update ${d.module}\``, records: [] });
  }
  return [...findings.values()].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}
