---
id: chg_01M7Q24E3QZ3E495C4VCTNKA3M
type: change
title: Scope why() issues to the target symbol; add listSymbols with content hashes
commit: 242254a
author: ikcyrils@gmail.com
date: 2026-11-18T18:09:08+08:00
category: feature
risk: low
issues: []
files: [ packages/core/src/db.ts, packages/core/src/symbols.ts ]
symbols: [ WhyResult, why, SymbolRange, listSymbols, listSymbols.walk ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
In `packages/core/src/db.ts`, `why()` no longer links all hits as issues when the target has a `symbol`: it now builds `issueHits` from the symbol-anchored changes plus only those `issue`-type hits whose own `symbols` match the target symbol, so a bug in one function stops warning on neighboring functions. The `WhyResult.issues` doc comment now notes the symbol scoping. In `packages/core/src/symbols.ts`, a new public `listSymbols(path, source)` returns a `SymbolRange[]` (qualified `name`, 1-based `line`/`endLine`, and a `hash` of the declaration's source text) for every declaration found by walking the tree-sitter tree, or `null` when the language is unsupported; it enforces the existing `MAX_SOURCE` guard, and frees the parsed tree and parser. A new exported `contentHash(text)` computes `sha256(text)` truncated to 16 hex chars via `node:crypto` (`createHash`).

## Why
Per the commit message: 'A bug in one function no longer warns on its neighbours' — previously `issues: linkedIssues(ix, hits)` considered every change to the file even when a specific `symbol` was the query target, so unrelated issues on neighboring declarations were surfaced as prominent warnings. 'listSymbols gives every declaration's range and hash for CodeLens and doc anchors' — clients need per-declaration line ranges plus stable content hashes to render CodeLens and to anchor documentation to specific declarations.

## Impact / blast radius
Callers of `why()` with a symbol target now see a narrowed `issues` list (only symbol-anchored changes and matching `issue` hits), reducing false-positive prominent warnings; callers without a symbol target see no behavior change. New consumers can call `listSymbols()` to enumerate declarations with line ranges and content hashes for CodeLens and doc anchors; unsupported languages yield `null`. The 16-hex-char (64-bit) truncated SHA-256 is fine for correlation/anchoring but is not collision-resistant enough for security uses, and parsing cost is bounded by the existing `MAX_SOURCE` limit. No database schema, migration, or stored-data changes.

## Testing notes
Recommended tests: (1) `why()` with a `WhyTarget` carrying a symbol returns issues only from changes whose `symbols` include that symbol, and excludes issues matched to other symbols in the same file; (2) `why()` without a symbol retains the prior all-hits issue behavior; (3) `listSymbols()` returns one `SymbolRange` per declaration with correct qualified names, 1-based `line`/`endLine`, and deterministic hashes equal to `contentHash(declarationText)`; (4) `listSymbols()` returns `null` for unsupported languages and treats oversized sources as non-parseable (returns `[]` via `tree === null` guard per current code); (5) `contentHash()` is stable, 16 hex chars, and differs for different texts. Existing `enclosingSymbols` tests should still pass since its signature is unchanged.
