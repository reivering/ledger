import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { env, tempRepo } from '../../core/test/fixture.js';

const CLI = fileURLToPath(new URL('../dist/index.js', import.meta.url));
let repo: ReturnType<typeof tempRepo>;
const ledger = (...a: string[]): string => execFileSync(process.execPath, [CLI, ...a], { cwd: repo.dir, env, encoding: 'utf8' });
const changes = (): string[] => readdirSync(join(repo.dir, '.ledger/changes')).filter((f) => f.endsWith('.md'));
const until = async (ok: () => boolean): Promise<void> => {
  for (let i = 0; i < 100 && !ok(); i++) await new Promise((r) => setTimeout(r, 100));
};

beforeEach(() => (repo = tempRepo()));
afterEach(() => repo.cleanup());

it('init → commit → record → list', () => {
  expect(ledger('init')).toContain('.ledger/config.yaml');
  expect(ledger('init')).toBe('already initialized\n');
  const cfg = join(repo.dir, '.ledger/config.yaml');
  writeFileSync(cfg, readFileSync(cfg, 'utf8').replace(/^provider: \w+/m, 'provider: fake'));
  repo.write('src/x.ts', 'export const x = 1;\n');
  repo.commit('Add x');

  const path = ledger('record').trim();
  expect(path).toMatch(/^\.ledger\/changes\/\d{4}-\d\d-\d\d-add-x\.md$/);
  expect(ledger('record')).toMatch(/^skipped: already recorded/);
  expect(changes()).toHaveLength(1);
  expect(ledger('list')).toMatch(/DATE\s+TYPE\s+CATEGORY\s+RISK\s+TITLE\n\d{4}-\d\d-\d\d\s+change\s+feature\s+low\s+Add x/);
});

it('record --dry-run without an API key prints the payload and exits 0', () => {
  ledger('init');
  repo.write('k.env', `AWS=${['AKIA', 'IOSFODNN7EXAMPLE'].join('')}\n`);
  repo.commit('Add key');
  const out = ledger('record', '--dry-run');
  expect(out).toContain('dry run — nothing sent');
  expect(out).toContain('[REDACTED:aws_key]');
});

it('hooks never fail git commit/merge, even with no API key; uninstall removes them', async () => {
  ledger('init');
  repo.commit('init ledger');
  ledger('hook', 'install');

  // anthropic provider + no key: recording fails in the background, git must not.
  repo.write('a.txt', 'a\n');
  repo.git('add', '-A');
  expect(spawnSync('git', ['commit', '-qm', 'Add a'], { cwd: repo.dir, env }).status).toBe(0);
  repo.git('checkout', '-q', '-b', 'f');
  repo.write('b.txt', 'b\n');
  repo.commit('Add b');
  repo.git('checkout', '-q', 'main');
  expect(spawnSync('git', ['merge', '-q', '--no-ff', '-m', 'Merge f', 'f'], { cwd: repo.dir, env }).status).toBe(0);
  const log = join(repo.dir, '.git/ledger-hook.log');
  const failures = (): number => (existsSync(log) ? readFileSync(log, 'utf8').split('set LEDGER_ANTHROPIC_API_KEY').length - 1 : 0);
  await until(() => failures() === 3); // Add a, Add b (post-commit) + merge (post-merge)
  expect(failures()).toBe(3);
  expect(changes()).toHaveLength(0);

  // With a working provider the hook actually records.
  const cfg = join(repo.dir, '.ledger/config.yaml');
  writeFileSync(cfg, readFileSync(cfg, 'utf8').replace(/^provider: \w+/m, 'provider: fake'));
  repo.write('c.txt', 'c\n');
  repo.commit('Add c');
  await until(() => changes().length === 1);
  expect(changes()).toEqual([expect.stringMatching(/add-c\.md$/)]);

  ledger('hook', 'uninstall');
  expect(existsSync(join(repo.dir, '.git/hooks/post-commit'))).toBe(false);
  expect(existsSync(join(repo.dir, '.git/hooks/post-merge'))).toBe(false);
});

it('a rebase does not record replayed commits', async () => {
  ledger('init');
  const cfg = join(repo.dir, '.ledger/config.yaml');
  writeFileSync(cfg, readFileSync(cfg, 'utf8').replace(/^provider: \w+/m, 'provider: fake'));
  repo.commit('init');
  ledger('hook', 'install');
  repo.write('a.txt', 'a\n');
  repo.commit('main a');
  repo.git('checkout', '-q', '-b', 'f', 'HEAD~1');
  for (const n of [1, 2]) {
    repo.write(`f${n}.txt`, `${n}\n`);
    repo.commit(`feat ${n}`);
  }
  await until(() => changes().length === 3);
  repo.git('rebase', '-q', 'main');
  await new Promise((r) => setTimeout(r, 2000)); // give any (wrongly) spawned hook runs time to write
  expect(changes()).toHaveLength(3);
});

it('refuses to clobber a foreign hook', () => {
  ledger('init');
  writeFileSync(join(repo.dir, '.git/hooks/post-commit'), '#!/bin/sh\necho mine\n');
  expect(() => ledger('hook', 'install')).toThrow(/refusing to overwrite/);
  expect(readFileSync(join(repo.dir, '.git/hooks/post-commit'), 'utf8')).toBe('#!/bin/sh\necho mine\n');
});

it('issue new → fix commit → why/search/show (--json), with --no-ai and the fake provider', () => {
  ledger('init');
  const cfg = join(repo.dir, '.ledger/config.yaml');
  writeFileSync(cfg, readFileSync(cfg, 'utf8').replace(/^provider: \w+/m, 'provider: fake'));
  repo.commit('init');
  expect(ledger('issue', 'new', '--title', 'Login times out', '--symptom', 'Stampede on refresh', '--severity', 'high')).toMatch(/^#1 {2}iss_/);
  repo.write('src/auth.ts', 'export function refreshToken() {\n  return 1;\n}\n');
  repo.commit('fix #1: add refresh');
  expect(ledger('record')).toContain('(linked #1)');

  const human = ledger('why', 'src/auth.ts#refreshToken');
  expect(human).toMatch(/^⚠ This code was involved in #1 \(open\): Login times out\n/);
  expect(human).toContain('Fake answer based on [iss_');
  const j = JSON.parse(ledger('why', 'src/auth.ts#refreshToken', '--json', '--no-ai'));
  expect(j.anchored).toHaveLength(1);
  expect(j.answer).toBeUndefined();

  expect(JSON.parse(ledger('search', 'stampede', '--json'))[0].external_id).toBe('#1');
  expect(ledger('show', '1')).toContain('## Symptom\nStampede on refresh');
  expect(ledger('issue', 'close', '#1', '--commit', 'HEAD')).toMatch(/^resolved #1/);
  expect(ledger('why', 'src/auth.ts', '--no-ai')).toMatch(/^⚠ This code was involved in #1 \(resolved \d{4}-\d\d-\d\d\)/);
});
