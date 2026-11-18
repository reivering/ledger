---
id: chg_01M7Q267AD1QQF4C6RZ5N9F136
type: change
title: Add shared engine + ledger check for repeat bugs, high-risk changes, stale docs
commit: 4d7e9da
author: ikcyrils@gmail.com
date: 2026-11-18T18:09:09+08:00
category: feature
risk: low
issues: []
files: [ packages/core/src/engine.ts, packages/core/src/index.ts, packages/core/test/m3.test.ts ]
symbols: [ withIndex, whyQuery, searchQuery, IssueBrief, issueBrief, SymbolSummary, fileSummary, Finding, CheckOptions, show, check, checkLicense, resolvedRepo ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
- New `packages/core/src/engine.ts` (~201 lines): a single engine behind the CLI, MCP server and `ledger serve` (VS Code). Exports `withIndex` (opens/syncs/closes the index per call so callers never see stale records), `whyQuery` (resolves `path`, `path:line` or `path#symbol`, returns `why` results with `issueWarning` strings and an optional AI `explain` answer that captures failures into `ai_error`), and thin `withIndex` wrappers `searchQuery`, `getRecordQuery`, `relatedQuery`, `recentQuery`.
- New `fileSummary(root, path, text?)` returns per-symbol `SymbolSummary` (line range, anchored change count, bug count, newest 3 record refs, full `IssueBrief`s) for CodeLens/hover/diagnostics; `IssueBrief.root_cause` strips the `_Unknown…_` placeholder.
- New `check(root, {staged|diff|range})` finding engine: obtains a git diff (`--range a..b`, `--staged` vs HEAD, or explicit/full `diff` text), maps added/removed lines to enclosing symbols per file via `changedLines` + `enclosingSymbols` (falling back to file-level when a language is unsupported), and emits deduped, severity-sorted `Finding`s of kind `repeat-bug` (symbol previously caused an issue, with status/date and first root-cause line), `high-risk-change` (prior high-risk change touched the symbol, severity medium), and `stale-doc` (from `docsStatus`, severity info, pointing at `ledger docs update`). Findings are keyed to remove duplicates and sorted with `severityRank` over `FINDING_SEVERITY = ['info', ...SEVERITY]`.
- `packages/core/src/index.ts`: exports `./engine.js` and `./docs.js`; license comment updated from "no-op until Milestone 3" to "no-op until licensing is built" (scope clarified, still a no-op `checkLicense`).
- New `packages/core/test/m3.test.ts` (79 lines) covering check staging/range/diff behavior, fileSummary-vs-why consistency, and the living-docs build/edit/stale/update lifecycle.

## Why
Commit message: "One engine (withIndex + queries + fileSummary + check) behind the CLI, MCP server and editor. check maps changed lines to symbols for --staged, --diff and --range." The change consolidates the previously scattered query/index/file-summary/check logic into one module so the three front-ends share identical behavior, and adds the `check` pass that links current edits to historical bugs, risky prior changes, and stale documentation. No linked issues.

## Impact / blast radius
Blast radius: additive-only. New module consumed by the CLI, MCP server and VS Code (`ledger serve`); existing exports in `index.ts` are re-exported, `checkLicense` remains a no-op. Read-only at runtime: opens the ledger index (syncing `.ledger/` reads), runs read-only `git show`/`git diff` commands, and reads worktree files; no user data, credentials, or license paths are mutated. Security surface is minimal — the only failure capture is converting AI explanation throw into `answer.ai_error`, and unreadable `git show` specs degrade to empty strings. Correctness of `check` findings depends on `changedLines`/`enclosingSymbols` mapping, so mis-mapped hunks could surface false repeat-bug or high-risk-change findings to users; dedup keys and severity ordering bound noisy duplicates.

## Testing notes
Added `packages/core/test/m3.test.ts` which builds a seeded repo (`seededRepo` fixture), resolves issue #1 via `closeIssue`, and asserts: (1) `check(r.dir, {staged:true})` reports exactly one `repeat-bug` finding at `src/auth.ts#refreshToken` with the expected message format (`previously caused #1 (resolved <date>): Login times out under load. Root cause: Fake root cause`) and reports nothing for an unrelated staged edit; (2) `--diff` and `--range HEAD~1..HEAD` map changed lines to the same symbol; (3) `fileSummary` per-symbol change/bug counts equal `whyQuery` anchored/issue counts and include issue briefs with `root_cause`; (4) living-docs flow: `buildDoc` anchors/structure, manual human edits preserve `stale:false`, code edit makes docs stale and adds a `stale-doc` check finding, and `updateDoc` regenerates sections while keeping human text and reporting `regenerated: []` on a second run. Not yet covered by these tests and worth adding: unsupported-language file-level fallback, finding dedup across hunks/symbols, severity sort ordering, empty/invalid `--range` error, and `whyQuery` with `ai:true` covering the `ai_error` path.
