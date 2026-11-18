---
id: chg_01M7Q6M7RZPHFFNPTF8AHHZKA9
type: change
title: Batch module doc generation into smaller provider calls and fail loudly on output-token cutoffs
commit: 9e0a94b
author: ikcyrils@gmail.com
date: 2026-11-18T19:28:11+08:00
category: bugfix
risk: low
issues: []
files: [ packages/core/src/docs.ts, packages/core/src/providers.ts, packages/core/test/m3.test.ts ]
symbols: [ generateBlocks, generateBatch, getProvider ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
Split module-block generation into generateBlocks (orchestrates batches) and generateBatch (single call). Non-file keys are requested in one call; file keys are requested in chunks of FILES_PER_CALL = 4. Anthropic and OpenAI adapters now throw a clear error when the response indicates the model stopped because of its output token limit.

## Why
A 13-file module previously asked for every block in one JSON answer, so the model cut off the string mid-way and produced an 'Unterminated string' failure. Separating module sections and file blocks into smaller calls keeps each JSON answer inside the model output limit, while provider-specific stop/finish signals make remaining cutoffs explicit.

## Impact / blast radius
buildDoc callers should still receive the same merged Record<string, string>, but a module with many files now uses more provider calls: one for overview/decisions/pitfalls and one batch for every 4 file keys. A cutoff that used to surface as broken JSON should now surface as a clear provider error, making failures easier to diagnose without changing doc schema or stored data.

## Testing notes
Added a Vitest case in m3.test.ts that writes five functions to src, commits, instruments the Provider to capture requested keys, and asserts buildDoc asks for ['overview','decisions','pitfalls'], then ['file:src/a.ts','file:src/auth.ts','file:src/b.ts','file:src/c.ts'], then ['file:src/d.ts','file:src/e.ts']. Existing living-docs tests continue to run updateDoc/buildDoc expectations.
