import { existsSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { z } from 'zod';
import { collect, type Collected } from './collect.js';
import { git } from './git.js';
import { LEDGER_DIR, PRODUCT_NAME } from './product.js';
import { getProvider, type Prompt, type Provider } from './providers.js';
import { ChangeRecordSchema, loadConfig, readRecords, RISKS, serializeRecord, ulid } from './store.js';

const writerSchema = (categories: string[]) =>
  z.object({
    title: z.string().min(1).max(120),
    category: z.enum(categories as [string, ...string[]]),
    risk: z.enum(RISKS),
    symbols: z.array(z.string()).default([]),
    what_changed: z.string().min(1),
    why: z.string().min(1),
    impact: z.string().min(1),
    testing: z.string().min(1),
  });

export function buildPrompt(c: Collected, categories: string[]): Prompt {
  const system = `You are ${PRODUCT_NAME}, writing an audit-ready engineering record of ONE code change.
Respond with ONLY a JSON object, no prose or code fences, with exactly these keys:
- "title": imperative summary, max 100 chars
- "category": one of ${JSON.stringify(categories)}
- "risk": "low" | "medium" | "high" (consider security, data, money movement, auth, blast radius)
- "symbols": functions/classes/methods touched, exactly as named in the diff (e.g. "AuthClient.request")
- "what_changed": markdown
- "why": markdown, grounded in the commit message and code; write "Not stated." rather than inventing intent
- "impact": markdown blast radius: callers, data, security and compliance-relevant effects
- "testing": markdown: tests added/changed, or what should be tested
Secrets were replaced with [REDACTED:<type>] before you saw this; never guess them.`;
  const files = c.files.map((f) => `${f.path} (${f.added === null ? 'binary' : `+${f.added} -${f.deleted}`})`);
  const user = [
    `Commit: ${c.sha}${c.parents.length > 1 ? ` (merge; diff is against first parent ${c.parents[0]})` : ''}`,
    `Issue refs: ${c.issues.join(', ') || 'none'}`,
    '',
    '## Commit message',
    c.message.trim(),
    '',
    '## Files changed',
    ...files,
    '',
    '## Diff',
    c.diff.trimEnd(),
    ...(c.notes.length ? ['', '## Truncated', ...c.notes] : []),
  ].join('\n');
  return { system, user };
}

function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('no JSON object in response');
  return JSON.parse(text.slice(start, end + 1));
}

/** Writer: asks for structured JSON, validates, retries once with the validation error. */
async function generate<S extends z.ZodType>(provider: Provider, prompt: Prompt, schema: S): Promise<z.infer<S>> {
  let user = prompt.user;
  let error = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await provider({ system: prompt.system, user });
    try {
      return schema.parse(extractJson(raw));
    } catch (e) {
      error = e instanceof z.ZodError ? z.prettifyError(e) : (e as Error).message;
      user = `${prompt.user}\n\n## Your previous response was invalid\n${error}\nReturn ONLY the corrected JSON object.`;
    }
  }
  throw new Error(`provider returned invalid output twice:\n${error}`);
}

const slugify = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'change';

export interface RecordOptions {
  rev?: string;
  dryRun?: boolean;
  force?: boolean;
  provider?: Provider; // override (tests)
}

export type RecordResult =
  | { status: 'written'; path: string }
  | { status: 'skipped'; reason: string }
  | { status: 'dry-run'; provider: string; model: string; prompt: Prompt };

export async function recordCommit(root: string, opts: RecordOptions = {}): Promise<RecordResult> {
  const cfg = loadConfig(root);
  const sha = git(root, ['rev-parse', '--verify', `${opts.rev ?? 'HEAD'}^{commit}`]).trim();
  // ponytail: scans every record per run; use the M2 index once records number in the thousands.
  const existing = readRecords(root).records.find((r) => r.front.type === 'change' && sha.startsWith(r.front.commit));
  if (existing && !opts.force && !opts.dryRun) {
    return { status: 'skipped', reason: `already recorded in ${relative(root, existing.path)} (--force to regenerate)` };
  }

  const c = collect(root, sha, { maxChars: cfg.max_diff_chars, patterns: cfg.redaction.patterns });
  // Also stops hook feedback loops: a commit of only records has no files outside .ledger/.
  if (c.files.length === 0) return { status: 'skipped', reason: `no file changes outside ${LEDGER_DIR}/` };

  const prompt = buildPrompt(c, cfg.categories);
  if (opts.dryRun) return { status: 'dry-run', provider: cfg.provider, model: cfg.model, prompt };

  const out = await generate(opts.provider ?? getProvider(cfg), prompt, writerSchema(cfg.categories));

  const front = ChangeRecordSchema.parse({
    id: existing?.front.id ?? `chg_${ulid()}`,
    type: 'change',
    title: out.title,
    commit: c.short,
    author: c.author,
    date: c.date,
    category: out.category,
    risk: out.risk,
    issues: c.issues,
    files: c.files.map((f) => f.path),
    // Verifier: keep only symbols that actually appear in the diff.
    symbols: [...new Set(out.symbols)].filter((s) => c.fullDiff.includes(s.split('.').pop() ?? s)),
    generated_by: { provider: cfg.provider, model: cfg.model },
    reviewed: false,
  });
  const body = [
    '## What changed', out.what_changed.trim(), '',
    '## Why', out.why.trim(), '',
    '## Impact / blast radius', out.impact.trim(), '',
    '## Testing notes', out.testing.trim(),
  ].join('\n');

  let path = existing?.path;
  if (!path) {
    const name = `${c.date.slice(0, 10)}-${slugify(out.title)}`;
    path = join(root, LEDGER_DIR, 'changes', `${name}.md`);
    if (existsSync(path)) path = join(root, LEDGER_DIR, 'changes', `${name}-${c.short}.md`);
  }
  writeFileSync(path, serializeRecord(front, body));
  return { status: 'written', path };
}
