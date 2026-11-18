import { execFileSync } from 'node:child_process';

export function git(cwd: string, args: string[]): string {
  return execFileSync('git', ['-c', 'core.quotepath=off', ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1 << 30,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export const repoRoot = (cwd: string): string => git(cwd, ['rev-parse', '--show-toplevel']).trim();
