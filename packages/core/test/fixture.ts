import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

// Isolate from the developer's global/system git config (hooksPath, signing, templates).
export const env: NodeJS.ProcessEnv = {
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('LEDGER_') && !k.startsWith('GIT_'))),
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
};

export function tempRepo(): { dir: string; git: (...a: string[]) => string; write: (p: string, s: string) => void; commit: (msg: string) => string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'ledger-test-'));
  const git = (...a: string[]): string => execFileSync('git', a, { cwd: dir, env, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'dev@company.com');
  git('config', 'user.name', 'Dev');
  const write = (p: string, s: string): void => {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), s);
  };
  const commit = (msg: string): string => {
    git('add', '-A');
    git('commit', '-q', '-m', msg);
    return git('rev-parse', 'HEAD').trim();
  };
  return { dir, git, write, commit, cleanup: () => rmSync(dir, { recursive: true, force: true, maxRetries: 5 }) };
}
