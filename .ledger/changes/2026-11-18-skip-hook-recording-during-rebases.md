---
id: chg_01M7Q1QHGQ45VXPG8SKJFQKDB5
type: change
title: Skip hook recording during rebases
commit: c3c9524
author: ikcyrils@gmail.com
date: 2026-11-18T17:50:02+08:00
category: bugfix
risk: low
issues: []
files: [ packages/cli/test/cli.test.ts, packages/core/src/hooks.ts ]
symbols: [ installHooks ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
The generated `post-commit` hook script (built by `installHooks` in `packages/core/src/hooks.ts`) now exits early with no-op when either `$(git rev-parse --git-dir)/rebase-merge` or `/rebase-apply` exists, so replayed commits aren't recorded as fresh changes. A regression test in `packages/cli/test/cli.test.ts` creates two feature commits, rebases them onto main, waits 2s for any stray hook runs, and asserts the change count stays at 3.

## Why
Git runs `post-commit` for every replayed commit during a rebase, so rebasing N commits wrote N duplicate change records with new SHAs. Stated in the commit message.

## Impact / blast radius
Callers of the installed `post-commit` hook see no duplicate records during rebase (linear, interactive, or `am`-based via `rebase-apply`). Change records' SHA uniqueness is preserved; no data migration needed because new dedup-free runs are prevented at the source. Uninstall and foreign-hook detection behavior are untouched. Minor residual risk: `rebase-merge`/`rebase-apply` detection relies on git internals; concurrent non-rebase commits during a rebase are also skipped (acceptable, matching prior rebase behavior).

## Testing notes
Added `cli.test.ts` test 'a rebase does not record replayed commits': two feature commits on a branch are rebased onto main, then after a 2s grace period the changes list must still contain exactly the 3 original commits. Validated against both rebase modes covered by the two `-d` checks (merge-file vs apply).
