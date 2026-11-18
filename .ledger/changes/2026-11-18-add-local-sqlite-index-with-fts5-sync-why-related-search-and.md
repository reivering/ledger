---
id: chg_01M7Q1T5WDXW6H33ZAA1MBB8JK
type: change
title: Add local SQLite index with FTS5, sync, why/related/search and semantic fusion
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
## What changed

New module `packages/core/src/db.ts` implementing a local SQLite index for the `.ledger/` store:

- **Storage**: index lives at `.ledger/.cache/index.db` (WAL mode, 5s busy timeout). Schema version 1; on mismatch, the db/wal/shm files are deleted and rebuilt. `openIndex` creates the cache dir, applies the schema, and **syncs by mtime+size stamp** on open; `reindex` forces a full rebuild and reports record/error counts.
- **Schema**: `records` (front-matter flattened: type/title/category/risk/status/severity/external_id/date/commit), `record_files` (path `TEXT` including directory prefix), `record_symbols`, `record_issues`, FTS5 virtual table `records_fts` (porter tokenizer, body+title), and `embeddings` (per-model `BLOB` vectors).
- **Sync semantics**: `sync` stats every `.md` file under `changes/` and `issues/`, skips unchanged mtimes/sizes, removes stale rows (deleted files), and wraps per-file parsing in try/catch — invalid records are reported in `errors` and excluded from the index, and all re-indexing runs in a transaction with rollback on failure.
- **Queries**: `getRecord`, `recent`, `touching` (file or directory via `substr` prefix), `linkedIssues` (issue records plus issues referenced from changes), `why` (changes anchored to a symbol vs. file-level matches with `match` flags), `related` (changes/issues touching any of a file list, with `matched_files`), and `resolveTarget` (`path`, `path:line` resolving the line to its enclosing symbol via `enclosingSymbols`, `path#symbol`).
- **Search**: `search` runs FTS5 with BM25 ranking plus snippet generation; when `cfg.search.semantic` is enabled it adds a semantic channel: missing embeddings are computed in batches of 32 via `getEmbedder`, with `redact` applied and input truncated to 8000 chars before provider calls, vectors cached in the `embeddings` table, and results fused by reciprocal-rank (1/(60+rank)) with keyword hits. A provider failure degrades gracefully to keyword results with a warning. Embeddings are redacted before being sent to the provider.
- **Explain**: `explain` builds a why-answer via `getProvider(cfg)` from issues + anchored + file-level records, redacting the prompt.

## Why
From the commit message: the index lives in `.ledger/.cache/index.db`, syncs by mtime+size on open, and rebuilds itself when missing or on schema version change. The search function fuses FTS5 keyword results with semantic embeddings when `search.semantic` is on; the why/related/explain queries give an engineer context about why code is the way it is before changing it. No issue refs or further intent stated in the record.

## Impact / blast radius
- **Blast radius**: new file only (`packages/core/src/db.ts`, 0 lines removed); no existing modules modified, and nothing in this commit wires it into the CLI, so there are no prior callers to break.
- **Data effects**: writes a new cache artifact `.ledger/.cache/index.db[-wal,-shm]`; source records in `.ledger/` are only read, never mutated. Corrupt or outdated index files are deleted/rebuilt automatically on version change. A schema version bump requires deleting the old index (documented by `SCHEMA_VERSION`).
- **Security/compliance**: record content crosses the provider boundary in `semanticSearch` and `explain` only after `redact()` is applied; embedding inputs are truncated to 8000 chars. Provider errors are caught and degrade to keyword-only results. Embeddings for arbitrary provider models are cached, so changing `search.provider`/`search.model` invalidates prior cache entries by storing the model in the row key.
- **Resource notes** (documented in code): full directory stats per open (~50k record ceiling), brute-force JS cosine over all embeddings per query (switch noted to sqlite-vec past ~100k records).

## Testing notes
No tests were added or changed in this commit. The following should be covered:
- `openIndex`/`sync` incremental sync: touched file (mtime/size change) re-indexed; unchanged file skipped; deleted file removed from all six tables.
- Schema-version bump triggers file deletion and clean rebuild; `reindex` returns correct record/error counts.
- Malformed record file yields an entry in `errors` without aborting sync or partial rows.
- `why`: anchored vs. file-level classification, `symbolMatches` prefix/suffix/middle matching, linked-issue resolution (including `#NNN` external_id normalization).
- `resolveTarget`: relative/absolute paths, `path:line`, `path#symbol`, and rejection of paths outside the repo.
- `search` FTS5 behavior (multi-term OR, empty-query null), top-N trimming, RRF fusion ordering, and the `semantic` off path.
- `semanticSearch`: batching of pending embeddings, caching (second call issues no provider embed calls), and provider failure appending the warning while returning keyword hits.
- Redaction applied to embedding and prompt payloads; line-resolution via `enclosingSymbols` for `path:line` targets.
