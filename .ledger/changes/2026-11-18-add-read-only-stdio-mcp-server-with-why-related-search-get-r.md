---
id: chg_01M7Q1VT58DD85TCSM8CKHFCB0
type: change
title: Add read-only stdio MCP server with why/related/search/get/recent tools
commit: c3c734d
author: ikcyrils@gmail.com
date: 2026-11-18T17:50:54+08:00
category: feature
risk: low
issues: []
files: [ packages/mcp/README.md, packages/mcp/package.json, packages/mcp/src/index.ts, packages/mcp/test/mcp.test.ts, packages/mcp/tsconfig.json ]
symbols: [ brief, serve, serve.withIndex ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
Adds a new `@ledger/mcp` package that runs a read-only stdio MCP server over the repo's local ledger index. Five tools are registered on `McpServer`: `ledger_why` (history/intent behind a file or symbol), `ledger_related` (past changes/bugs touching given files), `ledger_search` (full-text search via `@ledger/core`), `ledger_get_record` (full record by id/ref), and `ledger_recent` (recent records). Results use a compact `brief` shape with record ids and `record_path` for citation. Every tool is annotated `readOnlyHint: true, openWorldHint: false`; the index is re-opened per call so new records are visible, and the DB handle is closed in a `finally`. Includes package scaffold (package.json with `@modelcontextprotocol/sdk` + zod deps), tsconfig, README with Claude Code/Cursor/VS Code setup, and an end-to-end vitest test driving a real stdio client against a seeded repo.

## Why
Not stated in the commit message beyond the subject; the README states the goal: expose the local engineering ledger (`.ledger/`) to AI coding agents (Claude Code, Cursor, VS Code Copilot) over MCP in a read-only way, so agents can consult change/issue history without the server calling an AI provider or touching the network.

## Impact / blast radius
New package only; no changes to existing packages. Blast radius is limited to: (1) repos that opt in by adding MCP client config (`ledger mcp --root <path>`); the server reads the local `.ledger/.cache/index.db` only. (2) It binds to stdout for the MCP protocol with logs on stderr — safe if the host process is run with the documented command; a malicious or misconfigured host command could read the ledger filesystem, but all five tools are read-only by design and metadata is annotated as such. (3) The test spawns `packages/cli/dist/index.js`, so the CLI must be built before tests run. No changes to core data formats, auth, or network behavior.

## Testing notes
One new test `packages/mcp/test/mcp.test.ts`: spins up a real MCP client over stdio against a seeded repo, asserts the tool list matches the expected five tools and that every tool has `readOnlyHint`, then verifies `ledger_why` flags the linked bug as a warning, `ledger_related` returns 2 changes with issue `#1`, and `ledger_get_record` returns the body containing 'thundering herd'. Worth adding: `ledger_search` and `ledger_recent` call coverage, behavior when `.ledger/` is missing, and stale-index rebuild behavior.
