---
id: chg_01M7Q1NMPH2CVDH3ETW60KJNEV
type: change
title: Add CLI entrypoint with init, record, hook, and list commands
commit: c74bdc0
author: ikcyrils@gmail.com
date: 2026-11-18T17:49:16+08:00
category: feature
risk: medium
issues: []
files: [ packages/cli/src/index.ts ]
symbols: [ main ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
New file `packages/cli/src/index.ts` implementing the `ledger` CLI. It uses `node:util` `parseArgs` to parse commands and flags (`--dry-run`, `--force`, `-n/--limit`, `-h/--help`) and delegates to `@ledger/core`:
- `init` — creates `.ledger/` in the repo root (idempotent), printing created paths or "already initialized".
- `record [<commit>]` — documents a commit (default HEAD) via `recordCommit` with `dryRun`/`force` options; prints the record path, a skip reason, or the redacted system/user prompt for dry runs.
- `hook install|uninstall` — installs/removes post-commit/post-merge hooks via `installHooks`/`uninstallHooks`, printing relative paths.
- `list [-n 20]` — reads records via `readRecords`, prints invalid-record errors to stderr, and renders a fixed-width table (DATE/TYPE/CATEGORY/RISK/TITLE) sorted by date descending.
- `checkLicense()` runs before any command; unknown commands print help; top-level `main()` catch sets exit code 1.

## Why
Commit message: "Add CLI: init, record, hook, list". The change introduces a user-facing command-line interface that exposes the existing `@ledger/core` capabilities (repo initialization, commit recording, git hook management, record listing) as subcommands. No linked issues; no further rationale stated.

## Impact / blast radius
Additive — one new file, no existing code modified. Callers: end users invoking the `ledger` binary; all behavior is delegated to `@ledger/core` functions whose contracts are unchanged. Data: reads commit records from `.ledger/` for `list`; writing record files and creating `.ledger/` happens only through pre-existing core functions (`init`, `recordCommit`). Security/compliance: `checkLicense()` gates every command; `--dry-run` guarantees nothing is sent and only the redacted payload is printed; hook installation writes executables into `.git/hooks` (background, non-blocking per HELP text) — a persistent repo mutation that users should be aware of; hook paths are computed from `process.execPath` and the CLI script URL. Failures exit with code 1 and an error message.

## Testing notes
No tests were added or changed in this commit. Recommended coverage: (1) help output when no command or `--help` is passed; (2) `init` idempotency and relative-path output; (3) `record` with default HEAD, explicit rev, `--dry-run` (assert nothing is sent and redacted prompt is printed), `--force`, and the `written`/`skipped` output branches; (4) `hook install` and `uninstall`, including the usage error for an invalid subcommand; (5) `list` table formatting, sorting, limit parsing (`-n`), empty state, and stderr reporting of invalid records; (6) error paths: unknown command, thrown usage errors, and non-zero exit code from the top-level catch.
