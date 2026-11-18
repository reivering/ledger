#!/usr/bin/env node
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  BIN_NAME,
  checkLicense,
  init,
  installHooks,
  PRODUCT_NAME,
  readRecords,
  recordCommit,
  repoRoot,
  uninstallHooks,
} from '@ledger/core';

const HELP = `${PRODUCT_NAME} — local-first engineering memory

Usage:
  ${BIN_NAME} init                     create .ledger/ in this repo (idempotent)
  ${BIN_NAME} record [<commit>]        document a commit (default HEAD)
      --dry-run                        print the redacted payload; send nothing
      --force                          regenerate an existing record
  ${BIN_NAME} hook install|uninstall   post-commit/post-merge hooks (background, never block git)
  ${BIN_NAME} list [-n 20]             recent records`;

async function main(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      'dry-run': { type: 'boolean' },
      force: { type: 'boolean' },
      limit: { type: 'string', short: 'n', default: '20' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [cmd, arg] = positionals;
  if (values.help || !cmd) return console.log(HELP);

  checkLicense();
  const root = repoRoot(process.cwd());
  const rel = (p: string): string => relative(root, p);

  switch (cmd) {
    case 'init': {
      const created = init(root);
      console.log(created.length ? `created:\n  ${created.join('\n  ')}` : 'already initialized');
      return;
    }
    case 'record': {
      const r = await recordCommit(root, { rev: arg, dryRun: values['dry-run'], force: values.force });
      if (r.status === 'written') console.log(rel(r.path));
      else if (r.status === 'skipped') console.log(`skipped: ${r.reason}`);
      else {
        console.log(`# dry run — nothing sent. Would send to ${r.provider} (${r.model}):\n`);
        console.log(`=== system ===\n${r.prompt.system}\n\n=== user ===\n${r.prompt.user}`);
      }
      return;
    }
    case 'hook': {
      if (arg === 'install') {
        const paths = installHooks(root, [process.execPath, fileURLToPath(import.meta.url)]);
        console.log(`installed:\n  ${paths.map(rel).join('\n  ')}`);
      } else if (arg === 'uninstall') {
        const paths = uninstallHooks(root);
        console.log(paths.length ? `removed:\n  ${paths.map(rel).join('\n  ')}` : 'no hooks installed');
      } else throw new Error(`usage: ${BIN_NAME} hook install|uninstall`);
      return;
    }
    case 'list': {
      const { records, errors } = readRecords(root);
      for (const e of errors) console.error(`invalid record: ${e}`);
      const rows = records
        .map(({ front: f }) => [
          f.date.slice(0, 10),
          f.type,
          f.type === 'change' ? f.category : f.status,
          f.type === 'change' ? f.risk : '-',
          f.title,
        ])
        .sort((a, b) => (b[0] ?? '').localeCompare(a[0] ?? ''))
        .slice(0, Number(values.limit) || 20);
      if (!rows.length) return console.log('no records');
      const table = [['DATE', 'TYPE', 'CATEGORY', 'RISK', 'TITLE'], ...rows];
      const widths = [0, 1, 2, 3].map((i) => Math.max(...table.map((r) => (r[i] ?? '').length)));
      for (const r of table) console.log(r.map((c, i) => (i < 4 ? c.padEnd(widths[i] ?? 0) : c)).join('  '));
      return;
    }
    default:
      throw new Error(`unknown command "${cmd}"\n\n${HELP}`);
  }
}

main(process.argv.slice(2)).catch((e: unknown) => {
  console.error(`${BIN_NAME}: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
