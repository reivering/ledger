import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  closeIssue, explain, getRecord, githubSource, importIssues, issueWarning, loadConfig, openIndex, readRecords,
  resolveTarget, search, why, type IssueRecord, type ChangeRecord, type Provider,
} from '../src/index.js';
import { seededRepo, tempRepo } from './fixture.js';

let repo: Awaited<ReturnType<typeof seededRepo>> | ReturnType<typeof tempRepo> | undefined;
afterEach(() => {
  repo?.cleanup();
  vi.unstubAllGlobals();
});

const recs = (dir: string) => readRecords(dir).records;
const issue = (dir: string, ext = '#1') => recs(dir).find((r) => r.front.type === 'issue' && r.front.external_id === ext)!;
const changeFor = (dir: string, sha: string) => recs(dir).find((r) => r.front.type === 'change' && sha.startsWith(r.front.commit))!;

describe('issues ↔ changes', () => {
  it('"fix #1" commit links both ways, anchored to the parsed symbol', async () => {
    const r = (repo = await seededRepo());
    const iss = issue(r.dir).front as IssueRecord;
    const chg = changeFor(r.dir, r.fixSha).front as ChangeRecord;
    expect(chg.issues).toEqual([iss.id]);
    expect(chg.symbols).toEqual(['refreshToken']);
    expect(iss).toMatchObject({ status: 'open', severity: 'high', source: 'local', fix_commits: [chg.commit], related_changes: [chg.id], files: ['src/auth.ts'], symbols: ['refreshToken'] });
  });

  it('issue close resolves and fills root cause + fix via the provider', async () => {
    const r = (repo = await seededRepo());
    await closeIssue(r.dir, '1', r.fixSha);
    const { front } = issue(r.dir);
    const body = readFileSync(issue(r.dir).path, 'utf8');
    expect(front).toMatchObject({ status: 'resolved', related_changes: [changeFor(r.dir, r.fixSha).front.id] });
    expect((front as IssueRecord).fix_commits).toHaveLength(1);
    expect(body).toContain('## Root cause\nFake root cause derived from the fix diff.');
    expect(body).toContain('## Fix\nFake fix summary.');
    expect(body).toContain('## Symptom\nToken refresh causes a thundering herd');
  });
});

describe('index + queries', () => {
  it('why path#symbol returns anchored records first and flags the linked bug', async () => {
    const r = (repo = await seededRepo());
    const ix = openIndex(r.dir);
    const res = why(ix, await resolveTarget(r.dir, r.dir, 'src/auth.ts#refreshToken'));
    expect(res.anchored.map((h) => h.id)).toEqual([changeFor(r.dir, r.fixSha).front.id, expect.any(String)]);
    expect(res.issues.map(issueWarning)).toEqual(['⚠ This code was involved in #1 (open): Login times out under load']);

    const method = why(ix, await resolveTarget(r.dir, r.dir, 'src/auth.ts:3')); // line 3 is inside AuthClient.request
    expect(method.target.symbol).toBe('AuthClient.request');
    expect(method.anchored).toHaveLength(1);
    expect(method.file_level).toHaveLength(1); // the fix change, file-level only

    const answer = await explain(ix, loadConfig(r.dir), res);
    expect(answer).toContain(`[${res.issues[0]!.id}]`);

    // Hallucinated ids: one retry with the error, then stripped.
    const prompts: string[] = [];
    const liar: Provider = async (p) => (prompts.push(p.user), `Because of [chg_01ZZZZZZZZZZZZZZZZZZZZZZZZ, ${res.issues[0]!.id}] and [chg_chg].`);
    expect(await explain(ix, loadConfig(r.dir), res, liar)).toBe(`Because of [${res.issues[0]!.id}] and .`);
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain('cited ids that are not in the records above: chg_01ZZZZZZZZZZZZZZZZZZZZZZZZ, chg_chg');
    ix.db.close();
  });

  it('rebuilds transparently when .ledger/.cache is deleted, and picks up hand edits', async () => {
    const r = (repo = await seededRepo());
    rmSync(join(r.dir, '.ledger/.cache'), { recursive: true });
    let ix = openIndex(r.dir);
    expect(getRecord(ix, '#1')?.title).toBe('Login times out under load');
    ix.db.close();

    const p = issue(r.dir).path;
    writeFileSync(p, readFileSync(p, 'utf8').replace('title: Login times out under load', 'title: Login hangs'));
    ix = openIndex(r.dir);
    expect(getRecord(ix, '#1')?.title).toBe('Login hangs');
    ix.db.close();
  });

  it('search finds a record by a word only in its body; semantic mode fuses results', async () => {
    const r = (repo = await seededRepo());
    const ix = openIndex(r.dir);
    const cfg = loadConfig(r.dir);
    const { hits } = await search(ix, cfg, 'thundering');
    expect(hits.map((h) => (h.type === 'issue' ? h.external_id : h.id))).toEqual(['#1']);
    expect(hits[0]!.snippet).toContain('«thundering»');

    const semantic = await search(ix, { ...cfg, search: { semantic: true, provider: 'fake' } }, 'thundering herd');
    expect(semantic.warnings).toEqual([]);
    expect(semantic.hits[0]!.type).toBe('issue');
    ix.db.close();
  });
});

describe('github import (recorded fixtures, no network)', () => {
  const FIX = join(import.meta.dirname, 'fixtures/github');
  // The fake key is assembled at runtime so no literal secret is committed (it would trip secret scanners).
  const load = (f: string): unknown => JSON.parse(readFileSync(join(FIX, f), 'utf8').replace('__FAKE_STRIPE_KEY__', ['sk_live_', '4eC39HqLyjWDarjtT1zdp7dc'].join('')));

  it('imports issues + closing commits, links existing changes, is incremental and additive', async () => {
    const r = (repo = await seededRepo());
    // A change recorded before import that references GitHub issue #7.
    r.write('src/pay.ts', 'export function charge() {\n  return 1;\n}\n');
    r.commit('Guard double charge, fixes #7');
    const { recordCommit } = await import('../src/index.js');
    await recordCommit(r.dir);

    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url);
      const body = url.includes('/issues/7/events') ? load('events-7.json')
        : url.includes('/issues/9/events') ? load('events-9.json')
        : url.includes('since=') ? load('issues-incremental.json')
        : load('issues-page1.json');
      return new Response(JSON.stringify(body), { status: 200 });
    });
    const source = githubSource('acme/payments', 'test-token');

    expect(await importIssues(r.dir, source)).toEqual({ created: 3, updated: 0, renamed: [] });
    const gh7 = issue(r.dir, '#7');
    expect(gh7.front).toMatchObject({ source: 'github', status: 'resolved', severity: 'critical', fix_commits: ['9fceb02d0ae5', expect.stringMatching(/^[0-9a-f]{7,}$/)], labels: ['bug', 'P0'] });
    expect((gh7.front as IssueRecord).related_changes).toHaveLength(1); // linked to the earlier change
    expect(issue(r.dir, '#9').front).toMatchObject({ status: 'wontfix' });
    expect(readFileSync(gh7.path, 'utf8')).toContain('[REDACTED:stripe_key]');
    const chg = recs(r.dir).find((x) => x.front.title.includes('double charge'))!.front as ChangeRecord;
    expect(chg.issues).toEqual([gh7.front.id]);
    expect(urls.some((u) => u.includes('/issues/8/events'))).toBe(false); // open issues need no events call
    const state = JSON.parse(readFileSync(join(r.dir, '.ledger/state/github.json'), 'utf8'));
    expect(state.last_sync).toBe('2026-10-02T09:00:00Z');

    // Hand-edit, then an incremental sync that re-titles #8 (and re-sends unchanged #9).
    writeFileSync(gh7.path, readFileSync(gh7.path, 'utf8').replace('## Root cause\n', '## Root cause\nLocal analysis kept.\n'));
    const before = readdirSync(join(r.dir, '.ledger/issues')).length;
    expect(await importIssues(r.dir, source)).toEqual({ created: 0, updated: 1, renamed: [] });
    expect(urls.filter((u) => u.includes('since='))).toEqual([expect.stringContaining('since=2026-10-02T09%3A00%3A00Z')]);
    expect(issue(r.dir, '#8').front.title).toBe('Refund webhook retries forever (renamed)');
    expect(readFileSync(gh7.path, 'utf8')).toContain('Local analysis kept.');
    expect(readdirSync(join(r.dir, '.ledger/issues'))).toHaveLength(before);
  });
});

it('a GitHub issue with the same number as a local one moves the local issue to LOCAL-N', async () => {
  const r = (repo = await seededRepo()); // local #1, linked to the "fix #1" change
  const localId = issue(r.dir).front.id;
  const gh = { number: 1, title: 'Upstream bug', body: '', state: 'open', labels: [], created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', closed_at: null };
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify([gh]), { status: 200 }));
  const { importIssues: imp, newIssue } = await import('../src/index.js');
  expect(await imp(r.dir, githubSource('acme/x', 't'))).toEqual({ created: 1, updated: 0, renamed: ['#1 → LOCAL-2'] });
  const all = recs(r.dir).filter((x) => x.front.type === 'issue').map((x) => [x.front.id === localId ? 'local' : 'github', (x.front as IssueRecord).external_id]);
  expect(all.sort()).toEqual([['github', '#1'], ['local', 'LOCAL-2']]);
  expect((changeFor(r.dir, r.fixSha).front as ChangeRecord).issues).toEqual([localId]); // link survives the rename
  expect((newIssue(r.dir, { title: 'Next' }).front as IssueRecord).external_id).toBe('LOCAL-3');
});

