import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { issueRefs, truncate } from '../src/collect.js';
import { fakeProvider, type Provider } from '../src/providers.js';
import { recordCommit } from '../src/record.js';
import { init, parseRecord } from '../src/store.js';
import { tempRepo } from './fixture.js';

const AWS = ['AKIA', 'IOSFODNN7EXAMPLE'].join('');
const setProvider = (dir: string, p: string): void => {
  const f = join(dir, '.ledger/config.yaml');
  writeFileSync(f, readFileSync(f, 'utf8').replace(/^provider: \w+/m, `provider: ${p}`));
};
const changes = (dir: string): string[] => readdirSync(join(dir, '.ledger/changes')).filter((f) => f.endsWith('.md'));

let repo: ReturnType<typeof tempRepo>;
beforeEach(() => {
  repo = tempRepo();
  init(repo.dir);
  setProvider(repo.dir, 'fake');
  repo.commit('init ledger');
});
afterEach(() => repo.cleanup());

describe('init', () => {
  it('is idempotent and never overwrites', () => {
    writeFileSync(join(repo.dir, '.ledger/config.yaml'), 'provider: fake\nmodel: x\n');
    expect(init(repo.dir)).toEqual([]);
    expect(readFileSync(join(repo.dir, '.ledger/config.yaml'), 'utf8')).toBe('provider: fake\nmodel: x\n');
    expect(readFileSync(join(repo.dir, '.gitignore'), 'utf8')).toBe('.ledger/.cache/\n');
  });
});

describe('record', () => {
  it('writes a valid record once, skips on rerun, regenerates with --force', async () => {
    repo.write('src/auth.ts', 'export function refreshToken() {}\n');
    const sha = repo.commit('Add token refresh (#142, PROJ-7)');

    const r = await recordCommit(repo.dir);
    expect(r.status).toBe('written');
    const { front, body } = parseRecord(readFileSync((r as { path: string }).path, 'utf8'));
    expect(front).toMatchObject({ type: 'change', title: 'Add token refresh (#142, PROJ-7)', issues: ['#142', 'PROJ-7'], files: ['src/auth.ts'], reviewed: false });
    expect(sha.startsWith((front as { commit: string }).commit)).toBe(true);
    expect(front.id).toMatch(/^chg_[0-9A-Z]{26}$/);
    expect(body).toContain('## Impact / blast radius');

    expect((await recordCommit(repo.dir)).status).toBe('skipped');
    const forced = await recordCommit(repo.dir, { force: true });
    expect(forced).toEqual(r);
    expect(parseRecord(readFileSync((forced as { path: string }).path, 'utf8')).front.id).toBe(front.id);
    expect(changes(repo.dir)).toHaveLength(1);
  });

  it('dry-run redacts and makes zero network calls', async () => {
    setProvider(repo.dir, 'anthropic');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    repo.write('config.ts', `export const AWS_ACCESS_KEY_ID = "${AWS}";\n`);
    repo.write('.env.production', 'DATABASE_URL=postgres://u:p@h/db\n');
    repo.commit('Add config');

    const r = await recordCommit(repo.dir, { dryRun: true });
    expect(r.status).toBe('dry-run');
    const text = JSON.stringify(r);
    expect(text).toContain('[REDACTED:aws_key]');
    expect(text).toContain('[REDACTED:env_file]');
    expect(text).not.toContain(AWS);
    expect(text).not.toContain('postgres://');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(changes(repo.dir)).toHaveLength(0);
    fetchSpy.mockRestore();
  });

  it('retries once on invalid output, then fails', async () => {
    repo.write('a.txt', 'a\n');
    repo.commit('Add a');
    let calls = 0;
    const flaky: Provider = async (p) => (++calls === 1 ? 'not json' : fakeProvider('chore')(p));
    expect((await recordCommit(repo.dir, { provider: flaky })).status).toBe('written');
    expect(calls).toBe(2);

    const bad: Provider = async () => '{"title": ""}';
    await expect(recordCommit(repo.dir, { force: true, provider: bad })).rejects.toThrow(/invalid output twice/);
  });

  it('diffs merge commits against the first parent', async () => {
    repo.write('base.txt', 'base\n');
    repo.commit('base');
    repo.git('checkout', '-q', '-b', 'feature');
    repo.write('feature.txt', 'f\n');
    repo.commit('feature');
    repo.git('checkout', '-q', 'main');
    repo.write('main.txt', 'm\n');
    repo.commit('main work');
    repo.git('merge', '-q', '--no-ff', '-m', 'Merge feature', 'feature');

    const r = await recordCommit(repo.dir, { dryRun: true });
    const user = (r as { prompt: { user: string } }).prompt.user;
    expect(user).toContain('(merge; diff is against first parent');
    expect(user).toContain('feature.txt');
    expect(user).not.toContain('main.txt');
  });

  it('skips commits that only touch .ledger/ (no hook feedback loop)', async () => {
    repo.write('a.txt', 'a\n');
    repo.commit('a');
    await recordCommit(repo.dir);
    repo.commit('Add ledger records');
    expect(await recordCommit(repo.dir)).toMatchObject({ status: 'skipped' });
  });
});

describe('collector helpers', () => {
  it('extracts issue refs', () => {
    expect(issueRefs('Fix #12 and PAY-301; UTF-8, SHA-256, color&#39;')).toEqual(['#12', 'PAY-301']);
  });

  it('truncates by file then hunk and notes it', () => {
    const file = (p: string, hunks: number): { path: string; text: string } => ({
      path: p,
      text: `diff --git a/${p} b/${p}\n` + Array.from({ length: hunks }, (_, i) => `@@ -${i} +${i} @@\n+${'x'.repeat(50)}\n`).join(''),
    });
    const { diff, notes } = truncate([file('pnpm-lock.yaml', 1), file('a.ts', 1), file('b.ts', 4)], 220);
    expect(diff).toContain('a/a.ts');
    expect(diff).toContain('a/b.ts');
    expect(diff).not.toContain('pnpm-lock');
    expect(notes).toEqual(['pnpm-lock.yaml: generated/lock file, summary only', 'b.ts: 3 of 4 hunks omitted']);
  });
});
