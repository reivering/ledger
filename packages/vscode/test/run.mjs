// Builds a fixture repo with a resolved bug linked to `refreshToken`, then runs the suite inside VS Code.
// Uses VSCODE_EXECUTABLE or Arch's system VS Code when present, else @vscode/test-electron downloads one.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTests } from '@vscode/test-electron';

const here = dirname(fileURLToPath(import.meta.url));
const CLI = join(here, '../../cli/dist/index.js');
const env = {
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('LEDGER_') && !k.startsWith('GIT_'))),
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
};
const dir = mkdtempSync(join(tmpdir(), 'ledger-vscode-'));
const repo = join(dir, 'repo');
mkdirSync(join(repo, 'src'), { recursive: true });
const sh = (cmd, ...args) => execFileSync(cmd, args, { cwd: repo, env, encoding: 'utf8' });
const ledger = (...args) => sh('node', CLI, ...args);
const commit = (msg) => (sh('git', 'add', '-A'), sh('git', 'commit', '-qm', msg));

const V1 = `export class AuthClient {
  request(): number {
    return 1;
  }
}

export async function refreshToken(): Promise<string> {
  return 'token';
}
`;
sh('git', 'init', '-q', '-b', 'main');
sh('git', 'config', 'user.email', 'dev@company.com');
sh('git', 'config', 'user.name', 'Dev');
ledger('init');
writeFileSync(join(repo, '.ledger/config.yaml'), 'provider: fake\nmodel: fake\n');
commit('init ledger');
writeFileSync(join(repo, 'src/auth.ts'), V1);
commit('Add auth client');
ledger('record');
ledger('issue', 'new', '--title', 'Login times out under load', '--symptom', 'Refresh stampede', '--severity', 'high');
writeFileSync(join(repo, 'src/auth.ts'), V1.replace("  return 'token';", "  await backoff();\n  return 'token';"));
commit('fix #1: back off token refresh');
ledger('record');
ledger('issue', 'close', '1', '--commit', 'HEAD');
mkdirSync(join(repo, '.vscode'));
writeFileSync(join(repo, '.vscode/settings.json'), JSON.stringify({ 'ledger.path': CLI }));

// Arch's `code`/`code-oss` is a shell wrapper around VS Code's CLI, which detaches the window and exits at once;
// launch the system Electron with VS Code's main module instead, so runTests sees the real exit code.
const archMain = '/usr/lib/code/code.mjs';
const archElectron = existsSync(archMain) && readdirSync('/usr/lib').filter((d) => /^electron\d+$/.test(d)).sort().reverse().map((d) => `/usr/lib/${d}/electron`).find(existsSync);
const exe = process.env.VSCODE_EXECUTABLE ?? archElectron;
try {
  await runTests({
    ...(exe && { vscodeExecutablePath: exe }),
    extensionDevelopmentPath: join(here, '..'),
    extensionTestsPath: join(here, 'suite.cjs'),
    launchArgs: [
      ...(exe === archElectron ? [archMain] : []),
      repo, '--disable-extensions', '--disable-workspace-trust', `--user-data-dir=${join(dir, 'user')}`, `--extensions-dir=${join(dir, 'ext')}`,
    ],
    extensionTestsEnv: { LEDGER_FIXTURE: repo, LEDGER_CLI: CLI },
  });
  console.log('vscode extension tests passed');
} catch (e) {
  console.error('vscode extension tests failed', e);
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
