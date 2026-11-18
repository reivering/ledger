---
id: chg_01M7Q27XEFMJK1X8CCFTHBZEJY
type: change
title: Add `ledger serve --stdio` JSON-RPC engine, plus `check` and `docs` CLI commands
commit: f62c3d5
author: ikcyrils@gmail.com
date: 2026-11-18T18:09:09+08:00
category: feature
risk: medium
issues: []
files: [ packages/cli/src/index.ts, packages/cli/src/serve.ts, packages/cli/test/cli.test.ts, packages/core/package.json, packages/core/src/rpc.ts, packages/mcp/src/index.ts ]
symbols: [ main, main.index, Params, serveStdio, Message, frame, reader, connect, connect.fail, connect.request, serve, serve.withIndex ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
- New `packages/core/src/rpc.ts`: dependency-free JSON-RPC 2.0 over LSP-style `Content-Length` framing with `frame()`, `reader()`, and a client-side `connect()`; exported via the new `@ledger/core/rpc` subpath export in `packages/core/package.json`.
- New `packages/cli/src/serve.ts`: `serveStdio(root)` runs the JSON-RPC engine on stdio (stdout = protocol, stderr = logs), exposing methods `status`, `why`, `search`, `getRecord`, `related`, `recent`, `fileSummary`, `check`, `docsStatus`, `reindex`, and `record`. It watches `.ledger/` (debounced 200ms, `.cache` ignored), calls `syncIndex`, and sends `ledger/indexChanged` notifications; exits cleanly on stdin end.
- `packages/cli/src/index.ts`: adds `check [--staged|--diff|--range|--fail-on|--pre-push]` and `docs build|status|update` commands, `serve --stdio`, and `hook install [--pre-push]`; refactors `why`/`search`/`show` onto shared core `*Query` functions and drops the local `index()` helper.
- `packages/mcp/src/index.ts`: removes its locally re-implemented `withIndex` and moves all five tools (`ledger_why`, `ledger_related`, `ledger_search`, `ledger_get_record`, `ledger_recent`) onto the shared engine query functions.

## Why
Commit message: add a JSON-RPC (LSP-framed) engine for editors via `ledger serve --stdio`; the server watches `.ledger/` (debounced) and notifies clients with `ledger/indexChanged`; the `check` and `docs` commands are added to the CLI, and the MCP server is moved onto the shared engine. No issue refs given.

## Impact / blast radius
Blast radius:
- **New protocol surface**: `serve --stdio` is a long-lived process; the `reader()` chunk handler throws on a frame without `Content-Length`, and that throw is uncaught inside the `stdin` data callback, so one malformed byte stream crashes the server — clients must rely on restart.
- **Mutation over RPC**: the `record` method invokes `recordCommit`, and `reindex` rewrites `.ledger/.cache/index.db`; a compromised or buggy editor client could write to the ledger or rewrite the index. No auth is possible over stdio by design.
- **Git-blocking path**: `check --pre-push` / configured `check.pre_push_fail_on` can set a non-zero exit that blocks `git push` (distinct `PRE_PUSH_BLOCK_EXIT`); misconfiguration or false-positive findings could halt pushes.
- **MCP behavioral parity**: searchstill needs a config-loaded provider; the refactor delegates to `searchQuery(root, ...)`, so any behavioral differences between the removed `withIndex`+config path and the engine are now the engine's behavior. Read-only hints are unchanged.
- CLI `findings` output and exit code 1 on `--fail-on` threshold makes `ledger check` usable in CI.
- Tests: spawned-server integration for `serve --stdio` (status, fileSummary, unknown-method error, indexChanged notification) and end-to-end pre-push block/warn behavior.

## Testing notes
Added in `packages/cli/test/cli.test.ts`:
1. `check --fail-on sets the exit code; the pre-push hook warns, and blocks only when configured` — records a critical issue against `src/auth.ts#refreshToken`, asserts `check --staged` prints the CRITICAL finding, asserts exit 1 with `--fail-on high`, installs the pre-push hook (push warns but succeeds), then sets `check.pre_push_fail_on: high` in config and asserts the push is blocked.
2. `serve --stdio answers JSON-RPC and notifies when .ledger/ changes` — spawns `ledger serve --stdio` with the shared `connect()` client, asserts `status` reports 1 record, `fileSummary` shows the recorded symbol with expected change/bug counts, an unknown method rejects with 'unknown method nope', and writing a new issue yields a `ledger/indexChanged` notification followed by `status` reporting 2 records.
No unit tests were added for `rpc.ts` framing/reader edge cases (split frames, missing Content-Length, oversized length, interleaved pipelined frames) — these should be covered, plus a malformed-frame crash test if the uncaught throw in `reader` is intended to remain.
