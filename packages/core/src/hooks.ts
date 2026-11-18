import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { git } from './git.js';
import { BIN_NAME } from './product.js';

const HOOKS = ['post-commit', 'post-merge'];
const MARK = `# managed-by: ${BIN_NAME}`;
const shq = (s: string): string => `'${s.replaceAll("'", `'\\''`)}'`;

/** Respects core.hooksPath. */
const hookPaths = (root: string): string[] => {
  const dir = resolve(root, git(root, ['rev-parse', '--git-path', 'hooks']).trim());
  return HOOKS.map((h) => join(dir, h));
};
const isOurs = (p: string): boolean => readFileSync(p, 'utf8').includes(MARK);

/** `command` is the argv that runs the CLI, e.g. [process.execPath, '/path/to/cli.js']. */
export function installHooks(root: string, command: string[]): string[] {
  const paths = hookPaths(root);
  const foreign = paths.filter((p) => existsSync(p) && !isOurs(p));
  if (foreign.length) {
    throw new Error(
      `refusing to overwrite existing hooks: ${foreign.join(', ')}\n` +
        `add this line to them instead: ${BIN_NAME} record "$(git rev-parse HEAD)" >/dev/null 2>&1 &`,
    );
  }
  const script = [
    '#!/bin/sh',
    MARK,
    '# Records the new HEAD in the background. Never blocks or fails the git operation.',
    'sha=$(git rev-parse HEAD 2>/dev/null) || exit 0',
    `log="$(git rev-parse --git-dir 2>/dev/null)/${BIN_NAME}-hook.log"`,
    `nohup ${command.map(shq).join(' ')} record "$sha" >>"$log" 2>&1 </dev/null &`,
    'exit 0',
    '',
  ].join('\n');
  for (const p of paths) {
    mkdirSync(resolve(p, '..'), { recursive: true });
    writeFileSync(p, script);
    chmodSync(p, 0o755);
  }
  return paths;
}

/** Removes only hooks this tool installed. */
export function uninstallHooks(root: string): string[] {
  const ours = hookPaths(root).filter((p) => existsSync(p) && isOurs(p));
  for (const p of ours) unlinkSync(p);
  return ours;
}
