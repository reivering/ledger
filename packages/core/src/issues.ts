import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { collect } from './collect.js';
import { syncIndex } from './db.js';
import { git } from './git.js';
import { BIN_NAME, ENV_PREFIX, LEDGER_DIR, PRODUCT_NAME } from './product.js';
import { generate, getProvider, type Provider } from './providers.js';
import { redact } from './redact.js';
import {
  findRecord, type IssueRecord, ISSUE_STATUS, loadConfig, nowIso, readRecord, readRecords, SEVERITY,
  slugify, type StoredRecord, stripHeading, ulid, writeRecord,
} from './store.js';
import { anchorSymbols } from './symbols.js';

type Severity = (typeof SEVERITY)[number];
type Status = (typeof ISSUE_STATUS)[number];

const union = (a: string[], b: string[] = []): string[] => [...new Set([...a, ...b])];
/** Short and full SHAs of the same commit count once. */
const addSha = (list: string[], sha?: string): string[] =>
  !sha || list.some((s) => s.startsWith(sha) || sha.startsWith(s)) ? list : [...list, sha];

export function setSection(body: string, heading: string, text: string): string {
  const re = new RegExp(`(^## ${heading}\\n)[\\s\\S]*?(?=^## |(?![\\s\\S]))`, 'm');
  text = stripHeading(heading, text);
  return re.test(body) ? body.replace(re, (_, h: string) => `${h}${text.trim()}\n\n`) : `${body.trimEnd()}\n\n## ${heading}\n${text.trim()}\n`;
}

export const getSection = (body: string, heading: string): string =>
  new RegExp(`^## ${heading}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(body)?.[1]?.trim() ?? '';

const issueBody = (symptom: string): string =>
  `## Symptom\n${symptom.trim() || '_Not described._'}\n\n## Root cause\n_Unknown — filled in by \`${BIN_NAME} issue close\`._\n\n## Fix\n_Pending._\n`;

/** Adds a fix commit / change / anchors to an issue file. Idempotent. */
export function linkIssue(path: string, l: { commit?: string; changeId?: string; files?: string[]; symbols?: string[] }): void {
  const { front, body } = readRecord(path);
  if (front.type !== 'issue') throw new Error(`${path} is not an issue record`);
  writeRecord(path, {
    ...front,
    fix_commits: addSha(front.fix_commits, l.commit),
    related_changes: union(front.related_changes, l.changeId ? [l.changeId] : []),
    files: union(front.files, l.files),
    symbols: union(front.symbols, l.symbols),
  }, body);
}

/** Points a change record at an issue id, replacing the raw ref ("#142") it was recorded with. */
function linkChange(change: StoredRecord, issue: IssueRecord): void {
  const { front, body } = readRecord(change.path);
  if (front.type !== 'change') return;
  const issues = union(front.issues.map((r) => (r === issue.external_id ? issue.id : r)), [issue.id]);
  if (issues.join() !== front.issues.join()) writeRecord(change.path, { ...front, issues }, body);
}

/**
 * Next local issue ref. `#N` collides with tracker numbers, so repos with a GitHub remote or imported
 * issues get `LOCAL-N` (still matched by commit refs like "fix LOCAL-3"). Plain repos keep `#N`.
 */
function nextLocalRef(root: string, records: StoredRecord[], forceTracked = false): string {
  // ponytail: numbers are unique per checkout; two branches can both mint the same ref. Rename on merge if it happens.
  const local = records.filter((r) => r.front.type === 'issue' && r.front.source === 'local');
  const n = Math.max(0, ...local.map((r) => Number(/^(?:#|LOCAL-)(\d+)$/.exec(r.front.type === 'issue' ? r.front.external_id : '')?.[1] ?? 0))) + 1;
  let tracked = forceTracked || records.some((r) => r.front.type === 'issue' && r.front.source !== 'local');
  try {
    tracked ||= Boolean(githubRepoFromRemote(root));
  } catch {
    // no GitHub origin
  }
  return tracked ? `LOCAL-${n}` : `#${n}`;
}

export function newIssue(root: string, o: { title: string; symptom?: string; severity?: Severity }): StoredRecord {
  loadConfig(root); // fails early if not initialized
  const { records } = readRecords(root);
  const front: IssueRecord = {
    id: `iss_${ulid()}`,
    type: 'issue',
    title: o.title,
    date: nowIso(),
    status: 'open',
    severity: o.severity ?? 'medium',
    source: 'local',
    external_id: nextLocalRef(root, records),
    labels: [],
    fix_commits: [],
    files: [],
    symbols: [],
    related_changes: [],
  };
  const path = join(root, LEDGER_DIR, 'issues', `${front.id}-${slugify(o.title)}.md`);
  writeRecord(path, front, issueBody(o.symptom ?? ''));
  syncIndex(root);
  return { path, front };
}

const closeSchema = z.object({ root_cause: z.string().min(1), fix: z.string().min(1) });

export async function closeIssue(root: string, ref: string, rev: string, o: { provider?: Provider } = {}): Promise<StoredRecord> {
  const cfg = loadConfig(root);
  const { records } = readRecords(root);
  const issue = findRecord(records, ref);
  if (issue?.front.type !== 'issue') throw new Error(`no issue "${ref}"`);
  const sha = git(root, ['rev-parse', '--verify', `${rev}^{commit}`]).trim();
  const c = collect(root, sha, { maxChars: cfg.max_diff_chars, patterns: cfg.redaction.patterns });
  const { body } = readRecord(issue.path);
  const r = (s: string): string => redact(s, cfg.redaction.patterns);

  const out = await generate(o.provider ?? getProvider(cfg), {
    system: `You are ${PRODUCT_NAME}, documenting how a software issue was fixed, for an audit-ready engineering log.
Respond with ONLY a JSON object with keys:
- "root_cause": markdown, the underlying cause as evidenced by the fix diff; write "Not determinable from the diff." if unclear
- "fix": markdown, what the fix changed and why it resolves the symptom
Secrets were replaced with [REDACTED:<type>]; never guess them.`,
    user: [
      `Issue ${issue.front.external_id}: ${r(issue.front.title)}`,
      '', '## Symptom', r(getSection(body, 'Symptom')),
      '', `## Fix commit ${c.sha}`, c.message.trim(),
      '', '## Diff', c.diff.trimEnd(),
      ...(c.notes.length ? ['', '## Truncated', ...c.notes] : []),
    ].join('\n'),
  }, closeSchema);

  const symbols = await anchorSymbols(root, c);
  const change = records.find((x) => x.front.type === 'change' && sha.startsWith(x.front.commit));
  const front: IssueRecord = { ...issue.front, status: 'resolved', resolved_at: nowIso() };
  writeRecord(issue.path, front, setSection(setSection(body, 'Root cause', out.root_cause), 'Fix', `${out.fix.trim()}\n\nFix commit: ${c.short}`));
  linkIssue(issue.path, { commit: c.short, changeId: change?.front.id, files: c.files.map((f) => f.path), symbols });
  if (change) linkChange(change, front);
  syncIndex(root);
  return { path: issue.path, front: readRecord(issue.path).front };
}

// ---- import -------------------------------------------------------------------------------

export interface ImportedIssue {
  external_id: string; // the ref commits use, e.g. "#142" or "PROJ-142"
  title: string;
  body: string;
  labels: string[];
  status: Status;
  created_at: string;
  closed_at?: string;
  updated_at: string;
  fix_commits: string[];
}

/** One per tracker (GitHub now; GitLab, Jira later). Yields issues updated at/after `since`. */
export interface IssueSource {
  name: string; // lowercase; becomes the record's `source` and the state file name
  pull(since?: string): AsyncIterable<ImportedIssue>;
}

function severityFromLabels(labels: string[]): Severity {
  const l = labels.join(' ').toLowerCase();
  if (/critical|\bp0\b|sev[-: ]?1\b|blocker/.test(l)) return 'critical';
  if (/\bhigh\b|\bp1\b|sev[-: ]?2\b/.test(l)) return 'high';
  if (/\blow\b|\bp3\b|sev[-: ]?4\b|minor/.test(l)) return 'low';
  return 'medium';
}

/** Incremental and additive: updates tracker-owned fields, never deletes records or local edits to the body. */
export async function importIssues(root: string, source: IssueSource): Promise<{ created: number; updated: number; renamed: string[] }> {
  const cfg = loadConfig(root);
  const statePath = join(root, LEDGER_DIR, 'state', `${source.name}.json`);
  const state = existsSync(statePath) ? (JSON.parse(readFileSync(statePath, 'utf8')) as { last_sync?: string }) : {};
  const { records } = readRecords(root);
  let created = 0;
  let updated = 0;
  const renamed: string[] = [];
  let lastSync = state.last_sync;

  for await (const i of source.pull(state.last_sync)) {
    const existing = records.find((r) => r.front.type === 'issue' && r.front.source === source.name && r.front.external_id === i.external_id);
    const tracker = {
      title: i.title,
      status: i.status,
      labels: i.labels,
      resolved_at: i.status === 'open' ? undefined : i.closed_at,
    };
    let rec: StoredRecord;
    if (existing && existing.front.type === 'issue') {
      const { front, body } = readRecord(existing.path);
      if (front.type !== 'issue') continue;
      const next: IssueRecord = { ...front, ...tracker, fix_commits: i.fix_commits.reduce(addSha, front.fix_commits) };
      if (JSON.stringify(next) !== JSON.stringify(front)) {
        writeRecord(existing.path, next, body);
        updated++;
      }
      rec = { path: existing.path, front: next };
    } else {
      // A local issue already uses this ref (created before the repo was tracked): move it to LOCAL-N.
      const clash = records.find((r) => r.front.type === 'issue' && r.front.source === 'local' && r.front.external_id === i.external_id);
      if (clash) {
        const { front, body } = readRecord(clash.path);
        const ref = nextLocalRef(root, records, true);
        if (front.type === 'issue') writeRecord(clash.path, { ...front, external_id: ref }, body);
        clash.front = { ...clash.front, external_id: ref } as IssueRecord;
        renamed.push(`${i.external_id} → ${ref}`);
      }
      const front: IssueRecord = {
        id: `iss_${ulid()}`,
        type: 'issue',
        date: i.created_at,
        severity: severityFromLabels(i.labels),
        source: source.name,
        external_id: i.external_id,
        ...tracker,
        fix_commits: i.fix_commits.reduce(addSha, [] as string[]),
        files: [],
        symbols: [],
        related_changes: [],
      };
      rec = { path: join(root, LEDGER_DIR, 'issues', `${front.id}-${slugify(i.title)}.md`), front };
      writeRecord(rec.path, front, issueBody(redact(i.body, cfg.redaction.patterns)));
      records.push(rec);
      created++;
    }
    // Link changes recorded before this issue was imported.
    for (const ch of records) {
      if (ch.front.type !== 'change' || rec.front.type !== 'issue') continue;
      if (!ch.front.issues.includes(rec.front.external_id) && !ch.front.issues.includes(rec.front.id)) continue;
      linkIssue(rec.path, { commit: ch.front.commit, changeId: ch.front.id, files: ch.front.files, symbols: ch.front.symbols });
      linkChange(ch, rec.front);
    }
    if (!lastSync || i.updated_at > lastSync) lastSync = i.updated_at;
  }
  if (lastSync) writeFileSync(statePath, `${JSON.stringify({ last_sync: lastSync }, null, 2)}\n`);
  syncIndex(root);
  return { created, updated, renamed };
}

interface GhIssue {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  state_reason?: string | null;
  labels: ({ name: string } | string)[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  pull_request?: unknown;
}

export function githubRepoFromRemote(root: string): string {
  const url = git(root, ['remote', 'get-url', 'origin']).trim();
  const m = /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/.exec(url);
  if (!m?.[1]) throw new Error(`origin (${url}) is not a GitHub repo; pass --repo owner/name`);
  return m[1];
}

export function githubSource(repo: string, token = process.env[`${ENV_PREFIX}GITHUB_TOKEN`], api = 'https://api.github.com'): IssueSource {
  if (!token) throw new Error(`set ${ENV_PREFIX}GITHUB_TOKEN in the environment`);
  const gh = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${api}${path}`, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': BIN_NAME },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`GitHub ${path} responded ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return (await res.json()) as T;
  };
  return {
    name: 'github',
    async *pull(since) {
      for (let page = 1; ; page++) {
        const q = `state=all&sort=updated&direction=asc&per_page=100&page=${page}${since ? `&since=${encodeURIComponent(since)}` : ''}`;
        const items = await gh<GhIssue[]>(`/repos/${repo}/issues?${q}`);
        for (const i of items) {
          if (i.pull_request) continue; // the issues endpoint also returns PRs
          // Closing commits (direct "fixes #n" pushes and merged PRs) appear as `closed` events with a commit_id.
          const events = i.state === 'closed' ? await gh<{ event: string; commit_id: string | null }[]>(`/repos/${repo}/issues/${i.number}/events?per_page=100`) : [];
          yield {
            external_id: `#${i.number}`,
            title: i.title,
            body: i.body ?? '',
            labels: i.labels.map((l) => (typeof l === 'string' ? l : l.name)),
            status: i.state === 'open' ? 'open' : i.state_reason === 'not_planned' ? 'wontfix' : 'resolved',
            created_at: i.created_at,
            closed_at: i.closed_at ?? undefined,
            updated_at: i.updated_at,
            fix_commits: events.flatMap((e) => (e.event === 'closed' && e.commit_id ? [e.commit_id.slice(0, 12)] : [])),
          };
        }
        if (items.length < 100) return;
      }
    },
  };
}
