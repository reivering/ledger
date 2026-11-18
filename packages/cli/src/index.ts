#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  BIN_NAME, buildDoc, check, checkLicense, closeIssue, docsStatus, FINDING_SEVERITY, type FindingSeverity, getRecordQuery,
  githubRepoFromRemote, githubSource, type Hit, importIssues, init, installHooks, loadConfig, newIssue, PRE_PUSH_BLOCK_EXIT,
  PRODUCT_NAME, readRecords, recordCommit, reindex, repoRoot, searchQuery, SEVERITY, severityRank, uninstallHooks, updateDoc,
  whyQuery,
} from '@ledger/core';
import { serve } from '@ledger/mcp';
import { serveStdio } from './serve.js';

const HELP = `${PRODUCT_NAME} — local-first engineering memory

Usage:
  ${BIN_NAME} init                         create .ledger/ in this repo (idempotent)
  ${BIN_NAME} record [<commit>]            document a commit (default HEAD) [--dry-run] [--force]
  ${BIN_NAME} hook install [--pre-push] | uninstall   git hooks (never block git unless configured)
  ${BIN_NAME} list [-n 20]                 recent records

  ${BIN_NAME} issue new [--title T --symptom S --severity low|medium|high|critical]
  ${BIN_NAME} issue close <id|#n> --commit <sha>   resolve; AI fills root cause + fix from the diff
  ${BIN_NAME} issue import github [--repo owner/name]   needs LEDGER_GITHUB_TOKEN

  ${BIN_NAME} why <path>[:<line>|#<symbol>] [--no-ai]  timeline + linked bugs + AI answer
  ${BIN_NAME} search "<query>" [-n 10]     ranked full-text (+ semantic if enabled)
  ${BIN_NAME} show <id|#n>                 print one record
  ${BIN_NAME} check [--staged | --diff <file> | --range <a>..<b>] [--fail-on high|critical]
                                         past bugs / high-risk changes / stale docs in changed code
  ${BIN_NAME} docs build [module] | status | update <module>   living module docs
  ${BIN_NAME} reindex                      rebuild .ledger/.cache/index.db from .ledger/
  ${BIN_NAME} mcp [--root <repo>]          stdio MCP server (read-only tools)
  ${BIN_NAME} serve --stdio                JSON-RPC engine for editors (LSP-style framing)

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
      staged: { type: 'boolean' },
      diff: { type: 'string' },
      range: { type: 'string' },
      'fail-on': { type: 'string' },
      'pre-push': { type: 'boolean' },
      stdio: { type: 'boolean' },
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
        const paths = installHooks(root, [process.execPath, fileURLToPath(import.meta.url)], { prePush: v['pre-push'] });
        console.log(`installed:\n  ${paths.map(rel).join('\n  ')}`);
      } else if (arg === 'uninstall') {
        const paths = uninstallHooks(root);
        console.log(paths.length ? `removed:\n  ${paths.map(rel).join('\n  ')}` : 'no hooks installed');
      } else throw new Error(`usage: ${BIN_NAME} hook install [--pre-push] | uninstall`);
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
        for (const x of r.renamed) console.log(`local issue renamed to avoid a clash with GitHub: ${x}`);
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
      const r = await whyQuery(root, process.cwd(), arg, { ai: !v['no-ai'] });
      out(r, () => {
        const t = r.target;
        const label = `${t.path}${t.symbol ? `#${t.symbol}` : ''}${t.line && !t.symbol ? `:${t.line}` : ''}`;
        for (const w of r.warnings) console.log(w);
        if (r.warnings.length) console.log('');
        if (!r.anchored.length && !r.file_level.length) return console.log(`No records touch ${label} yet.`);
        console.log(`${label}: ${t.symbol ? `${r.anchored.length} anchored to the symbol, ` : ''}${r.file_level.length} file-level`);
        for (const h of r.anchored) console.log(`  ${row(h)}  [symbol]`);
        for (const h of r.file_level) console.log(`  ${row(h)}`);
        if (r.answer) console.log(`\n${r.answer.trim()}`);
        if (r.ai_error) console.error(`\n(AI answer unavailable: ${r.ai_error}. Use --no-ai for the timeline only.)`);
      });
      return;
    }
    case 'search': {
      if (!arg) throw new Error(`usage: ${BIN_NAME} search "<query>"`);
      const r = await searchQuery(root, arg, limit(10));
      for (const w of r.warnings) console.error(w);
      out(r.hits, () => {
        if (!r.hits.length) return console.log('no matches');
        for (const h of r.hits) console.log(`${row(h)}\n    ${h.path}${h.snippet ? `\n    ${h.snippet.replace(/\s+/g, ' ')}` : ''}`);
      });
      return;
    }
    case 'show': {
      if (!arg) throw new Error(`usage: ${BIN_NAME} show <id|#n>`);
      const r = await getRecordQuery(root, arg);
      if (!r) throw new Error(`no record ${arg}`);
      out(r, () => process.stdout.write(readFileSync(join(root, r.path), 'utf8')));
      return;
    }
    case 'check': {
      const threshold = v['pre-push'] ? loadConfig(root).check.pre_push_fail_on : v['fail-on'];
      if (threshold && !(FINDING_SEVERITY as readonly string[]).includes(threshold)) throw new Error(`--fail-on must be one of ${FINDING_SEVERITY.join(', ')}`);
      const findings = await check(root, { staged: v.staged, range: v.range, diff: v.diff && readFileSync(v.diff, 'utf8') });
      out(findings, () => {
        if (!findings.length) return console.log(`${BIN_NAME} check: no past bugs, high-risk changes or stale docs in the changed code`);
        for (const f of findings) console.log(`${f.severity.toUpperCase().padEnd(8)} ${f.message}${f.records.length ? `  [${f.records.join(', ')}]` : ''}`);
      });
      if (threshold && findings.some((f) => severityRank(f.severity) >= severityRank(threshold as FindingSeverity))) {
        process.exitCode = v['pre-push'] ? PRE_PUSH_BLOCK_EXIT : 1;
      }
      return;
    }
    case 'docs': {
      if (arg === 'status') {
        const s = await docsStatus(root);
        out(s, () => {
          if (!s.length) return console.log(`no docs yet — run \`${BIN_NAME} docs build <module>\``);
          for (const d of s) {
            console.log(`${d.stale ? 'STALE' : 'ok   '}  ${d.module}  ${d.path}`);
            for (const c of d.changes) console.log(`         ${c.file}#${c.symbol} ${c.change}`);
          }
        });
      } else if (arg === 'build') {
        const mods = arg2 ? [arg2] : Object.keys(loadConfig(root).docs.modules);
        if (!mods.length) throw new Error(`usage: ${BIN_NAME} docs build <module|folder> (or configure docs.modules)`);
        for (const m of mods) console.log((await buildDoc(root, m)).path);
      } else if (arg === 'update') {
        if (!arg2) throw new Error(`usage: ${BIN_NAME} docs update <module>`);
        const r = await updateDoc(root, arg2);
        console.log(r.regenerated.length ? `${r.path}: regenerated ${r.regenerated.join(', ')}` : `${r.path}: up to date`);
      } else throw new Error(`usage: ${BIN_NAME} docs build [module] | status | update <module>`);
      return;
    }
    case 'mcp':
      return serve(root);
    case 'serve':
      if (!v.stdio) throw new Error(`usage: ${BIN_NAME} serve --stdio`);
      return serveStdio(root);
    default:
      throw new Error(`unknown command "${cmd}"\n\n${HELP}`);
  }
}

main(process.argv.slice(2)).catch((e: unknown) => {
  console.error(`${BIN_NAME}: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
