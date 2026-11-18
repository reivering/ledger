---
id: chg_01M7Q28NEY8F0K1S1KGEGXFJ3K
type: change
title: Add ledger check GitHub Action with a single updatable PR summary comment
commit: 5a68be8
author: ikcyrils@gmail.com
date: 2026-11-18T18:09:09+08:00
category: feature
risk: medium
issues: []
files: [ packages/action/README.md, packages/action/action.yml, packages/action/package.json, packages/action/src/index.ts, packages/action/src/main.ts, packages/action/test/action.test.ts, packages/action/tsconfig.json ]
symbols: [ summary, Env, run, run.gh, fakeGitHub, runBundle ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
Added a new `packages/action` workspace package that wraps `@ledger/core`'s `check` in a GitHub Action. It reads the pull_request event payload, diffs `base.sha..head.sha`, renders a Markdown findings table with a hidden `<!-- ledger-check -->` marker, finds any prior bot comment containing that marker (paginating through issue comments), and either PATCHes that comment or POSTs a new one. It exits non-zero only when the `fail-on` input is set and a finding meets or exceeds that severity. Also added `action.yml` metadata, a `pnpm` build script that bundles `src/main.ts` plus tree-sitter grammars into `dist/`, a README with usage/permissions, a tsconfig, and a test that runs the built bundle twice against a fake GitHub API to verify one comment is posted and then updated in place.

## Why
Commit message: 'Add GitHub Action: ledger check on PRs with one in-place summary comment.' The README and description state the intent: warn on PR diffs that touch code linked to past bugs, high-risk changes, or stale docs, reading only `.ledger/` records and the PR diff without AI calls.

## Impact / blast radius
Runs in CI on pull_request events with `contents: read` and `pull-requests: write`. It posts/edits a comment on the PR using `github-token` (defaulting to the job token), so it can read issue comments on the repo and write one comment thread. With no `fail-on` it never fails the job; with `fail-on` it can fail CI based on finding severity. It requires a full git checkout (`fetch-depth: 0`) and treats the workspace as the repo root. The bundled `dist/index.js` embeds tree-sitter grammars, so consumers must build it before publishing. Failure modes include missing token, non-OK GitHub API responses, malformed event payloads, and invalid `fail-on` values, all logged via `::error::` and exit code 1.

## Testing notes
Added `packages/action/test/action.test.ts`, which seeds a core repo, closes an issue to create a ledger record, makes a PR-style change to `src/auth.ts`, and serves a minimal fake GitHub comments API. It spawns the built `dist/index.js` twice: once with no `fail-on` expecting exit 0 and a POST of one comment, and once with `INPUT_FAIL-ON: high` expecting exit 1 and a PATCH to the same comment id. It asserts exactly one stored comment, the expected POST then PATCH call sequence, the marker + '1 finding' header, the 'previously caused #1' text, and that the repo working tree has no uncommitted `src/` changes. Build correctness of the bundle (esbuild output plus grammar/wasm copying) is exercised indirectly by executing `dist/index.js` in the test.
