---
id: chg_01M7Q1PYMVP02S2V33MP90F5Y4
type: change
title: Fix pnpm check on clean checkout by building before typechecking
commit: 05e680e
author: ikcyrils@gmail.com
date: 2026-11-18T17:49:35+08:00
category: bugfix
risk: low
issues: []
files: [ package.json, packages/cli/package.json, packages/core/package.json ]
symbols: [ typecheck, build, check, test ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
Root package.json: `typecheck` now runs `pnpm build` before `tsc -p tsconfig.json` (previously `pnpm -r typecheck`); `check` now runs `vitest run` directly instead of `pnpm test` (which already builds). The `engines` field was reformatted to multiline (no behavioral change). `packages/cli/package.json` and `packages/core/package.json`: removed the redundant `typecheck` script (`tsc -p tsconfig.json --noEmit`); kept `build` as `tsc -p tsconfig.json`, since tsc emits while typechecking.

## Why
On a clean checkout, typecheck ran before any build, so the CLI package could not resolve `@ledger/core` types (workspace dependency not yet built). Since each package's `tsc` build already performs full typechecking, the separate `--noEmit` typecheck scripts were redundant; `typecheck` now builds first, then checks the test files via the root tsconfig.

## Impact / blast radius
Developers and CI running `pnpm check` on a clean checkout get build-then-typecheck ordering, so cross-package workspace type resolution succeeds. Typechecking coverage is unchanged (emitted by the same tsc invocations); only workflow ordering and script redundancy changed. The standalone `pnpm -r typecheck` script no longer exists. No data, security, or runtime behavior impact.

## Testing notes
No test files changed. Verify by wiping build artifacts on a clean clone (`rm -rf **/dist`), reinstalling, and running `pnpm check` end-to-end; confirm `pnpm typecheck` alone also passes for test files and that `pnpm build` still emits expected output for cli and core.
