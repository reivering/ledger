import { readFileSync } from 'node:fs';
import { check, type Finding, FINDING_SEVERITY, type FindingSeverity, severityRank } from '@ledger/core';

export const MARKER = '<!-- ledger-check -->';
const ICON: Record<FindingSeverity, string> = { critical: '🛑', high: '⚠️', medium: '🔶', low: '🔹', info: 'ℹ️' };

export function summary(findings: Finding[], range: string): string {
  if (!findings.length) return `${MARKER}\n### Ledger check\n\n✅ No past bugs, high-risk changes or stale docs touch the code changed in \`${range}\`.\n`;
  const rows = findings.map((f) => `| ${ICON[f.severity]} ${f.severity} | ${f.kind} | \`${f.symbol ? `${f.path}#${f.symbol}` : f.path}\` | ${f.message.replace(/\|/g, '\\|').replace(/\n/g, ' ')} | ${f.records.map((r) => `\`${r}\``).join(' ')} |`);
  return [
    MARKER,
    '### Ledger check',
    '',
    `${findings.length} finding${findings.length === 1 ? '' : 's'} for the code changed in \`${range}\` (from \`.ledger/\` records; no AI involved).`,
    '',
    '| Severity | Kind | Where | Finding | Records |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

interface Env {
  [k: string]: string | undefined;
}

/** Runs `ledger check` on a pull request and upserts ONE summary comment. Returns the process exit code. */
export async function run(env: Env = process.env, f: typeof fetch = fetch): Promise<number> {
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH ?? '', 'utf8')) as {
    pull_request?: { number: number; base: { sha: string }; head: { sha: string } };
  };
  const pr = event.pull_request;
  if (!pr) {
    console.log('ledger: not a pull_request event; nothing to check');
    return 0;
  }
  const root = env.GITHUB_WORKSPACE ?? process.cwd();
  const range = `${pr.base.sha}..${pr.head.sha}`;
  const findings = await check(root, { range });
  for (const x of findings) console.log(`${x.severity.toUpperCase().padEnd(8)} ${x.message}`);

  const token = env['INPUT_GITHUB-TOKEN'] || env.GITHUB_TOKEN;
  if (!token) throw new Error('no GitHub token: set the github-token input');
  const api = `${env.GITHUB_API_URL ?? 'https://api.github.com'}/repos/${env.GITHUB_REPOSITORY}`;
  const gh = async (method: string, path: string, body?: unknown): Promise<unknown> => {
    const res = await f(`${api}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    if (!res.ok) throw new Error(`GitHub ${method} ${path} responded ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  };

  let existing: { id: number } | undefined;
  for (let page = 1; !existing; page++) {
    const comments = (await gh('GET', `/issues/${pr.number}/comments?per_page=100&page=${page}`)) as { id: number; body?: string }[];
    existing = comments.find((c) => c.body?.includes(MARKER));
    if (comments.length < 100) break;
  }
  const body = { body: summary(findings, range) };
  if (existing) await gh('PATCH', `/issues/comments/${existing.id}`, body);
  else await gh('POST', `/issues/${pr.number}/comments`, body);
  console.log(`ledger: ${existing ? 'updated' : 'posted'} summary comment on #${pr.number}`);

  const failOn = env['INPUT_FAIL-ON'] as FindingSeverity | undefined;
  if (failOn && !(FINDING_SEVERITY as readonly string[]).includes(failOn)) throw new Error(`fail-on must be one of ${FINDING_SEVERITY.join(', ')}`);
  return failOn && findings.some((x) => severityRank(x.severity) >= severityRank(failOn)) ? 1 : 0;
}
