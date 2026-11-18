---
id: chg_01M7Q6EQQH3XX3JN2KKVQCMAJA
type: change
title: Verify LLM citations against supplied records and cite docs as short bullets
commit: b894913
author: ikcyrils@gmail.com
date: 2026-11-18T19:24:45+08:00
category: bugfix
risk: low
issues: []
files: [ packages/core/src/db.ts, packages/core/src/docs.ts, packages/core/test/memory.test.ts ]
symbols: [ explain, explain.ask, unknownCitations, stripCitations, generateBlocks ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
explain() now builds a Set of supplied record ids, calls the provider once, extracts malformed or unknown [chg_...]/[iss_...] ids with unknownCitations(), retries once with the bad ids listed in the user prompt if any are found, and if they persist strips only those ids with stripCitations() and drops emptied brackets. Two new exports were added: unknownCitations(text, known) flags bracketed tokens starting with chg_ or iss_ that are malformed or absent from known, and stripCitations(text, bad) removes bad ids from citation brackets. In docs.ts generateBlocks() restricts the zod schema with superRefine so a docs value that cites unknown ids fails validation and goes through generate()'s retry; the system prompt now asks for short bullet points, one claim per bullet, each ending with its citation. Tests were updated to cover the hallucinated-id retry/strip path and to align importIssues expectations with a renamed field plus a local/GitHub issue-number collision test.

## Why
The commit message says the model produced ids like [chg_chg...]: explain() should retry once with the bad ids, then strip them; docs blocks should fail validation and use generate()'s retry; docs should be written as short cited bullets. The underlying intent is to stop answers and generated docs from citing records the user was not given.

## Impact / blast radius
Blast radius is limited to explain() answers and generated docs blocks. Callers may see one extra provider request on explain() when citations are bad, and docs generation may retry when validation rejects hallucinated ids; this increases latency/provider calls but does not move data or change auth. Outputs remain redacted before the provider, while the retry prompt echoes only the offending record-id strings back to the provider. A subtle edge is that docs validation only treats the first 30 record ids as known, so a valid citation to an id outside that slice would be rejected even though explain() would allow it.

## Testing notes
memory.test.ts adds a fake Provider for explain() that answers with [chg_01ZZZZZZZZZZZZZZZZZZZZZZZZ, <known issue id>] and [chg_chg]; it asserts one retry occurs, the retry prompt names both bad ids, and the final output keeps only the known id. It also changes importIssues expectations to include renamed: [] and adds a regression test where a GitHub issue with the same number as a local issue becomes the github #1, the local issue is renamed to LOCAL-2, the change link still points at the local id, and the next local issue is LOCAL-3. Not directly covered here: generateBlocks() validation failure and its generate()-retry loop, the first-30-record known-id cutoff, and stripCitations behavior for brackets left empty after removal.
