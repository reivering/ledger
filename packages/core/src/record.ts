import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { z } from 'zod';
import { collect, type Collected } from './collect.js';
import { git } from './git.js';
import { linkIssue } from './issues.js';
import { LEDGER_DIR, PRODUCT_NAME } from './product.js';
import { generate, getProvider, type Prompt, type Provider } from './providers.js';
import { redact } from './redact.js';
import { anchorSymbols } from './symbols.js';
import { syncIndex } from './db.js';
import { type ChangeRecord, findRecord, stripHeading, loadConfig, readRecords, RISKS, slugify, ulid, writeRecord } from './store.js';

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

export function buildPrompt(c: Collected, categories: string[], issueTitles: Map<string, string> = new Map()): Prompt {
  const system = `You are ${PRODUCT_NAME}, writing an audit-ready engineering record of ONE code change.
Respond with ONLY a JSON object, no prose or code fences, with exactly these keys:
- "title": imperative summary, max 100 chars
- "category": one of ${JSON.stringify(categories)}
- "risk": "low" | "medium" | "high" (consider security, data, money movement, auth, blast radius)
- "symbols": functions/classes/methods touched, exactly as named in the diff (e.g. "AuthClient.request")
- "what_changed": markdown
- "why": markdown, grounded in the commit message, linked issues and code; write "Not stated." rather than inventing intent
- "impact": markdown blast radius: callers, data, security and compliance-relevant effects
- "testing": markdown: tests added/changed, or what should be tested
Secrets were replaced with [REDACTED:<type>] before you saw this; never guess them.`;
  const files = c.files.map((f) => `${f.path} (${f.added === null ? 'binary' : `+${f.added} -${f.deleted}`})`);
  const refs = c.issues.map((r) => (issueTitles.has(r) ? `${r} (${issueTitles.get(r)})` : r));
  const user = [
    `Commit: ${c.sha}${c.parents.length > 1 ? ` (merge; diff is against first parent ${c.parents[0]})` : ''}`,
    `Issue refs: ${refs.join(', ') || 'none'}`,
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
  return { system, user, json: true };
}

export interface RecordOptions {
  rev?: string;
  dryRun?: boolean;
  force?: boolean;
  provider?: Provider; // override (tests)
}

export type RecordResult =
  | { status: 'written'; path: string; linked: string[] }
  | { status: 'skipped'; reason: string }
  | { status: 'dry-run'; provider: string; model: string; prompt: Prompt };

export async function recordCommit(root: string, opts: RecordOptions = {}): Promise<RecordResult> {
  const cfg = loadConfig(root);
  const sha = git(root, ['rev-parse', '--verify', `${opts.rev ?? 'HEAD'}^{commit}`]).trim();
  // ponytail: scans every record per run; fine to thousands, use the index past that.
  const { records } = readRecords(root);
  const existing = records.find((r) => r.front.type === 'change' && sha.startsWith(r.front.commit));
  if (existing && !opts.force && !opts.dryRun) {
    return { status: 'skipped', reason: `already recorded in ${relative(root, existing.path)} (--force to regenerate)` };
  }

  const c = collect(root, sha, { maxChars: cfg.max_diff_chars, patterns: cfg.redaction.patterns });
  // Also stops hook feedback loops: a commit of only records has no files outside .ledger/.
  if (c.files.length === 0) return { status: 'skipped', reason: `no file changes outside ${LEDGER_DIR}/` };

  const issues = new Map(c.issues.map((ref) => [ref, findRecord(records, ref)] as const));
  const titles = new Map([...issues].flatMap(([ref, r]) => (r ? [[ref, redact(r.front.title, cfg.redaction.patterns)]] : [])));
  const prompt = buildPrompt(c, cfg.categories, titles);
  if (opts.dryRun) return { status: 'dry-run', provider: cfg.provider, model: cfg.model, prompt };

  const out = await generate(opts.provider ?? getProvider(cfg), prompt, writerSchema(cfg.categories));
  // Verifier: parsed symbols win; for unsupported languages keep AI symbols that appear in the diff.
  const parsed = await anchorSymbols(root, c);
  const symbols = parsed.length
    ? parsed
    : [...new Set(out.symbols)].filter((s) => c.fullDiff.includes(s.split('.').pop() ?? s));

  const front: ChangeRecord = {
    id: existing?.front.id ?? `chg_${ulid()}`,
    type: 'change',
    title: out.title,
    commit: c.short,
    author: c.author,
    date: c.date,
    category: out.category,
    risk: out.risk,
    issues: [...issues].map(([ref, r]) => r?.front.id ?? ref),
    files: c.files.map((f) => f.path),
    symbols,
    generated_by: { provider: cfg.provider, model: cfg.model },
    reviewed: false,
  };
  const body = [
    '## What changed', stripHeading('What changed', out.what_changed), '',
    '## Why', stripHeading('Why', out.why), '',
    '## Impact / blast radius', stripHeading('Impact / blast radius', out.impact), '',
    '## Testing notes', stripHeading('Testing notes', out.testing),
  ].join('\n');

  let path = existing?.path;
  if (!path) {
    const name = `${c.date.slice(0, 10)}-${slugify(out.title)}`;
    path = join(root, LEDGER_DIR, 'changes', `${name}.md`);
    if (existsSync(path)) path = join(root, LEDGER_DIR, 'changes', `${name}-${c.short}.md`);
  }
  writeRecord(path, front, body);

  const linked: string[] = [];
  for (const issue of issues.values()) {
    if (!issue || issue.front.type !== 'issue') continue;
    linkIssue(issue.path, { commit: c.short, changeId: front.id, files: front.files, symbols });
    linked.push(issue.front.external_id);
  }
  syncIndex(root);
  return { status: 'written', path, linked };
}
