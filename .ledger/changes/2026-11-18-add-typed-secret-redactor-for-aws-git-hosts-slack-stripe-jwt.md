---
id: chg_01M7Q1J5E0AVQES8DFKSA03CQF
type: change
title: Add typed secret redactor for AWS, Git hosts, Slack, Stripe, JWT, private keys, generics
commit: 3b13ffc
author: ikcyrils@gmail.com
date: 2026-11-18T17:49:16+08:00
category: feature
risk: medium
issues: []
files: [ packages/core/src/redact.ts, packages/core/test/redact.test.ts ]
symbols: [ CustomPattern, redact ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
- Added packages/core/src/redact.ts with exported redact() and isEnvFile().
- redact() replaces known secret shapes with [REDACTED:<type>], applies caller custom patterns, then redacts KEY/SECRET/PASSWORD/TOKEN-like assignments while skipping existing markers.
- Added vitest suite splitting fixtures so fixture secrets do not trip scanners.

## Why
Commit message states the goal is to add a secret redactor with typed [REDACTED:<type>] markers, covering AWS, GitHub/GitLab, Slack, Stripe, JWTs, private key blocks, generic KEY=[REDACTED:generic_secret] assignments, and custom config patterns. No linked issues were provided.

## Impact / blast radius
No existing callers are changed in this commit, so immediate blast radius is limited to the new exported API and its tests. If adopted before text leaves the machine, it can reduce secret leakage; the name-based assignment heuristics may over-redact harmless identifiers, which the code comments and tests treat as the safe direction. It does not persist data or move money, and compliance benefit depends on integration at output boundaries.

## Testing notes
- Added packages/core/test/redact.test.ts with parameterized known-secret cases, private-key termination cases, generic assignment cases, a no-double-redact case, and a custom-pattern case.
- Should also test invalid custom regex strings, very large inputs and performance, marker round-trip stability, and invocation at every egress point before relying on this for compliance.
