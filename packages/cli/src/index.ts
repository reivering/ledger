#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  BIN_NAME, checkLicense, closeIssue, explain, getRecord, githubRepoFromRemote, githubSource, type Hit, importIssues,
  init, installHooks, issueWarning, loadConfig, newIssue, openIndex, PRODUCT_NAME, readRecords, recordCommit, reindex,
  repoRoot, resolveTarget, search, SEVERITY, uninstallHooks, why,
} from '@ledger/core';
import { serve } from '@ledger/mcp';

const HELP = `${PRODUCT_NAME} — local-first engineering memory

Usage:
  ${BIN_NAME} init                         create .ledger/ in this repo (idempotent)
  ${BIN_NAME} record [<commit>]            document a commit (default HEAD) [--dry-run] [--force]
  ${BIN_NAME} hook install|uninstall       post-commit/post-merge hooks (background, never block git)
  ${BIN_NAME} list [-n 20]                 recent records

  ${BIN_NAME} issue new [--title T --symptom S --severity low|medium|high|critical]
  ${BIN_NAME} issue close <id|#n> --commit <sha>   resolve; AI fills root cause + fix from the diff
  ${BIN_NAME} issue import github [--repo owner/name]   needs LEDGER_GITHUB_TOKEN

  ${BIN_NAME} why <path>[:<line>|#<symbol>] [--no-ai]  timeline + linked bugs + AI answer
  ${BIN_NAME} search "<query>" [-n 10]     ranked full-text (+ semantic if enabled)
  ${BIN_NAME} show <id|#n>                 print one record
  ${BIN_NAME} reindex                      rebuild .ledger/.cache/index.db from .ledger/
  ${BIN_NAME} mcp [--root <repo>]          stdio MCP server (read-only tools)

  Query commands accept --json.`;

const row = (h: Hit): string =>
  [h.date.slice(0, 10), h.id, h.type === 'change' ? `${h.category}/${h.risk}` : `${h.external_id} ${h.status}`, h.title].join('  ');

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function main(argv: string[]): Promise<void> {
  const { values: v, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      'dry-run': { type: 'boolean' },
      force: { type: 'boolean' },
      limit: { type: 'string', short: 'n' },
      json: { type: 'boolean' },
      'no-ai': { type: 'boolean' },
      title: { type: 'string' },
      symptom: { type: 'string' },
      severity: { type: 'string' },
      commit: { type: 'string' },
      repo: { type: 'string' },
      root: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [cmd, arg, arg2] = positionals;
  if (v.help || !cmd) return console.log(HELP);

  checkLicense();
  const root = repoRoot(v.root ?? process.cwd());
  const rel = (p: string): string => relative(root, p);
  const limit = (d: number): number => Number(v.limit) || d;
  const out = (data: unknown, human: () => void): void => (v.json ? console.log(JSON.stringify(data, null, 2)) : human());
  const index = () => {
    const ix = openIndex(root);
    for (const e of ix.errors) console.error(`invalid record: ${e}`);
    return ix;
  };

  switch (cmd) {
    case 'init': {
      const created = init(root);
      console.log(created.length ? `created:\n  ${created.join('\n  ')}` : 'already initialized');
      return;
    }
    case 'record': {
      const r = await recordCommit(root, { rev: arg, dryRun: v['dry-run'], force: v.force });
      if (r.status === 'written') console.log(rel(r.path) + (r.linked.length ? `  (linked ${r.linked.join(', ')})` : ''));
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
          f.type === 'change' ? f.risk : f.severity,
          f.title,
        ])
        .sort((a, b) => (b[0] ?? '').localeCompare(a[0] ?? ''))
        .slice(0, limit(20));
      if (!rows.length) return console.log('no records');
      const table = [['DATE', 'TYPE', 'CATEGORY', 'RISK', 'TITLE'], ...rows];
      const widths = [0, 1, 2, 3].map((i) => Math.max(...table.map((r) => (r[i] ?? '').length)));
      for (const r of table) console.log(r.map((c, i) => (i < 4 ? c.padEnd(widths[i] ?? 0) : c)).join('  '));
      return;
    }
    case 'issue': {
      if (arg === 'new') {
        const interactive = process.stdin.isTTY && !v.title;
        const title = v.title ?? (interactive ? await ask('Title: ') : '');
        if (!title) throw new Error('--title is required');
        const symptom = v.symptom ?? (interactive ? await ask('Symptom: ') : '');
        const severity = v.severity ?? (interactive ? (await ask('Severity [low/medium/high/critical] (medium): ')) || 'medium' : 'medium');
        if (!(SEVERITY as readonly string[]).includes(severity)) throw new Error(`--severity must be one of ${SEVERITY.join(', ')}`);
        const r = newIssue(root, { title, symptom, severity: severity as (typeof SEVERITY)[number] });
        if (r.front.type === 'issue') console.log(`${r.front.external_id}  ${r.front.id}\n${rel(r.path)}`);
      } else if (arg === 'close') {
        if (!arg2 || !v.commit) throw new Error(`usage: ${BIN_NAME} issue close <id|#n> --commit <sha>`);
        const r = await closeIssue(root, arg2, v.commit);
        console.log(`resolved ${r.front.type === 'issue' ? r.front.external_id : ''}: ${rel(r.path)}`);
      } else if (arg === 'import' && arg2 === 'github') {
        const r = await importIssues(root, githubSource(v.repo ?? githubRepoFromRemote(root)));
        console.log(`github: ${r.created} created, ${r.updated} updated`);
      } else throw new Error(`usage: ${BIN_NAME} issue new|close|import github`);
      return;
    }
    case 'reindex': {
      const r = reindex(root);
      for (const e of r.errors) console.error(`invalid record: ${e}`);
      console.log(`indexed ${r.records} records`);
      return;
    }
    case 'why': {
      if (!arg) throw new Error(`usage: ${BIN_NAME} why <path>[:<line>|#<symbol>]`);
      const ix = index();
      try {
        const r = why(ix, await resolveTarget(root, process.cwd(), arg));
        const warnings = r.issues.map(issueWarning);
        let answer: string | undefined;
        let aiError: string | undefined;
        if (!v['no-ai'] && (r.anchored.length || r.file_level.length)) {
          try {
            answer = await explain(ix, loadConfig(root), r);
          } catch (e) {
            aiError = (e as Error).message;
          }
        }
        out({ ...r, warnings, ...(answer && { answer }), ...(aiError && { ai_error: aiError }) }, () => {
          const t = r.target;
          const label = `${t.path}${t.symbol ? `#${t.symbol}` : ''}${t.line && !t.symbol ? `:${t.line}` : ''}`;
          for (const w of warnings) console.log(w);
          if (warnings.length) console.log('');
          if (!r.anchored.length && !r.file_level.length) return console.log(`No records touch ${label} yet.`);
          console.log(`${label}: ${t.symbol ? `${r.anchored.length} anchored to the symbol, ` : ''}${r.file_level.length} file-level`);
          for (const h of r.anchored) console.log(`  ${row(h)}  [symbol]`);
          for (const h of r.file_level) console.log(`  ${row(h)}`);
          if (answer) console.log(`\n${answer.trim()}`);
          if (aiError) console.error(`\n(AI answer unavailable: ${aiError}. Use --no-ai for the timeline only.)`);
        });
      } finally {
        ix.db.close();
      }
      return;
    }
    case 'search': {
      if (!arg) throw new Error(`usage: ${BIN_NAME} search "<query>"`);
      const ix = index();
      try {
        const r = await search(ix, loadConfig(root), arg, limit(10));
        for (const w of r.warnings) console.error(w);
        out(r.hits, () => {
          if (!r.hits.length) return console.log('no matches');
          for (const h of r.hits) console.log(`${row(h)}\n    ${h.path}${h.snippet ? `\n    ${h.snippet.replace(/\s+/g, ' ')}` : ''}`);
        });
      } finally {
        ix.db.close();
      }
      return;
    }
    case 'show': {
      if (!arg) throw new Error(`usage: ${BIN_NAME} show <id|#n>`);
      const ix = index();
      const r = getRecord(ix, arg);
      ix.db.close();
      if (!r) throw new Error(`no record ${arg}`);
      out(r, () => process.stdout.write(readFileSync(join(root, r.path), 'utf8')));
      return;
    }
    case 'mcp':
      return serve(root);
    default:
      throw new Error(`unknown command "${cmd}"\n\n${HELP}`);
  }
}

main(process.argv.slice(2)).catch((e: unknown) => {
  console.error(`${BIN_NAME}: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
