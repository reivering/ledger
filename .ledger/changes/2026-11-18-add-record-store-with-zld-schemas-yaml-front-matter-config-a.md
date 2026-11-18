---
id: chg_01M7Q1JQPWVRB60PEJS1B16EW5
type: change
title: Add record store with ZLD schemas, YAML front-matter, config, and idempotent init
commit: 776fd23
author: ikcyrils@gmail.com
date: 2026-11-18T17:49:16+08:00
category: feature
risk: low
issues: []
files: [ packages/core/src/store.ts ]
symbols: [ validRegex, ulid, serializeRecord, parseRecord, StoredRecord, readRecords, loadConfig, init ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
Added `packages/core/src/store.ts`, a file-backed record store for the ledger directory. It defines strict Zod schemas for configuration, change records, issue records, and their discriminated union; validates and parses YAML front-matter; provides a ULID generator, Markdown serializer/parser, and strict bulk record reader that reports invalid files instead of skipping them. It also supplies config loading with helpful errors and an idempotent `init` routine that creates `changes/`, `issues/`, `docs/`, `config.yaml`, `README.md`, and a `.gitignore` cache entry without overwriting existing files.

## Why
The commit message states the change adds a record store consisting of Zod schemas, YAML front-matter support, configuration handling, and idempotent initialization. No linked issues were provided.

## Impact / blast radius
This is a new core module, so it does not alter existing runtime behavior or callers yet. Its future blast radius includes config provisioning, commit/issue recording, provider selection, redaction setup, and local search indexing. `init` writes only the ledger directory and appends one cache path to `.gitignore`; it never overwrites existing files. `readRecords` validates every record and surfaces parsing or schema errors, and `loadConfig` refuses to run without valid configuration. The committed template documents that API keys must remain environment-only, while `redaction.patterns` provides future controls for provider-bound secrets.

## Testing notes
No tests were included in this commit. Recommended coverage includes config schema validation and error formatting; config loading for missing, malformed, and valid files; ULID length, character set, timestamp ordering, and uniqueness; YAML serialization and parsing round trips for both record types; discriminating invalid change/issue records; `readRecords` behavior for missing directories, valid files, invalid files, and deterministic ordering; and `init` idempotency across fresh and previously initialized roots, including preserving existing `config.yaml`, `README.md`, directories, and `.gitignore` entries.
