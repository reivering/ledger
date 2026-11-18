---
id: chg_01M7Q1T5WDXW6H33ZAA1MBB8JK
type: change
title: Add local SQLite index with FTS5 plus why/related/search and semantic fusion
commit: 13e061f
author: ikcyrils@gmail.com
date: 2026-11-18T17:50:54+08:00
category: feature
risk: medium
issues: []
files: [ packages/core/src/db.ts ]
symbols: [ Index, Row, openIndex, syncIndex, reindex, sync, sync.remove, findRow, getRecord, recent, touching, linkedIssues, WhyTarget, WhyResult, symbolMatches, why, related, resolveTarget, ftsQuery, cosine, search, semanticSearch, issueWarning, explain ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
New module `packages/core/src/db.ts` (318 lines) implementing a local SQLite-backed index of `.ledger/` records. Schema v1 (`SCHEMA_VERSION`): a `records` table, `record_files`/`record_symbols`/`record_issues` link tables, an FTS5 virtual table (`records_fts`, porter unicode61) with snippet support, and an `embeddings` table; the schema sets `PRAGMA user_version` to gate rebuilds. `openIndex` creates `.ledger/.cache/index.db`, deletes and recreates it (including `-wal`/`-shm` sidecars) on schema-version mismatch, enables WAL with a 5s busy timeout, then `sync()` upserts records from `.ledger/{changes,issues}` keyed by an `mtimeMs:size` stamp and deletes vanished or invalid ones inside a transaction. Query API: `getRecord`, `recent`, `why` (symbol-anchored vs file-level change hits plus linked issues), `related` (past changes/issues touching given files), `resolveTarget` (`path`, `path:line`, `path#symbol`), `search` (FTS5 BM25 ranking fused via reciprocal-rank with semantic results when `search.semantic` is on; per-model embedding cache, batch 32, redacted before embedding, brute-force cosine in JS), and `explain` (LLM answer citing record ids, records redacted before sending; limited to 15 records, bodies capped at 2000 chars).

## Why
Grounded in the commit message only: 'Add local SQLite index with FTS5, why/related/search and semantic fusion. Index lives in .ledger/.cache/index.db, syncs by mtime+size on open and rebuilds itself when missing or on schema version change.' No linked issues. Broader product intent (fast local search over .ledger/ records powering why/related/search commands) is implicit in the added API; not separately stated.

## Impact / blast radius
Blast radius: new file only (+318/-0); no existing modules or callers changed in this commit. Data/operational: introduces a local SQLite cache at `.ledger/.cache/index.db` holding rendered record contents; bumping `SCHEMA_VERSION` deletes `index.db` plus WAL/SHM sidecars and rebuilds from `.ledger/`; sync stats every record file per open (commented as fine to ~50k records). Security/compliance: record bodies are redacted via `cfg.redaction.patterns` before embedding and before `explain` LLM calls; semantic search depends on an external embedder and degrades to keyword-only results with a warning on failure; `explain` sends up to 15 records (bodies truncated at 2000 chars) to the provider. `resolveTarget` rejects targets outside the repo. The schema-version/delete path is the main data-loss hazard (only the rebuildable cache, not `.ledger/` itself).

## Testing notes
No tests added in this commit. Should cover: (1) `openIndex` rebuild on missing db and on `SCHEMA_VERSION` bump (sidecar deletion); (2) `sync` insert, update on mtime/size change, and delete for removed/renamed record files, plus error collection for unparseable records; (3) FTS5 search ranking, snippet delimiters, and empty/term-less query returning no FTS rows; (4) semantic fusion: fallback warning when the embedder throws, reciprocal-rank ordering, embedding cache miss then hit, model namespacing; (5) `why` symbol anchoring vs file-level matching via `symbolMatches`, numeric issue refs resolved with `#` prefix, linked-issue collection; (6) `related` dedupe across multiple files with `matched_files` accumulation and date-descending sort; (7) `resolveTarget` parsing of `path`, `path:line` (enclosing symbol via `enclosingSymbols`), `path#symbol`, absolute path handling, and outside-repo rejection; (8) `explain` empty-records short-circuit and redaction of the user payload.
