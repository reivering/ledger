---
id: chg_01M7Q2CAWTGP58P0H37JS7AGH3
type: change
title: Drop repeated section headings from model output in records and issue sections
commit: d90b6f6
author: ikcyrils@gmail.com
date: 2026-11-18T18:13:29+08:00
category: bugfix
risk: low
issues: []
files: [ packages/core/src/issues.ts, packages/core/src/record.ts, packages/core/src/store.ts, packages/core/test/record.test.ts ]
symbols: [ setSection, recordCommit, stripHeading ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
Added a `stripHeading(heading, text)` helper in `store.ts` that trims text and removes a leading markdown heading matching the section heading, case-insensitively, before section content is used. `recordCommit` in `record.ts` now passes `what_changed`, `why`, `impact`, and `testing` through `stripHeading` so the generated record does not contain a duplicated `##` heading. `setSection` in `issues.ts` applies the same normalization when rewriting or inserting an issue section. A regression test was added in `packages/core/test/record.test.ts`.

## Why
The commit message states that K2 sometimes starts `what_changed` with its own `## What changed`, which doubled the heading in the record, and that the same fix was applied in `setSection` for issue close. No issue refs were provided.

## Impact / blast radius
Callers affected are `recordCommit` for generated change records and `setSection` for issue section updates. The change normalizes only generated markdown section bodies; frontmatter, stored fields, and non-repeated content are unchanged. It reduces malformed duplicate headings in audit records and should not affect parsers that split on section headings, since it removes text that would otherwise create a confusing nested or repeated heading. No auth, data migration, money movement, or compliance-boundary behavior changes.

## Testing notes
Added `packages/core/test/record.test.ts` case: a fake provider returns `what_changed` beginning with `## What changed`, and the test asserts the written record contains `## What changed
Added h.

## Why`. The diff does not add direct unit tests for `setSection` or edge cases such as case variations, 1-6 hash prefixes, escaped heading characters, or inputs without a repeated heading; those would be reasonable follow-up tests.
