---
id: chg_01M7Q29EYB5F46Y3CQ25V7SV8K
type: change
title: "Add VS Code extension: CodeLens, hover, repeat-bug warnings, timeline"
commit: d26c94c
author: ikcyrils@gmail.com
date: 2026-11-18T18:09:09+08:00
category: feature
risk: low
issues: []
files: [ .gitignore, eslint.config.js, package.json, packages/vscode/.vscodeignore, packages/vscode/README.md, packages/vscode/media/ledger.svg, packages/vscode/package.json, packages/vscode/src/extension.ts, packages/vscode/test/run.mjs, packages/vscode/test/suite.cjs, packages/vscode/tsconfig.json, pnpm-lock.yaml ]
symbols: [ State, Summary, Engine, Engine.start, Engine.fail, Engine.restart, Engine.stop, Engine.set, Engine.request, activate, activate.summaryFor, activate.innermost, activate.provideCodeLenses, activate.provideHover, activate.refreshWarnings, activate.getChildren, activate.getTreeItem, activate.refreshAll, activate.showWhy, activate.openRecordPick, activate.cmd, until ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
- New `packages/vscode` extension (`ledger-vscode`, private, UNLICENSED) contributing: a Ledger activity-bar container with `ledger.timeline` tree, commands (`ledger.why`, `ledger.search`, `ledger.recordLastCommit`, `ledger.openRecord`, `ledger.reindex`, `ledger.restartEngine`, `ledger.filter`), and settings `ledger.codeLens.enabled`, `ledger.hover.enabled`, `ledger.warnings.enabled`, `ledger.path`. Activation gated on `workspaceContains:.ledger/config.yaml`.
- `src/extension.ts`: `Engine` class spawns `ledger serve --stdio` (a `.js` path runs under `node` from PATH), owns the `@ledger/core/rpc` connection, and restarts on unexpected exit with fixed backoff (1s x1 ... 5s) up to 5 times; `restart()` resets the counter and `stop()` kills it on deactivation. `activate` wires: per-document `fileSummary` cache keyed by version; CodeLens over symbols with `N changes · M bug · Why?`; hover with issues and records; repeat-bug diagnostics tracking edited symbol names with 250ms debounce and a "Show issue" QuickFix opening the issue file; a filterable timeline plus stale-module docs section; commands routing through `cmd()` with error-message wrapping.
- Repo wiring: root `package.json` gains `package` (vsce) and `test:vscode` scripts plus `esbuild` devDependency; `eslint.config.js` ignores `.ledger/**` and adds a CJS/MJS harness block (globals `process/console/setTimeout/require/exports`, relaxed `no-require-imports`); `.gitignore` adds `.ledger/.cache/`, `packages/vscode/ledger.vsix`, `packages/action/grammars/`.
- Packaging files: `packages/vscode/package.json` (tsc + esbuild to `dist/extension.cjs`, external `vscode`), `tsconfig.json`, `.vscodeignore`, `README.md`, `media/ledger.svg`, `test/run.mjs` (fixture repo builder + VS Code launcher) and `test/suite.cjs` (in-extension-host assertions).
- `pnpm-lock.yaml` regenerated for the new workspace package and its dev deps.

## Why
Commit message: 'Add VS Code extension: CodeLens, hover, repeat-bug warnings, timeline. Spawns ledger serve --stdio and restarts it if it dies; loads no native modules. Integration test runs real VS Code against a fixture repo.' The README states the intent: show the repository's engineering memory (`.ledger/`) where you work, and warn before a past bug repeats; it works in VS Code and forks via the `.vsix`. No linked issues; the runtime design note (no native modules, engine restart on death) is stated in the commit message and in the `Engine` class docstring/comments.

## Impact / blast radius
- Callers: no pre-existing code paths are modified; blast radius is limited to the new `packages/vscode` package, the two new root scripts (`package`, `test:vscode`), updated eslint config, and anyone consuming the generated `.vsix` or building in a repo with a `.ledger/` dir.
- Runtime: a user-configured binary (`ledger.path`, default `ledger` on PATH; `.js` paths are spawned with `node`) runs per-workspace-folder as `ledger serve --stdio`; the extension restarts it up to 5 times with 1-5s backoff after unexpected exit and exposes status via a status-bar item. Auto-restart means a crashing engine will be re-spawned without user action.
- Security/data: the extension reads workspace files and sends open document text to the engine via RPC (`fileSummary`), and writes only editor-side artifacts (diagnostics, hovers, QuickFixes, markdown previews). No network calls, auth, telemetry, or persistent state of its own. Executing a configurable binary path is the main attack surface; it is mitigated by `engines.vscode ^1.95`, activation gating on `.ledger/config.yaml`, and never inlining native modules. Fixture tests set `GIT_CONFIG_GLOBAL=/dev/null` and strip `LEDGER_*`/`GIT_*` env vars.
- Compliance/licensing: extension manifest is `"private": true`/`"license": "UNLICENSED"` with `vsce package --no-dependencies`; lockfile updated with `@vscode/test-electron`, `@vscode/vsce`, `@types/vscode`. ESLint now covers `.mjs`/`.cjs` test files with Node globals.

## Testing notes
Added end-to-end coverage: `test/run.mjs` constructs a temp git repo (git init, `ledger init` with `provider: fake`, commits, `ledger record`, issue #1 created and closed against `refreshToken`) and launches real VS Code via `@vscode/test-electron` (system Electron honored on Arch; `VSCODE_EXECUTABLE` override; flags `--disable-extensions --disable-workspace-trust`, isolated user/extensions dirs); `extensionTestsEnv` passes `LEDGER_FIXTURE`/`LEDGER_CLI`.
`test/suite.cjs` asserts: engine reaches `ready` within 30s with a record-count status; CodeLens for `refreshToken` equals exactly '2 changes · 1 bug · Why?' and matches `ledger why --json --no-ai`; hover contains the resolved issue title with date; editing `refreshToken` produces exactly one ledger Warning diagnostic carrying root cause plus a 'Show issue #1' QuickFix that opens the issue file; editing a symbol with no bug adds no diagnostic; timeline returns >= 3 items; SIGKILLing the engine yields `error` state then auto-restart with a different PID. Root `check` script does not include the vscode suite (network download + editor launch), so it is opt-in; not covered: unit-level tests of `Engine` backoff logic absent a real VS Code host, and `vsce package` output verification.
