import { git } from './git.js';
import { LEDGER_DIR } from './product.js';
import { isEnvFile, redact, type CustomPattern } from './redact.js';

export interface FileStat {
  path: string;
  added: number | null; // null = binary
  deleted: number | null;
}

export interface Collected {
  sha: string;
  short: string;
  author: string;
  date: string;
  parents: string[];
  message: string; // redacted
  issues: string[];
  files: FileStat[];
  diff: string; // redacted + truncated: what the provider sees
  fullDiff: string; // redacted, untruncated: used to verify symbols
  notes: string[]; // what was truncated
}

const NOT_ISSUE = new Set(['UTF', 'SHA', 'ISO', 'RFC', 'TLS', 'HTTP', 'X']);

export function issueRefs(text: string): string[] {
  const refs = new Set<string>();
  for (const m of text.matchAll(/(?<![\w&/])#(\d+)\b/g)) refs.add(`#${m[1]}`);
  for (const m of text.matchAll(/\b([A-Z][A-Z0-9]+)-(\d+)\b/g)) if (!NOT_ISSUE.has(m[1] ?? '')) refs.add(m[0]);
  return [...refs];
}

// Lockfiles and build output carry no "why"; the per-file summary is enough.
const NOISE = /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?|Cargo\.lock|go\.sum|poetry\.lock|composer\.lock)$|\.min\.(js|css)$|(^|\/)(dist|build|vendor|node_modules)\//;

/**
 * Fits per-file diffs into `max` chars, in path order: whole files first, else as many
 * hunks as fit. ponytail: first-fit, not relevance-ranked; rank by symbols/issue refs when M2 has a parser.
 */
export function truncate(chunks: { path: string; text: string }[], max: number): { diff: string; notes: string[] } {
  let left = max;
  const out: string[] = [];
  const notes: string[] = [];
  for (const { path, text } of chunks) {
    if (NOISE.test(path)) {
      notes.push(`${path}: generated/lock file, summary only`);
      continue;
    }
    if (text.length <= left) {
      out.push(text);
      left -= text.length;
      continue;
    }
    const [head = '', ...hunks] = text.split(/^(?=@@ )/m);
    if (head.length > left) {
      notes.push(`${path}: diff omitted (${text.length} chars)`);
      continue;
    }
    let kept = head;
    left -= head.length;
    for (const h of hunks) {
      if (h.length > left) continue;
      kept += h;
      left -= h.length;
    }
    const dropped = hunks.length - (kept.split(/^@@ /m).length - 1);
    notes.push(`${path}: ${dropped} of ${hunks.length} hunks omitted`);
    out.push(kept);
  }
  return { diff: out.join(''), notes };
}

export function collect(root: string, sha: string, opts: { maxChars: number; patterns: CustomPattern[] }): Collected {
  const [full = sha, short = '', author = '', date = '', parentList = '', message = ''] = git(root, [
    'show', '-s', '--format=%H%x00%h%x00%ae%x00%aI%x00%P%x00%B', sha,
  ]).split('\0');
  const parents = parentList.split(' ').filter(Boolean);
  // Merge commits: diff against the first parent, i.e. what the merge brought in.
  const base = parents[0] ?? git(root, ['hash-object', '-t', 'tree', '--stdin']).trim();
  const range = ['--no-renames', base, full];

  const files: FileStat[] = git(root, ['diff', '--numstat', ...range])
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [a = '-', d = '-', ...p] = line.split('\t');
      return { path: p.join('\t'), added: a === '-' ? null : Number(a), deleted: d === '-' ? null : Number(d) };
    });
  // Records are the output, not the input: keep .ledger/ out of payloads and records.
  const isOurs = (p: string): boolean => p.startsWith(`${LEDGER_DIR}/`);

  // git emits numstat and patch entries in the same path order.
  const raw = git(root, ['diff', '--no-color', '--no-ext-diff', '--no-textconv', ...range]);
  const chunks = raw
    .split(/^(?=diff --git )/m)
    .filter(Boolean)
    .map((text, i) => ({ path: files[i]?.path ?? '', text }))
    .filter((c) => !isOurs(c.path))
    .map(({ path, text }) => {
      if (isEnvFile(path)) text = `${text.split(/^(?=@@ )/m)[0] ?? ''}[REDACTED:env_file]\n`;
      return { path, text: redact(text, opts.patterns) };
    });
  const { diff, notes } = truncate(chunks, opts.maxChars);

  return {
    sha: full, short, author, date, parents,
    message: redact(message, opts.patterns),
    issues: issueRefs(message),
    files: files.filter((f) => !isOurs(f.path)),
    diff,
    fullDiff: chunks.map((c) => c.text).join(''),
    notes,
  };
}
