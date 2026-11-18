import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { git } from './git.js';
import { BIN_NAME } from './product.js';

const MARK = `# managed-by: ${BIN_NAME}`;
const shq = (s: string): string => `'${s.replaceAll("'", `'\\''`)}'`;
/** `check --pre-push` exits with this only when check.pre_push_fail_on is set and exceeded. */
export const PRE_PUSH_BLOCK_EXIT = 3;

/** Respects core.hooksPath. */
const hooksDir = (root: string): string => resolve(root, git(root, ['rev-parse', '--git-path', 'hooks']).trim());
const isOurs = (p: string): boolean => readFileSync(p, 'utf8').includes(MARK);

function scripts(cmd: string, prePush: boolean): Record<string, string> {
  const record = [
    '#!/bin/sh',
    MARK,
    '# Records the new HEAD in the background. Never blocks or fails the git operation.',
    '# Rebases replay already-recorded commits as new ones; record nothing until the rebase is done.',
    '[ -d "$(git rev-parse --git-path rebase-merge)" ] || [ -d "$(git rev-parse --git-path rebase-apply)" ] && exit 0',
    'sha=$(git rev-parse HEAD 2>/dev/null) || exit 0',
    `log="$(git rev-parse --git-dir 2>/dev/null)/${BIN_NAME}-hook.log"`,
    `nohup ${cmd} record "$sha" >>"$log" 2>&1 </dev/null &`,
    'exit 0',
    '',
  ].join('\n');
  const push = [
    '#!/bin/sh',
    MARK,
    '# Warns about past bugs in the code being pushed. Blocks only if check.pre_push_fail_on is set;',
    `# any ${BIN_NAME} error lets the push through.`,
    'z=0000000000000000000000000000000000000000',
    'block=0',
    'while read -r lref lsha rref rsha; do',
    '  [ "$lsha" = "$z" ] && continue',
    '  if [ "$rsha" = "$z" ]; then',
    '    first=$(git rev-list "$lsha" --not --remotes 2>/dev/null | tail -n 1)',
    '    base=$(git rev-parse -q --verify "$first^" 2>/dev/null) || continue',
    '  else base=$rsha; fi',
    `  ${cmd} check --pre-push --range "$base..$lsha" </dev/null >&2`,
    `  [ $? -eq ${PRE_PUSH_BLOCK_EXIT} ] && block=1`,
    'done',
    'exit $block',
    '',
  ].join('\n');
  return { 'post-commit': record, 'post-merge': record, ...(prePush && { 'pre-push': push }) };
}

/** `command` is the argv that runs the CLI, e.g. [process.execPath, '/path/to/cli.js']. */
export function installHooks(root: string, command: string[], o: { prePush?: boolean } = {}): string[] {
  const files = Object.entries(scripts(command.map(shq).join(' '), o.prePush ?? false)).map(([n, s]) => [join(hooksDir(root), n), s] as const);
  const foreign = files.filter(([p]) => existsSync(p) && !isOurs(p)).map(([p]) => p);
  if (foreign.length) {
    throw new Error(
      `refusing to overwrite existing hooks: ${foreign.join(', ')}\n` +
        `add this line to them instead: ${BIN_NAME} record "$(git rev-parse HEAD)" >/dev/null 2>&1 &`,
    );
  }
  for (const [p, s] of files) {
    mkdirSync(resolve(p, '..'), { recursive: true });
    writeFileSync(p, s);
    chmodSync(p, 0o755);
  }
  return files.map(([p]) => p);
}

/** Removes only hooks this tool installed. */
export function uninstallHooks(root: string): string[] {
  const ours = ['post-commit', 'post-merge', 'pre-push'].map((h) => join(hooksDir(root), h)).filter((p) => existsSync(p) && isOurs(p));
  for (const p of ours) unlinkSync(p);
  return ours;
}
