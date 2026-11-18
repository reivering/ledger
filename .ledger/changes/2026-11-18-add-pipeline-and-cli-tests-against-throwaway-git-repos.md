---
id: chg_01M7Q1PB637PTX5V0C1XK2192D
type: change
title: Add pipeline and CLI tests against throwaway git repos
commit: bcb5c96
author: ikcyrils@gmail.com
date: 2026-11-18T17:49:16+08:00
category: chore
risk: low
issues: []
files: [ packages/cli/test/cli.test.ts, packages/core/test/fixture.ts, packages/core/test/record.test.ts ]
symbols: [ until, tempRepo, tempRepo.write, tempRepo.commit, setProvider, file ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
Added three new test files, no production code changed:
- `packages/core/test/fixture.ts`: exports an isolated `env` (strips `LEDGER_*`/`GIT_*`, points `GIT_CONFIG_GLOBAL` at `/dev/null`) and a `tempRepo()` helper that creates a `mkdtemp` git repo on `main` with a local identity, `write`/`commit`/`git` helpers, and `cleanup()`.
- `packages/core/test/record.test.ts`: vitest suite covering `init` idempotency/no-clobber, `recordCommit` writing/skipping/`--force` regeneration, front-matter shape (`chg_` id, issue refs, first-parent commit), dry-run redaction of aws_key/url/env_file with zero fetch calls, one-retry-then-fail provider handling, merge-commit diffing against first parent, skipping commits that only touch `.ledger/`, plus unit tests for `issueRefs` and `truncate`.
- `packages/cli/test/cli.test.ts`: end-to-end CLI tests invoking the built `dist/index.js` against the throwaway repos — `init`/`record`/`list` flow with a `fake` provider, `record --dry-run` without an API key printing redacted payload and exiting 0, git hooks never failing commit/merge (background failures logged to `.git/ledger-hook.log`, then a `provider: fake` config makes the hook record), hook `uninstall` removing post-commit/post-merge, and refusal to overwrite a foreign hook.

## Why
Commit message states the intent: "Add pipeline and CLI tests against throwaway git repos". No linked issues. The tests close a gap of zero coverage for the record pipeline and CLI/hook behavior by spinning up disposable git repositories and a fake provider so no network or real API keys are needed.

## Impact / blast radius
Test-only change; zero blast radius on production behavior. New suites require `git` on PATH and a prior build of the CLI (`dist/index.js` is executed directly). The env isolation (`GIT_CONFIG_GLOBAL=/dev/null`, filtering `GIT_*`) prevents developer git config (hooksPath, signing, templates) from leaking into test runs. Sample secrets used in fixtures are the public AWS documentation example (`AKIA...IOSFODNN7EXAMPLE`, shown pre-redaction only in `dry-run` output assertions) and are asserted to be redacted — no real credentials involved.

## Testing notes
Tests added: 81-line CLI integration suite (init→commit→record→list; dry-run without API key; hook resilience + uninstall; foreign-hook refusal) and 129-line core suite (init, record, collector helpers) plus shared `fixture.ts`. If re-verifying: run vitest for `packages/core/test/record.test.ts` and build the CLI then run `packages/cli/test/cli.test.ts`; ensure tests pass with and without `LEDGER_ANTHROPIC_API_KEY` set in the environment (fixture deliberately strips it).
