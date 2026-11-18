---
id: chg_01M7Q6VMBPSEYDWRNPJBYYVKVW
type: change
title: Retry once on hallucinated record ids, then strip them in docs generation
commit: 5bfb1e6
author: ikcyrils@gmail.com
date: 2026-11-18T19:32:11+08:00
category: bugfix
risk: low
issues: []
files: [ packages/core/src/docs.ts, packages/core/test/m3.test.ts ]
symbols: [ generateBatch, generateBatch.ask, liar ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
- Removed the strict `superRefine` check from the docs schema in `generateBatch` that failed the whole build when a generated value cited ids absent from `known`.
- Imported and used `stripCitations` from `./db.js`.
- Refactored prompt construction into a `prompt` object and added an `ask` helper that calls `generate` with the schema.
- Added `badIn` to collect unknown citations via `unknownCitations`.
- Added one retry naming bad ids; if any remain, strip them from each value with `stripCitations` before returning.
- Added a test in `m3.test.ts` covering hallucinated id retry/strip behavior.

## Why
Commit message: K2 twice mutated one character of a real id and the strict check failed the whole doc build. Same policy as why answers now. The previous strict validation in docs made an off-by-one hallucinated record id fatal; retry naming the bad ids gives the provider a chance to correct, and stripping remaining unknown citations prevents a single hallucination from failing the docs build.

## Impact / blast radius
Only the docs generation path (`buildDoc` -> `generateBatch`) is affected. Behavior changes from failing the build on unknown citations to one retry followed by stripping remaining unknown citations from generated markdown. Generated docs may contain text where a hallucinated citation id was removed, e.g. 'Refresh stampede  in `src/auth.ts`'. No database, auth, security, money-movement, or compliance-sensitive data is touched; the set of valid record ids is unchanged and unknown citations are still not emitted.

## Testing notes
Added `docs: a hallucinated record id gets one retry, then is stripped instead of failing the build` in `packages/core/test/m3.test.ts`. It uses a fake `Provider` to rewrite `pitfalls` to cite `chg_01ZZZZZZZZZZZZZZZZZZZZZZZZZZ`, asserts the provider is called three times (module batch + retry + file batch), asserts the written doc contains the pitfall with the id stripped, and asserts the hallucinated id is absent. Should also test multiple hallucinated ids across values, the retry-feedback path, and that stripped output remains valid markdown/schema-conforming.
