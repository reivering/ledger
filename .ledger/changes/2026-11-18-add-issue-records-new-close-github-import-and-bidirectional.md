---
id: chg_01M7Q1VB3WQCTDM0MXKBBF04DA
type: change
title: "Add issue records: new, close, GitHub import, and bidirectional auto-linking"
commit: 357f763
author: ikcyrils@gmail.com
date: 2026-11-18T17:50:54+08:00
category: feature
risk: medium
issues: []
files: [ packages/core/src/collect.ts, packages/core/src/index.ts, packages/core/src/issues.ts, packages/core/src/record.ts, packages/core/test/fixture.ts, packages/core/test/fixtures/github/events-7.json, packages/core/test/fixtures/github/events-9.json, packages/core/test/fixtures/github/issues-incremental.json, packages/core/test/fixtures/github/issues-page1.json, packages/core/test/memory.test.ts ]
symbols: [ Collected, collect, Severity, Status, addSha, setSection, getSection, issueBody, linkIssue, linkChange, nextLocalNumber, newIssue, closeIssue, ImportedIssue, IssueSource, severityFromLabels, importIssues, GhIssue, githubRepoFromRemote, githubSource, githubSource.gh, githubSource.pull, buildPrompt, RecordResult, recordCommit, extractJson, generate, slugify, seededRepo ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
## New
- `issues.ts`: issue record lifecycle — `newIssue` (local `#N` records under `.ledger/issues/`), `closeIssue` (resolves an issue, AI-fills 'Root cause'/'Fix' sections from the fix commit's collected diff), `importIssues` (incremental, additive tracker import with per-source state `.ledger/state/<name>.json` and `since=` pagination), `githubSource`/`githubRepoFromRemote` (GitHub issues API; `closed` events yield `fix_commits`, PRs filtered out, `state_reason=not_planned` maps to `wontfix`, labels map to severity).
- Shared record-format helpers `setSection`/`getSection`/`issueBody`; exported `IssueSource`/`ImportedIssue` interfaces.

## Changed
- `recordCommit`: 'fix #N' commit refs resolve to issue records and are linked both ways — change → issue (`issues: [issueId]`) and issue → change (`fix_commits`, `related_changes`, `files`, `symbols` via `linkIssue`); result gains `linked: string[]`.
- `buildPrompt` accepts an issue-title map so the 'Issue refs' line shows titled, redacted titles.
- `collect` returns `base` (first parent) and raw-diff `lines` (per-file added/removed line numbers computed before redaction, which can collapse multi-line secrets).
- `record.ts`: removed local `generate`/`extractJson` (now imported from `providers.js`); prompt requests native JSON (`json: true`); writes go through `writeRecord` and call `syncIndex`.
- `index.ts` re-exports `symbols.js`, `issues.js`, `db.js`.

## Why
Commit message: 'Add issue records: new, close (AI root cause), GitHub import, auto-link — record links fix #N commits both ways and anchors symbols with tree-sitter; import is incremental, additive and keeps local edits.' Test suite ('issues ↔ changes', 'github import (recorded fixtures, no network)') confirms bidirectional linking and additive incremental sync that preserves hand edits. No linked issues.

## Impact / blast radius
Blast radius:
- `RecordResult` gains a `linked` field — any consumer of `recordCommit` (CLI/UI) sees a shape change.
- Change records now store issue *ids* instead of raw '#N' refs in `issues` (rewritten by `linkChange`); consumers must resolve ids to display external refs.
- `collect` output gains `base` and `lines`; `lines` drives tree-sitter `anchorSymbols` verification used by both `recordCommit` and `closeIssue` (fallback: keep AI symbols that appear in the redacted full diff).
- New side effects: `syncIndex` after every record/issue write; `closeIssue` invokes the AI provider and shells git; `importIssues` reads the `GITHUB_TOKEN` env var and paginates the GitHub REST API (60s per-request timeout, throws on non-OK responses).
- Data safety: import is additive (never deletes records, merges tracker-owned fields only, preserves local body edits); imported issue bodies pass through redaction (fixture contains a redacted Stripe key).

## Testing notes
Added `memory.test.ts` (+134): bidirectional 'fix #1' linking anchored to parsed `refreshToken` symbol; `closeIssue` status/root-cause/fix population via fake provider; transparent index rebuild when `.ledger/.cache` is deleted and pick-up of hand edits; search snippet ('«thundering»') and semantic-search fusion; recorded-fixture GitHub import asserting pagination, `since=2026-10-02T09%3A00%3A00Z` on incremental sync, events→fix_commits mapping (incl. null commit_id), wontfix mapping, redaction of `[REDACTED:stripe_key]`, linking of a pre-import change referencing '#7', created/updated counts, and local-edit preservation. New fixtures: `issues-page1.json`, `issues-incremental.json`, `events-7.json`, `events-9.json`; `fixture.ts` adds `AUTH_V1`/`AUTH_V2` and a `seededRepo()` harness. Worth adding: merge-commit `base` handling, line-number drift when redaction collapses lines, and GitHub 403/rate-limit error paths.
