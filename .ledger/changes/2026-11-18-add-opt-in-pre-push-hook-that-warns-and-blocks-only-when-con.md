---
id: chg_01M7Q26Z7NJFGESWK9JECJ68YR
type: change
title: Add opt-in pre-push hook that warns and blocks only when configured
commit: 576eca7
author: ikcyrils@gmail.com
date: 2026-11-18T18:09:09+08:00
category: feature
risk: low
issues: []
files: [ packages/core/src/hooks.ts ]
symbols: [ scripts, installHooks, uninstallHooks, hookPaths ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
Refactored hook path handling from `hookPaths` to `hooksDir`, extracted hook script generation into `scripts(cmd, prePush)`, and added a new `pre-push` hook when `installHooks(..., { prePush: true })` is used. The pre-push script iterates git's stdin refs, computes `base..lsha` for new or updated branches, runs `${cmd} check --pre-push --range "$base..$lsha"`, warns via stderr, and sets `block=1` only when that check exits with `PRE_PUSH_BLOCK_EXIT` (3). `installHooks` now writes the generated files, preserves the foreign-hook guard across all files, and returns written paths; `uninstallHooks` also removes an installed `pre-push` hook.

## Why
Grounded in the commit message: add an opt-in pre-push hook whose normal behavior is to warn about past bugs in pushed code, while blocking the push only when `check.pre_push_fail_on` is configured and exceeded. No linked issues were provided.

## Impact / blast radius
Default `installHooks(root, command)` behavior remains post-commit/post-merge only; callers can opt in with `{ prePush: true }`. Uninstall now covers `pre-push` as well as the prior hooks. With pre-push enabled, the hook can block a `git push` only in the configured exceed case via exit code 3; any other `[REDACTED:<secret>]` error lets the push through. It affects local developer git workflow and the files under the Git hooks directory, not repository content or remote state.

## Testing notes
The diff contains no test additions or changes. New behavior to cover: opt-in installation of `pre-push`, shared post-commit/post-merge content, refusal to overwrite foreign pre-push hooks, uninstall removing `pre-push`, and push-branch base computation for new vs existing remote refs. The block path should be tested against the exact `PRE_PUSH_BLOCK_EXIT` code 3, including that warnings emit to stderr and non-blocking `[REDACTED:<secret>]` errors still allow the push.
