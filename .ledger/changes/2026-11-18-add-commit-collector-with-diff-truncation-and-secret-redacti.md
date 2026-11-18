---
id: chg_01M7Q1K69XH29JW2R7F2DGZAQJ
type: change
title: Add commit collector with diff truncation and secret redaction
commit: ef07ff8
author: ikcyrils@gmail.com
date: 2026-11-18T17:49:16+08:00
category: feature
risk: medium
issues: []
files: [ packages/core/src/collect.ts ]
symbols: [ FileStat, Collected, issueRefs, truncate, collect ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
New module packages/core/src/collect.ts providing a commit collector. `collect(root, sha, opts)` gathers commit metadata (sha, short, author, date, parents, message), per-file numstat, and the raw patch via `git show`/`git diff`; for merge commits it diffs against the first parent. The `diff` payload is redacted and fitted to `maxChars` via `truncate()`, which skips a denylist of lockfiles/build output (`NOISE`), keeps whole files when they fit, and otherwise keeps the header plus as many hunks as fit, recording omissions in `notes`. An untruncated redacted copy (`fullDiff`) is kept for symbol verification. `issueRefs()` extracts `#123` and `PROJ-123` references while filtering false-positive tokens (UTF, SHA, ISO, RFC, TLS, HTTP, X). Environment files are stripped to a `[REDACTED:env_file]` header, other patterns go through `redact()`, and anything under `LEDGER_DIR` (`.ledger/`) is excluded from files, diff, and fullDiff.

## Why
Commit message: add a collector producing commit diff, issue refs, .env redaction and truncation; merge commits diff against the first parent (what the merge brought in); `.ledger/` is excluded so records never feed back into payloads.

## Impact / blast radius
New capability feeding commit data to an external provider. Security-relevant: secrets in messages, diffs, and env files are redacted, but effectiveness depends on caller-supplied `patterns` and the `isEnvFile` denylist; truncation is first-fit by path order with hunks silently dropped (recorded only in `notes`). `fullDiff` retains the complete redacted patch, so any missed secret pattern is fully exposed there. No other modules are touched; existing code is unaffected.

## Testing notes
No tests added in this commit. Should test: merge vs non-merge diff ranges, hunk-splitting and byte-budget accounting in `truncate` (whole file kept, header-only fits, partial hunk selection, NOISE paths), `[REDACTED:env_file]` header replacement, `.ledger/` exclusion from files/diff/fullDiff, `issueRefs` filtering of NOT_ISSUE tokens, and redaction of commit message vs diff chunks.
