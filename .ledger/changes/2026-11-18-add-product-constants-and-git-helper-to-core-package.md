---
id: chg_01M7Q1HJS0513E8ZPYYRZPKW86
type: change
title: Add product constants and git helper to core package
commit: 29e7dfa
author: ikcyrils@gmail.com
date: 2026-11-18T17:49:16+08:00
category: chore
risk: low
issues: []
files: [ packages/core/src/git.ts, packages/core/src/product.ts ]
symbols: [ git ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
Created packages/core/src/git.ts exporting a `git(cwd, args)` wrapper around `execFileSync` (with `core.quotepath=off`, 1 GiB buffer, piped stdio) and a `repoRoot(cwd)` helper returning the trimmed `git rev-parse --show-toplevel` output. Created packages/core/src/product.ts exporting PRODUCT_NAME='Ledger', BIN_NAME='ledger', LEDGER_DIR='.ledger', INDEX_CACHE='.ledger/.cache/', and ENV_PREFIX='LEDGER_'.

## Why
Commit message states: 'Add product constants and git helper'. No linked issues or further rationale provided. The code comment notes the CLI binary name is mirrored in packages/cli/package.json's "bin" field.

## Impact / blast radius
Additive only; no existing code is modified. New shared constants will be the single source of truth for product naming, config/layout directories, and environment variable prefix, so downstream tooling can rely on consistent values. The git helper spawns child processes synchronously with a 1 GiB stdout/stderr buffer; callers must ensure cwd is a valid repository to avoid non-zero exit codes.

## Testing notes
No tests included in the commit. Should verify: `repoRoot` returns correct absolute path for a known repo; `git` propagates git stderr on failure and handles paths containing non-ASCII/quoted characters (core.quotepath=off); constants match the CLI bin name in packages/cli/package.json.
