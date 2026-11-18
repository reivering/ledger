import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import YAML from 'yaml';
import { z } from 'zod';
import { BIN_NAME, INDEX_CACHE, LEDGER_DIR, PRODUCT_NAME } from './product.js';

export const DEFAULT_CATEGORIES = ['feature', 'bugfix', 'refactor', 'security', 'config', 'docs', 'chore'];
export const RISKS = ['low', 'medium', 'high'] as const;

const validRegex = (p: string): boolean => {
  try {
    new RegExp(p);
    return true;
  } catch {
    return false;
  }
};

export const ConfigSchema = z.strictObject({
  provider: z.enum(['anthropic', 'openai', 'ollama', 'fake']),
  model: z.string().min(1),
  base_url: z.url().optional(),
  max_diff_chars: z.number().int().positive().default(60_000),
  categories: z.array(z.string().min(1)).min(1).default(DEFAULT_CATEGORIES),
  redaction: z
    .strictObject({
      patterns: z
        .array(z.strictObject({ name: z.string().regex(/^\w+$/), pattern: z.string().refine(validRegex, 'invalid regex') }))
        .default([]),
    })
    .default({ patterns: [] }),
});
export type Config = z.infer<typeof ConfigSchema>;

const isoDate = z.iso.datetime({ offset: true });
const ULID = '[0-9A-HJKMNP-TV-Z]{26}';

export const ChangeRecordSchema = z.strictObject({
  id: z.string().regex(new RegExp(`^chg_${ULID}$`)),
  type: z.literal('change'),
  title: z.string().min(1),
  commit: z.string().regex(/^[0-9a-f]{7,40}$/),
  author: z.string(),
  date: isoDate,
  category: z.string().min(1),
  risk: z.enum(RISKS),
  issues: z.array(z.string()),
  files: z.array(z.string()),
  symbols: z.array(z.string()),
  generated_by: z.strictObject({ provider: z.string(), model: z.string() }),
  reviewed: z.boolean(),
});
export type ChangeRecord = z.infer<typeof ChangeRecordSchema>;

// Written by humans for now; importer lands with issue import.
export const IssueRecordSchema = z.strictObject({
  id: z.string().regex(new RegExp(`^iss_${ULID}$`)),
  type: z.literal('issue'),
  title: z.string().min(1),
  date: isoDate,
  status: z.enum(['open', 'mitigated', 'resolved']),
  fix_commits: z.array(z.string().regex(/^[0-9a-f]{7,40}$/)),
  files: z.array(z.string()),
  issues: z.array(z.string()).default([]),
});

export const RecordSchema = z.discriminatedUnion('type', [ChangeRecordSchema, IssueRecordSchema]);
export type LedgerRecord = z.infer<typeof RecordSchema>;

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** ULID: 48-bit ms timestamp + 80 random bits, lexicographically sortable. */
export function ulid(now = Date.now()): string {
  let t = '';
  for (let i = 0, n = now; i < 10; i++, n = Math.floor(n / 32)) t = B32[n % 32] + t;
  let r = '';
  for (const b of randomBytes(16)) r += B32[b % 32]; // 256 % 32 === 0, so unbiased
  return t + r;
}

export function serializeRecord(front: LedgerRecord, body: string): string {
  const doc = new YAML.Document(front);
  YAML.visit(doc, {
    Seq: (_, n) => void (n.flow = true),
    Map: (_, n, path) => void (path.length > 1 && (n.flow = true)),
  });
  return `---\n${doc.toString({ lineWidth: 0 })}---\n\n${body.trim()}\n`;
}

export function parseRecord(text: string): { front: LedgerRecord; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) throw new Error('missing YAML front-matter');
  return { front: RecordSchema.parse(YAML.parse(m[1] ?? '')), body: m[2] ?? '' };
}

export interface StoredRecord {
  path: string;
  front: LedgerRecord;
}

/** Reads and strictly validates every record. Invalid files are reported, not skipped silently. */
export function readRecords(root: string): { records: StoredRecord[]; errors: string[] } {
  const records: StoredRecord[] = [];
  const errors: string[] = [];
  for (const sub of ['changes', 'issues']) {
    const dir = join(root, LEDGER_DIR, sub);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
      const path = join(dir, f);
      try {
        records.push({ path, front: parseRecord(readFileSync(path, 'utf8')).front });
      } catch (e) {
        errors.push(`${path}: ${e instanceof z.ZodError ? z.prettifyError(e) : (e as Error).message}`);
      }
    }
  }
  return { records, errors };
}

export function loadConfig(root: string): Config {
  const path = join(root, LEDGER_DIR, 'config.yaml');
  if (!existsSync(path)) throw new Error(`no ${LEDGER_DIR}/config.yaml — run \`${BIN_NAME} init\``);
  const parsed = ConfigSchema.safeParse(YAML.parse(readFileSync(path, 'utf8')) ?? {});
  if (!parsed.success) throw new Error(`invalid ${LEDGER_DIR}/config.yaml:\n${z.prettifyError(parsed.error)}`);
  return parsed.data;
}

const CONFIG_TEMPLATE = `# ${PRODUCT_NAME} configuration. Committed with the repo — never put API keys here.
# Keys come only from the environment: LEDGER_ANTHROPIC_API_KEY, LEDGER_OPENAI_API_KEY.
provider: anthropic          # anthropic | openai | ollama | fake
model: claude-sonnet-4-5     # model id for the provider above
# base_url: https://...      # optional: self-hosted / gateway endpoint for the provider
max_diff_chars: 60000        # larger diffs are truncated; per-file summaries are always kept
categories: [${DEFAULT_CATEGORIES.join(', ')}]
redaction:
  patterns: []               # extra secrets, e.g. [{ name: acme_id, pattern: "ACME-[0-9]{8}" }]
`;

const README_TEMPLATE = `# ${LEDGER_DIR}/ — engineering memory

This folder is written by ${PRODUCT_NAME}. It is the source of truth for *how and why*
this codebase changed, and it lives in the repo so it is versioned, reviewed and
audited with the code. Nothing here is stored anywhere else.

- \`changes/\` — one Markdown record per recorded commit (what changed, why, impact, testing).
- \`issues/\` — incident / bug records: symptom, root cause, fix commits, affected files.
- \`docs/\` — longer-lived notes.
- \`config.yaml\` — AI provider, model, redaction patterns, categories. No secrets.

Records are plain Markdown with YAML front-matter. Edit them freely in a PR; set
\`reviewed: true\` once a human has checked a generated record.
\`${INDEX_CACHE}\` is a local search cache: gitignored and rebuildable.

Secrets are redacted before any text is sent to the configured AI provider.
`;

/** Idempotent: creates only what is missing, never overwrites. Returns created paths. */
export function init(root: string): string[] {
  const created: string[] = [];
  const base = join(root, LEDGER_DIR);
  for (const sub of ['changes', 'issues', 'docs']) {
    const keep = join(base, sub, '.gitkeep');
    if (existsSync(keep)) continue;
    mkdirSync(join(base, sub), { recursive: true });
    writeFileSync(keep, '');
    created.push(join(LEDGER_DIR, sub) + '/');
  }
  for (const [name, text] of [['config.yaml', CONFIG_TEMPLATE], ['README.md', README_TEMPLATE]] as const) {
    if (existsSync(join(base, name))) continue;
    writeFileSync(join(base, name), text);
    created.push(join(LEDGER_DIR, name));
  }
  const gi = join(root, '.gitignore');
  const current = existsSync(gi) ? readFileSync(gi, 'utf8') : '';
  if (!current.split(/\r?\n/).includes(INDEX_CACHE)) {
    writeFileSync(gi, `${current}${current && !current.endsWith('\n') ? '\n' : ''}${INDEX_CACHE}\n`);
    created.push('.gitignore entry');
  }
  return created;
}
