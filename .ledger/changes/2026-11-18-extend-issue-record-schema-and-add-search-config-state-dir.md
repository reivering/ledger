---
id: chg_01M7Q1SGRVAHX9FTJQQA5SVWF3
type: change
title: Extend issue record schema and add search config / state dir
commit: cd58975
author: ikcyrils@gmail.com
date: 2026-11-18T17:50:54+08:00
category: feature
risk: medium
issues: []
files: [ packages/core/src/store.ts ]
symbols: [ writeRecord, readRecord, findRecord, slugify, init ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
ConfigSchema gains an optional `search` object (semantic boolean, provider enum openai|ollama|fake, model string) defaulting to `{semantic:false}`, and the generated config template documents it. IssueRecordSchema is extended: status is now constrained by exported `ISSUE_STATUS` (open|resolved|wontfix — `mitigated` removed), and new required fields severity (low|medium|high|critical), source (`/^[a-z]+$/`), external_id (raw ref like `#142` or `PROJ-142`), symbols, and related_changes (chg_ ULIDs) are added; resolved_at (optional iso datetime) and labels (default []) are new, and the old `issues` array field is removed. A shared `sha` regex const (`/^[0-9a-f]{7,40}$/`) replaces duplicated commit-sha patterns in both record schemas. New helpers `writeRecord`, `readRecord`, `findRecord` (resolves id, external ref `#142`, or bare issue number), `nowIso`, and `slugify` are exported. `init()` now creates a `state/` subdirectory for importer sync cursors, and the README template documents it.

## Why
Stated in the commit message: issues become first-class records with severity, source, external_id, symbols, related_changes and a simplified open|resolved|wontfix status lifecycle, in preparation for an issue importer (external records land with issue import, per the moved comment on the change-schema `type` field). A `state/` directory holds importer cursors (e.g. last GitHub sync) committed to the repo so the team shares them. Search config (semantic embeddings via openai/ollama/fake provider) is added alongside, presumably to support searching these richer records.

## Impact / blast radius
Breaking change to the on-disk issue record schema: existing `issues/*.md` records with `status: mitigated` or missing `severity`/`source`/`external_id`/`symbols`/`related_changes` will now fail strict RecordSchema validation during readRecords/parseRecord, so existing repos need record migration or a fallback loader. Change records are unaffected except schema code reuse. The new `search` config only changes defaults and generated config.yaml (no embedding behavior lives in this file yet). `state/` is a new tracked directory committed with `.gitkeep`; importer cursors there may contain external sync metadata. `findRecord` introduces new cross-record lookup semantics (issue external refs), no auth/money/security surface. Helper exports (nowIso, slugify, writeRecord, readRecord) widen the module's public API.

## Testing notes
No tests appear in this commit's diff (only packages/core/src/store.ts). Validation tests should be added for: the extended IssueRecordSchema (all new required fields, status enum excluding `mitigated`, source regex, sha regex for fix_commits, related_changes chg_ pattern), the search config defaults and provider enum, `findRecord` matching by id, `#N` external ref, and bare number, `slack/sanitization edge cases in `slugify`, and `init()` creating the `state/` directory. A migration test confirming old-format issue records parse or fail with a clear error would also be warranted given the breaking schema change.
