import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { INDEX_CACHE, LEDGER_DIR, PRODUCT_NAME } from './product.js';
import { getEmbedder, getProvider, type Provider } from './providers.js';
import { redact } from './redact.js';
import { type Config, type LedgerRecord, parseRecord } from './store.js';
import { enclosingSymbols } from './symbols.js';

// Bump when SCHEMA changes: older index files are deleted and rebuilt from .ledger/.
const SCHEMA_VERSION = 1;
const SCHEMA = `
CREATE TABLE records (
  id TEXT PRIMARY KEY, path TEXT NOT NULL UNIQUE, stamp TEXT NOT NULL,
  type TEXT NOT NULL, title TEXT NOT NULL, category TEXT, risk TEXT, status TEXT, severity TEXT,
  external_id TEXT, date TEXT NOT NULL, "commit" TEXT, body TEXT NOT NULL, front TEXT NOT NULL
);
CREATE TABLE record_files (id TEXT NOT NULL, path TEXT NOT NULL);
CREATE INDEX record_files_path ON record_files(path);
CREATE TABLE record_symbols (id TEXT NOT NULL, symbol TEXT NOT NULL);
CREATE INDEX record_symbols_symbol ON record_symbols(symbol);
CREATE TABLE record_issues (id TEXT NOT NULL, issue TEXT NOT NULL);
CREATE VIRTUAL TABLE records_fts USING fts5(id UNINDEXED, title, body, tokenize = 'porter unicode61');
CREATE TABLE embeddings (id TEXT PRIMARY KEY, model TEXT NOT NULL, vec BLOB NOT NULL);
PRAGMA user_version = ${SCHEMA_VERSION};
`;

export interface Index {
  db: DatabaseSync;
  root: string;
  errors: string[]; // invalid record files (reported, not indexed)
}

/** A record as returned by queries: front-matter plus repo-relative path. */
export type Hit = LedgerRecord & { path: string; match?: 'symbol' | 'file'; snippet?: string; matched_files?: string[] };

interface Row {
  path: string;
  front: string;
  body: string;
  snippet?: string;
}

const toHit = (r: Row): Hit => ({ ...(JSON.parse(r.front) as LedgerRecord), path: r.path, ...(r.snippet && { snippet: r.snippet }) });

/**
 * Opens the index, (re)building it if missing or outdated, then syncing it with .ledger/ by
 * mtime+size. One path covers write commands, git pulls and hand edits alike.
 */
export function openIndex(root: string): Index {
  mkdirSync(join(root, INDEX_CACHE), { recursive: true });
  const file = join(root, INDEX_CACHE, 'index.db');
  let db = new DatabaseSync(file);
  const version = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  if (version !== SCHEMA_VERSION) {
    if (version !== 0) {
      db.close();
      for (const f of [file, `${file}-wal`, `${file}-shm`]) rmSync(f, { force: true });
      db = new DatabaseSync(file);
    }
    db.exec(SCHEMA);
  }
  db.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;');
  return { db, root, errors: sync(db, root) };
}

export function syncIndex(root: string): string[] {
  const ix = openIndex(root);
  ix.db.close();
  return ix.errors;
}

/** Deletes the index and rebuilds it from .ledger/. */
export function reindex(root: string): { records: number; errors: string[] } {
  rmSync(join(root, INDEX_CACHE, 'index.db'), { force: true });
  for (const s of ['-wal', '-shm']) rmSync(join(root, INDEX_CACHE, `index.db${s}`), { force: true });
  const ix = openIndex(root);
  const records = (ix.db.prepare('SELECT count(*) AS n FROM records').get() as { n: number }).n;
  ix.db.close();
  return { records, errors: ix.errors };
}

function sync(db: DatabaseSync, root: string): string[] {
  // ponytail: stats every record file per open; fine to ~50k records, then watch mtimes of the dirs.
  const known = new Map((db.prepare('SELECT path, stamp FROM records').all() as { path: string; stamp: string }[]).map((r) => [r.path, r.stamp]));
  const seen = new Set<string>();
  const errors: string[] = [];
  const remove = (path: string): void => {
    const row = db.prepare('SELECT id FROM records WHERE path = ?').get(path) as { id: string } | undefined;
    if (!row) return;
    for (const t of ['records', 'record_files', 'record_symbols', 'record_issues', 'records_fts', 'embeddings']) {
      db.prepare(`DELETE FROM ${t} WHERE id = ?`).run(row.id);
    }
  };
  db.exec('BEGIN');
  try {
    for (const sub of ['changes', 'issues']) {
      const dir = join(root, LEDGER_DIR, sub);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
        const path = `${LEDGER_DIR}/${sub}/${f}`;
        const st = statSync(join(root, path));
        const stamp = `${st.mtimeMs}:${st.size}`;
        seen.add(path);
        if (known.get(path) === stamp) continue;
        remove(path);
        try {
          const { front, body } = parseRecord(readFileSync(join(root, path), 'utf8'));
          const issueOnly = front.type === 'issue' ? front : undefined;
          const changeOnly = front.type === 'change' ? front : undefined;
          db.prepare('INSERT INTO records VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
            front.id, path, stamp, front.type, front.title,
            changeOnly?.category ?? null, changeOnly?.risk ?? null, issueOnly?.status ?? null, issueOnly?.severity ?? null,
            issueOnly?.external_id ?? null, new Date(front.date).toISOString(), changeOnly?.commit ?? null, body, JSON.stringify(front),
          );
          for (const p of front.files) db.prepare('INSERT INTO record_files VALUES (?, ?)').run(front.id, p);
          for (const s of front.symbols) db.prepare('INSERT INTO record_symbols VALUES (?, ?)').run(front.id, s);
          for (const i of changeOnly?.issues ?? []) db.prepare('INSERT INTO record_issues VALUES (?, ?)').run(front.id, i);
          db.prepare('INSERT INTO records_fts (id, title, body) VALUES (?, ?, ?)').run(front.id, front.title, body);
        } catch (e) {
          remove(path);
          errors.push(`${path}: ${(e as Error).message}`);
        }
      }
    }
    for (const path of known.keys()) if (!seen.has(path)) remove(path);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return errors;
}

// ---- queries ------------------------------------------------------------------------------

const COLS = 'r.path, r.front, r.body';

const findRow = (ix: Index, ref: string): Row | undefined =>
  ix.db
    .prepare(`SELECT ${COLS} FROM records r WHERE id = ? OR external_id = ? ORDER BY type LIMIT 1`)
    .get(ref, /^\d+$/.test(ref) ? `#${ref}` : ref) as Row | undefined;

export function getRecord(ix: Index, ref: string): (Hit & { body: string }) | undefined {
  const row = findRow(ix, ref);
  return row && { ...toHit(row), body: row.body };
}

export function recent(ix: Index, limit = 20, type?: 'change' | 'issue'): Hit[] {
  const rows = type
    ? ix.db.prepare(`SELECT ${COLS} FROM records r WHERE type = ? ORDER BY date DESC, id DESC LIMIT ?`).all(type, limit)
    : ix.db.prepare(`SELECT ${COLS} FROM records r ORDER BY date DESC, id DESC LIMIT ?`).all(limit);
  return (rows as unknown as Row[]).map(toHit);
}

/** Records touching a file, or any file under it when `path` is a directory. Newest first. */
function touching(ix: Index, path: string): Hit[] {
  const dir = `${path.replace(/\/+$/, '')}/`;
  const rows = ix.db
    .prepare(`SELECT ${COLS} FROM records r WHERE id IN (SELECT id FROM record_files WHERE path = ? OR substr(path, 1, ?) = ?) ORDER BY date DESC, id DESC`)
    .all(path, dir.length, dir) as unknown as Row[];
  return rows.map(toHit);
}

/** Issues linked to these hits: issue records among them, plus issues their changes reference. */
function linkedIssues(ix: Index, hits: Hit[]): Hit[] {
  const out = new Map<string, Hit>();
  for (const h of hits) {
    if (h.type === 'issue') out.set(h.id, h);
    else for (const ref of h.issues) {
      const row = findRow(ix, ref);
      const i = row && toHit(row);
      if (i?.type === 'issue') out.set(i.id, i);
    }
  }
  return [...out.values()];
}

export interface WhyTarget {
  path: string; // repo-relative
  symbol?: string;
  line?: number;
}

export interface WhyResult {
  target: WhyTarget;
  anchored: Hit[]; // changes anchored to the symbol
  file_level: Hit[]; // other changes touching the file
  issues: Hit[]; // linked issues (to the symbol, if one is given): show these prominently
}

const symbolMatches = (want: string) => (s: string): boolean =>
  s === want || s.startsWith(`${want}.`) || s.endsWith(`.${want}`) || s.includes(`.${want}.`);

export function why(ix: Index, t: WhyTarget): WhyResult {
  const hits = touching(ix, t.path);
  const changes = hits.filter((h) => h.type === 'change');
  const anchored = t.symbol ? changes.filter((h) => h.symbols.some(symbolMatches(t.symbol ?? ''))).map((h) => ({ ...h, match: 'symbol' as const })) : [];
  const ids = new Set(anchored.map((h) => h.id));
  const fileLevel = changes.filter((h) => !ids.has(h.id)).map((h) => ({ ...h, match: 'file' as const }));
  // A bug in one function must not warn on its neighbours: with a symbol, only issues anchored to it count.
  const issueHits = t.symbol
    ? [...anchored, ...hits.filter((h) => h.type === 'issue' && h.symbols.some(symbolMatches(t.symbol ?? '')))]
    : hits;
  return { target: t, anchored, file_level: fileLevel, issues: linkedIssues(ix, issueHits) };
}

/** Past changes and bugs touching any of these files (for agents, before editing). */
export function related(ix: Index, files: string[]): { changes: Hit[]; issues: Hit[] } {
  const byId = new Map<string, Hit>();
  for (const f of files) {
    for (const h of touching(ix, f)) {
      const prev = byId.get(h.id);
      byId.set(h.id, { ...h, matched_files: [...(prev?.matched_files ?? []), f] });
    }
  }
  const hits = [...byId.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return { changes: hits.filter((h) => h.type === 'change'), issues: linkedIssues(ix, hits) };
}

/** `path`, `path:line` or `path#symbol`, relative to cwd. A line resolves to its enclosing symbol. */
export async function resolveTarget(root: string, cwd: string, spec: string): Promise<WhyTarget> {
  const m = /^(.*?)(?:#(.+)|:(\d+))?$/.exec(spec);
  const raw = m?.[1] ?? spec;
  const path = relative(root, isAbsolute(raw) ? raw : join(cwd, raw)).split('\\').join('/');
  if (path.startsWith('..')) throw new Error(`${spec} is outside the repository`);
  if (m?.[2]) return { path, symbol: m[2] };
  if (!m?.[3]) return { path };
  const line = Number(m[3]);
  const file = join(root, path);
  const syms = existsSync(file) ? await enclosingSymbols(path, readFileSync(file, 'utf8'), [line]) : null;
  return { path, line, ...(syms?.[0] && { symbol: syms[0] }) };
}

const ftsQuery = (q: string): string | null => {
  const terms = q.match(/[\p{L}\p{N}_]+/gu);
  return terms ? terms.map((t) => `"${t}"`).join(' OR ') : null;
};

const toVec = (b: Uint8Array): Float32Array => new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0;
    dot += x * y; na += x * x; nb += y * y;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Ranked FTS5 results, fused (reciprocal rank) with semantic results when search.semantic is on. */
export async function search(ix: Index, cfg: Config, q: string, limit = 10): Promise<{ hits: Hit[]; warnings: string[] }> {
  const warnings: string[] = [];
  const match = ftsQuery(q);
  const fts = match
    ? (ix.db.prepare(
        `SELECT r.path, r.front, r.body, snippet(records_fts, 2, '«', '»', '…', 14) AS snippet
         FROM records_fts JOIN records r ON r.id = records_fts.id WHERE records_fts MATCH ? ORDER BY bm25(records_fts) LIMIT ?`,
      ).all(match, limit * 2) as unknown as Row[]).map(toHit)
    : [];
  if (!cfg.search.semantic) return { hits: fts.slice(0, limit), warnings };

  let semantic: Hit[] = [];
  try {
    semantic = await semanticSearch(ix, cfg, q, limit * 2);
  } catch (e) {
    warnings.push(`semantic search unavailable, showing keyword results: ${(e as Error).message}`);
  }
  const score = new Map<string, { hit: Hit; s: number }>();
  for (const list of [fts, semantic]) {
    list.forEach((h, rank) => {
      const cur = score.get(h.id);
      score.set(h.id, { hit: cur?.hit.snippet ? cur.hit : h, s: (cur?.s ?? 0) + 1 / (60 + rank) });
    });
  }
  return { hits: [...score.values()].sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.hit), warnings };
}

async function semanticSearch(ix: Index, cfg: Config, q: string, limit: number): Promise<Hit[]> {
  const embed = getEmbedder(cfg);
  const model = `${cfg.search.provider ?? cfg.provider}:${cfg.search.model ?? ''}`;
  const pending = ix.db
    .prepare('SELECT r.id, r.title, r.body FROM records r LEFT JOIN embeddings e ON e.id = r.id AND e.model = ? WHERE e.id IS NULL')
    .all(model) as { id: string; title: string; body: string }[];
  for (let i = 0; i < pending.length; i += 32) {
    const batch = pending.slice(i, i + 32);
    const vecs = await embed(batch.map((r) => redact(`${r.title}\n\n${r.body}`, cfg.redaction.patterns).slice(0, 8000)));
    batch.forEach((r, j) => {
      const v = vecs[j];
      if (v) ix.db.prepare('INSERT OR REPLACE INTO embeddings VALUES (?, ?, ?)').run(r.id, model, new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
    });
  }
  const [qv] = await embed([redact(q, cfg.redaction.patterns)]);
  if (!qv) return [];
  // ponytail: brute-force cosine in JS; switch to sqlite-vec past ~100k records.
  const rows = ix.db.prepare(`SELECT ${COLS}, e.vec FROM embeddings e JOIN records r ON r.id = e.id WHERE e.model = ?`).all(model) as unknown as (Row & { vec: Uint8Array })[];
  return rows
    .map((r) => ({ r, s: cosine(qv, toVec(r.vec)) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ r }) => toHit(r));
}

export const issueWarning = (i: Hit): string =>
  i.type === 'issue'
    ? `⚠ This code was involved in ${i.external_id} (${i.status}${i.status === 'open' ? '' : ` ${(i.resolved_at ?? i.date).slice(0, 10)}`}): ${i.title}`
    : '';

/** AI answer to "why is this code like this?", citing record ids. Records are redacted before sending. */
export async function explain(ix: Index, cfg: Config, r: WhyResult, provider?: Provider): Promise<string> {
  const records = [...r.issues, ...r.anchored, ...r.file_level].slice(0, 15);
  if (!records.length) return 'No records touch this code yet.';
  const blocks = records.map((h) => {
    const body = getRecord(ix, h.id)?.body ?? '';
    return `### [${h.id}] ${h.type === 'issue' ? `issue ${h.external_id} (${h.status}, ${h.severity})` : `change ${h.commit} (${h.category}, risk ${h.risk})`} ${h.date.slice(0, 10)}\n${h.title}\n${body.slice(0, 2000)}`;
  });
  const target = `${r.target.path}${r.target.symbol ? `#${r.target.symbol}` : ''}`;
  const known = new Set(records.map((h) => h.id));
  const ask = (extra = '') =>
    (provider ?? getProvider(cfg))({
      system: `You are ${PRODUCT_NAME}. Answer "why is this code the way it is?" for an engineer about to change it, using ONLY the records given.
Be concise (under 200 words). Cite every claim with record ids in square brackets, e.g. [chg_...]. Lead with any past bugs/incidents and what must not regress. If the records don't explain something, say so.`,
      user: redact(`Target: ${target}\n\n${blocks.join('\n\n')}${extra}`, cfg.redaction.patterns),
    });
  let answer = await ask();
  let bad = unknownCitations(answer, known);
  if (bad.length) {
    answer = await ask(`\n\n## Your previous answer cited ids that are not in the records above: ${bad.join(', ')}\nAnswer again, citing only the ids shown.`);
    bad = unknownCitations(answer, known);
  }
  return bad.length ? stripCitations(answer, bad) : answer;
}

/** Record ids cited in `[...]` that are malformed or not among `known` (model hallucinations). */
export function unknownCitations(text: string, known: Set<string>): string[] {
  const bad = new Set<string>();
  for (const m of text.matchAll(/\[([^\]\n]*\b(?:chg|iss)_[^\]\n]*)\]/g)) {
    for (const tok of (m[1] ?? '').split(/[\s,;]+/)) {
      if (/^(?:chg|iss)_/.test(tok) && !known.has(tok)) bad.add(tok);
    }
  }
  return [...bad];
}

/** Removes bad ids from citation brackets; drops brackets left empty. */
export const stripCitations = (text: string, bad: string[]): string =>
  text.replace(/\[([^\]\n]*\b(?:chg|iss)_[^\]\n]*)\]/g, (_, inner: string) => {
    const keep = inner.split(/\s*[,;]\s*|\s+/).filter((t) => t && !bad.includes(t));
    return keep.length ? `[${keep.join(', ')}]` : '';
  });
