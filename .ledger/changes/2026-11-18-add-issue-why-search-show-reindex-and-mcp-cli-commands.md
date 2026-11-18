---
id: chg_01M7Q1WCWYBPTRERR10CDGHAM8
type: change
title: Add issue, why, search, show, reindex, and mcp CLI commands
commit: e40c497
author: ikcyrils@gmail.com
date: 2026-11-18T17:50:54+08:00
category: feature
risk: medium
issues: []
files: [ eslint.config.js, packages/cli/package.json, packages/cli/src/index.ts, packages/cli/test/cli.test.ts ]
symbols: [ row, ask, main, main.index ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
Extended the CLI from init/record/hook/list to also support: `issue new|close|import github` (backed by newIssue/closeIssue/importIssues from @ledger/core, with interactive prompts via readline and severity validation against SEVERITY), `why <path>[:<line>|#<symbol>]` (timeline of anchored/file-level hits plus optional AI answer via explain, suppressible with --no-ai), `search "<query>"` (ranked hits with snippets), `show <id|#n>` (raw record output), `reindex` (rebuild .ledger/.cache/index.db), and `mcp` (stdio MCP server via serve from the new @ledger/mcp dependency). Added --json and --root global options, refactored argument option names (values → v), shared index() helper that surfaces invalid-record errors, and a row() formatter for hits. eslint.config.js now disables @typescript-eslint/no-non-null-assertion for **/test/** files; packages/cli/package.json adds "@ledger/mcp": "workspace:*".

## Why
Commit message states the intent directly: "Add issue, why, search, show, reindex and mcp CLI commands." No linked issues or further rationale were provided.

## Impact / blast radius
Adds six new CLI subcommands to the primary user entry point, expanding the public surface of @ledger/core and introducing @ledger/mcp as a new workspace dependency. `mcp` exposes repository records over stdio MCP (described as read-only tools), so consumers/servers gain a new data-access path. `issue import github` requires LEDGER_GITHUB_TOKEN and reads remote issue data. `why` invokes an AI provider (explain) unless --no-ai is passed, and failures degrade gracefully with ai_error output. Invalid records in .ledger/ are now printed to stderr by the index() helper during why/search/show. Existing commands keep prior behavior except `list` has no forced default limit and `record` prints linked issues. License enforcement (checkLicense) still runs before command dispatch for all commands.

## Testing notes
Added one integration test in packages/cli/test/cli.test.ts: 'issue new → fix commit → why/search/show (--json), with --no-ai and the fake provider' — it inits a repo with the fake provider, creates issue #1, records a linked fix commit, asserts the '(linked #1)' record output, the warning header and fake AI answer in `why` output, JSON shape of `why --no-ai` (anchored length 1, no answer), `search` hitting external_id #1, `show` rendering the symptom, `issue close` resolving #1, and the resolved warning format on a follow-up `why`. No existing tests were modified. Manual coverage not present in-repo: `reindex`, `mcp`, `issue import github`, interactive TTY prompts, and non-interactive (stdin non-TTY, missing --title) error paths.
