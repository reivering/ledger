import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { z } from 'zod';
import { getRecord, openIndex, related, stripCitations, type Hit, unknownCitations } from './db.js';
import { git } from './git.js';
import { BIN_NAME, LEDGER_DIR, PRODUCT_NAME } from './product.js';
import { generate, getProvider, type Provider } from './providers.js';
import { redact } from './redact.js';
import { type Config, loadConfig, nowIso, slugify } from './store.js';
import { listSymbols } from './symbols.js';

const DOCS_DIR = `${LEDGER_DIR}/docs/modules`;

const Anchor = z.strictObject({ file: z.string(), symbol: z.string(), hash: z.string() });
type Anchor = z.infer<typeof Anchor>;
export const DocSchema = z.strictObject({
  type: z.literal('doc'),
  module: z.string().min(1),
  paths: z.array(z.string()).min(1),
  generated_at: z.iso.datetime({ offset: true }),
  generated_by: z.strictObject({ provider: z.string(), model: z.string() }),
  anchors: z.array(Anchor),
});
export type DocFront = z.infer<typeof DocSchema>;

function serializeDoc(front: DocFront, body: string): string {
  const doc = new YAML.Document(DocSchema.parse(front));
  YAML.visit(doc, {
    Seq: (_, n) => void (n.items.every((i) => YAML.isScalar(i)) && (n.flow = true)),
    Map: (_, n, path) => void (path.length > 1 && (n.flow = true)),
  });
  return `---\n${doc.toString({ lineWidth: 0 })}---\n\n${body.trim()}\n`;
}

function parseDoc(text: string): { front: DocFront; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) throw new Error('missing YAML front-matter');
  return { front: DocSchema.parse(YAML.parse(m[1] ?? '')), body: m[2] ?? '' };
}

// ---- generated blocks ---------------------------------------------------------------------

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const blockRe = (key: string): RegExp => new RegExp(`<!-- ledger:begin ${esc(key)} -->[\\s\\S]*?<!-- ledger:end ${esc(key)} -->\\n?`);
const HEADINGS: Record<string, string> = {
  overview: '## What it does',
  decisions: '## Key decisions',
  pitfalls: '## Known pitfalls and bugs',
  recent: '## Recent changes',
};
const heading = (key: string): string => HEADINGS[key] ?? `### \`${key.replace(/^file:/, '')}\``;
const block = (key: string, content: string): string =>
  `<!-- ledger:begin ${key} -->\n${heading(key)}\n\n${content.trim()}\n<!-- ledger:end ${key} -->\n`;

/** Replaces (or inserts) one generated block; text outside blocks is never touched. */
export function putBlock(body: string, key: string, content: string): string {
  const b = block(key, content);
  if (blockRe(key).test(body)) return body.replace(blockRe(key), () => b);
  const recent = body.indexOf('<!-- ledger:begin recent -->');
  return recent < 0 ? `${body.trimEnd()}\n\n${b}` : `${body.slice(0, recent)}${b}\n${body.slice(recent)}`;
}
const dropBlock = (body: string, key: string): string => body.replace(blockRe(key), '');

// ---- module resolution --------------------------------------------------------------------

interface Module {
  name: string;
  paths: string[];
}

const docPath = (root: string, name: string): string => join(root, DOCS_DIR, `${name}.md`);

function resolveModule(root: string, cfg: Config, arg: string): Module {
  const configured = cfg.docs.modules[arg];
  if (configured) return { name: arg, paths: typeof configured === 'string' ? [configured] : configured };
  if (existsSync(docPath(root, arg))) {
    const { front } = parseDoc(readFileSync(docPath(root, arg), 'utf8'));
    return { name: arg, paths: front.paths };
  }
  const path = arg.replace(/^\.\/+|\/+$/g, '');
  if (!existsSync(join(root, path)) || !statSync(join(root, path)).isDirectory()) {
    throw new Error(`"${arg}" is not a configured module (docs.modules) or a folder`);
  }
  return { name: slugify(path), paths: [path] };
}

const moduleFiles = (root: string, paths: string[]): string[] =>
  git(root, ['ls-files', '-z', '--', ...paths]).split('\0').filter((f) => f && !f.startsWith(`${LEDGER_DIR}/`));

const readWorking = (root: string, f: string): string | null => (existsSync(join(root, f)) ? readFileSync(join(root, f), 'utf8') : null);

/** Current anchors (symbol + content hash) for files; files in unsupported languages have none. */
async function anchorsFor(root: string, files: string[]): Promise<Map<string, Anchor[]>> {
  const out = new Map<string, Anchor[]>();
  for (const file of files) {
    const src = readWorking(root, file);
    const syms = src === null ? null : await listSymbols(file, src);
    if (syms?.length) out.set(file, syms.map((s) => ({ file, symbol: s.name, hash: s.hash })));
  }
  return out;
}

// ---- generation ---------------------------------------------------------------------------

const CITED = /\[(?:chg|iss)_[0-9A-Z]{26}\]|`[^`\n]*[./][^`\n]*`/;

function recentBlock(records: Hit[]): string {
  const lines = records.slice(0, 12).map((h) =>
    h.type === 'issue'
      ? `- ${h.date.slice(0, 10)} ⚠ ${h.external_id} ${h.title} (${h.status}, ${h.severity}) [${h.id}]`
      : `- ${h.date.slice(0, 10)} ${h.title} (\`${h.commit}\`, ${h.category}/${h.risk}) [${h.id}]`,
  );
  return lines.join('\n') || '_No records touch this module yet._';
}

const FILES_PER_CALL = 4;

/** One call per batch (module sections, then files 4 at a time) keeps each JSON answer inside the model's output limit. */
async function generateBlocks(
  root: string, cfg: Config, mod: Module, files: string[], anchors: Map<string, Anchor[]>, records: Rec[], keys: string[], provider?: Provider,
): Promise<Record<string, string>> {
  const fileKeys = keys.filter((k) => k.startsWith('file:'));
  const batches = [keys.filter((k) => !k.startsWith('file:')), ...Array.from({ length: Math.ceil(fileKeys.length / FILES_PER_CALL) }, (_, i) => fileKeys.slice(i * FILES_PER_CALL, (i + 1) * FILES_PER_CALL))];
  const out: Record<string, string> = {};
  for (const batch of batches.filter((b) => b.length)) Object.assign(out, await generateBatch(root, cfg, mod, files, anchors, records, batch, provider));
  return out;
}

async function generateBatch(
  root: string, cfg: Config, mod: Module, files: string[], anchors: Map<string, Anchor[]>, records: Rec[], keys: string[], provider?: Provider,
): Promise<Record<string, string>> {
  const r = (s: string): string => redact(s, cfg.redaction.patterns);
  let budget = cfg.max_diff_chars;
  const sources = keys.filter((k) => k.startsWith('file:')).map((k) => {
    const f = k.slice(5);
    // ponytail: first-fit source budget; summarize per file first if modules outgrow max_diff_chars.
    const src = r(readWorking(root, f) ?? '');
    const text = src.length <= budget ? src : `${src.slice(0, Math.max(0, budget))}\n… (truncated)`;
    budget -= text.length;
    return `### ${f}\n\`\`\`\n${text}\n\`\`\``;
  });
  const recs = records.slice(0, 30).map((h) => {
    const body = h.body.slice(0, 1500);
    const tag = h.type === 'issue' ? `issue ${h.external_id} (${h.status}, ${h.severity})` : `change ${h.commit} (${h.category}, risk ${h.risk})`;
    return `### [${h.id}] ${tag} ${h.date.slice(0, 10)} — ${r(h.title)}\n${r(body)}`;
  });
  const known = new Set(records.slice(0, 30).map((h) => h.id));
  const schema = z.object(Object.fromEntries(keys.map((k) => [k, z.string().min(1)
    .refine((v) => CITED.test(v), 'must cite a record id like [chg_…] or a file path in backticks')])));
  const prompt = {
    system: `You are ${PRODUCT_NAME}, writing living documentation for one code module, for engineers about to change it.
Respond with ONLY a JSON object whose keys are exactly the requested keys; each value is markdown (no headings),
written as short bullet points, one claim per bullet, each ending with its citation.
- "overview": what the module does and how its parts fit together
- "decisions": key design decisions and why, from the records
- "pitfalls": known bugs, incidents and traps; name the symbols involved
- "file:<path>": what that file's main symbols do and how they are used
Cite EVERY claim: record ids in square brackets like [chg_…] / [iss_…], or file paths/symbols in backticks like \`src/auth.ts\`.
Use only the code and records given. If they don't explain something, say so rather than guessing.
Secrets were replaced with [REDACTED:<type>]; never guess them.`,
    user: [
      `Module: ${mod.name} (${mod.paths.join(', ')})`,
      '', '## Files and symbols',
      ...files.map((f) => `- ${f}${anchors.get(f) ? `: ${anchors.get(f)?.map((a) => a.symbol).join(', ')}` : ''}`),
      ...(sources.length ? ['', '## Source', ...sources] : []),
      '', '## Records touching this module (newest first)',
      ...(recs.length ? recs : ['none']),
      '', '## Requested keys', JSON.stringify(keys),
    ].join('\n'),
  };
  const ask = async (extra = '') =>
    (await generate(provider ?? getProvider(cfg), { ...prompt, user: prompt.user + extra }, schema)) as Record<string, string>;
  const badIn = (o: Record<string, string>): string[] => [...new Set(Object.values(o).flatMap((v) => unknownCitations(v, known)))];
  // Same policy as `why`: one retry naming the hallucinated ids, then strip any that remain.
  let out = await ask();
  if (badIn(out).length) out = await ask(`\n\n## Your previous answer cited ids that are not in the records: ${badIn(out).join(', ')}\nCite only ids shown above.`);
  const bad = badIn(out);
  return bad.length ? Object.fromEntries(Object.entries(out).map(([k, v]) => [k, stripCitations(v, bad)])) : out;
}

type Rec = Hit & { body: string };

function moduleRecords(root: string, files: string[]): Rec[] {
  const ix = openIndex(root);
  try {
    const r = related(ix, files);
    return [...r.issues, ...r.changes]
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
      .map((h) => ({ ...h, body: getRecord(ix, h.id)?.body ?? '' }));
  } finally {
    ix.db.close();
  }
}

export interface DocResult {
  module: string;
  path: string; // repo-relative
  regenerated: string[]; // block keys
}

/** Full (re)generation of a module doc. Human text outside generated blocks is kept. */
export async function buildDoc(root: string, arg: string, o: { provider?: Provider } = {}): Promise<DocResult> {
  const cfg = loadConfig(root);
  const mod = resolveModule(root, cfg, arg);
  const files = moduleFiles(root, mod.paths);
  if (!files.length) throw new Error(`no tracked files under ${mod.paths.join(', ')}`);
  const anchors = await anchorsFor(root, files);
  const records = moduleRecords(root, files);
  const keys = ['overview', 'decisions', 'pitfalls', ...[...anchors.keys()].map((f) => `file:${f}`)];
  const blocks = await generateBlocks(root, cfg, mod, files, anchors, records, keys, o.provider);

  const path = docPath(root, mod.name);
  let body = existsSync(path)
    ? parseDoc(readFileSync(path, 'utf8')).body
    : `# Module \`${mod.name}\`\n\n> Generated by ${PRODUCT_NAME} from \`${mod.paths.join('`, `')}\` and its records. Text inside \`ledger:begin/end\` blocks is regenerated by \`${BIN_NAME} docs update\`; anything outside them is yours and is kept.\n\n<!-- ledger:begin overview -->\n<!-- ledger:end overview -->\n<!-- ledger:begin decisions -->\n<!-- ledger:end decisions -->\n<!-- ledger:begin pitfalls -->\n<!-- ledger:end pitfalls -->\n\n## Files\n\n<!-- ledger:begin recent -->\n<!-- ledger:end recent -->\n`;
  for (const [k, v] of Object.entries(blocks)) body = putBlock(body, k, v);
  body = putBlock(body, 'recent', recentBlock(records));
  for (const m of body.matchAll(/<!-- ledger:begin (file:[^ ]+) -->/g)) if (!anchors.has(m[1]?.slice(5) ?? '')) body = dropBlock(body, m[1] ?? '');
  write(path, mod, [...anchors.values()].flat(), cfg, body);
  return { module: mod.name, path: `${DOCS_DIR}/${mod.name}.md`, regenerated: [...keys, 'recent'] };
}

function write(path: string, mod: Module, anchors: Anchor[], cfg: Config, body: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  const front: DocFront = { type: 'doc', module: mod.name, paths: mod.paths, generated_at: nowIso(), generated_by: { provider: cfg.provider, model: cfg.model }, anchors };
  writeFileSync(path, serializeDoc(front, body));
}

export interface DocStatus {
  module: string;
  path: string;
  stale: boolean;
  changes: { file: string; symbol: string; change: 'changed' | 'removed' }[];
}

/** Docs whose anchored symbols changed (content hash) or disappeared since the doc was written. */
export async function docsStatus(root: string): Promise<DocStatus[]> {
  const dir = join(root, DOCS_DIR);
  if (!existsSync(dir)) return [];
  const out: DocStatus[] = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
    const { front } = parseDoc(readFileSync(join(dir, f), 'utf8'));
    const current = await anchorsFor(root, [...new Set(front.anchors.map((a) => a.file))]);
    const changes = front.anchors.flatMap((a): DocStatus['changes'] => {
      const now = current.get(a.file)?.find((c) => c.symbol === a.symbol);
      return !now ? [{ file: a.file, symbol: a.symbol, change: 'removed' as const }] : now.hash !== a.hash ? [{ file: a.file, symbol: a.symbol, change: 'changed' as const }] : [];
    });
    out.push({ module: front.module, path: `${DOCS_DIR}/${f}`, stale: changes.length > 0, changes });
  }
  return out;
}

/** Regenerates only the blocks of files whose anchors changed (plus the record list). */
export async function updateDoc(root: string, name: string, o: { provider?: Provider } = {}): Promise<DocResult> {
  const cfg = loadConfig(root);
  const path = docPath(root, name);
  if (!existsSync(path)) throw new Error(`no doc for module "${name}"; run \`${BIN_NAME} docs build ${name}\``);
  const { front, body: oldBody } = parseDoc(readFileSync(path, 'utf8'));
  const status = (await docsStatus(root)).find((d) => d.module === name);
  const affected = [...new Set(status?.changes.map((c) => c.file) ?? [])];
  if (!affected.length) return { module: name, path: `${DOCS_DIR}/${name}.md`, regenerated: [] };

  const mod = { name, paths: front.paths };
  const files = moduleFiles(root, mod.paths);
  const fresh = await anchorsFor(root, affected);
  const keep = front.anchors.filter((a) => !affected.includes(a.file));
  const anchors = await anchorsFor(root, files); // context for the prompt
  const records = moduleRecords(root, files);
  const keys = [...fresh.keys()].map((f) => `file:${f}`);
  const blocks = keys.length ? await generateBlocks(root, cfg, mod, files, anchors, records, keys, o.provider) : {};

  let body = oldBody;
  for (const [k, v] of Object.entries(blocks)) body = putBlock(body, k, v);
  for (const f of affected) if (!fresh.has(f)) body = dropBlock(body, `file:${f}`);
  body = putBlock(body, 'recent', recentBlock(records));
  write(path, mod, [...keep, ...[...fresh.values()].flat()], cfg, body);
  return { module: name, path: `${DOCS_DIR}/${name}.md`, regenerated: [...keys, 'recent'] };
}
