import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

export const AUTH_V1 = `export class AuthClient {
  request(): number {
    return 1;
  }
}

export async function refreshToken(): Promise<string> {
  return 'token';
}
`;

export const AUTH_V2 = AUTH_V1.replace("  return 'token';", "  await backoff();\n  return 'token';");

/**
 * Initialized ledger (fake provider) with: change for AUTH_V1, local issue #1 ("thundering herd"
 * only in its body), and a "fix #1" commit touching refreshToken, recorded via `record`.
 */
export async function seededRepo(): Promise<ReturnType<typeof tempRepo> & { fixSha: string }> {
  const { init, newIssue, recordCommit } = await import('../src/index.js');
  const repo = tempRepo();
  init(repo.dir);
  const cfg = join(repo.dir, '.ledger/config.yaml');
  writeFileSync(cfg, readFileSync(cfg, 'utf8').replace(/^provider: \w+/m, 'provider: fake'));
  repo.commit('init ledger');
  repo.write('src/auth.ts', AUTH_V1);
  repo.commit('Add auth client');
  await recordCommit(repo.dir);
  newIssue(repo.dir, { title: 'Login times out under load', symptom: 'Token refresh causes a thundering herd against the IdP.', severity: 'high' });
  repo.write('src/auth.ts', AUTH_V2);
  const fixSha = repo.commit('fix #1: back off token refresh');
  await recordCommit(repo.dir);
  return { ...repo, fixSha };
}
