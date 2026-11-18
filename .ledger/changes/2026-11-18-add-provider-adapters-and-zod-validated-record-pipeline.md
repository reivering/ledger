---
id: chg_01M7Q1M3BHDMYMY4KRSCY3ENX0
type: change
title: Add provider adapters and Zod-validated record pipeline
commit: 6577c6b
author: ikcyrils@gmail.com
date: 2026-11-18T17:49:16+08:00
category: feature
risk: medium
issues: []
files: [ packages/core/src/providers.ts, packages/core/src/record.ts ]
symbols: [ Prompt, apiKey, post, fakeProvider, getProvider, writerSchema, buildPrompt, extractJson, generate, slugify, RecordOptions, RecordResult, recordCommit ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
Adds packages/core/src/providers.ts with Prompt and Provider types, an internal apiKey helper that reads ENV_PREFIX + name + _API_KEY and throws when missing, a 120s fetch wrapper called post, fakeProvider for offline records, and getProvider selecting anthropic/openai/ollama/fake adapters with model and base_url override support. Adds packages/core/src/record.ts with writerSchema built from allowed categories and RISKS, buildPrompt producing the JSON-only audit instructions plus commit/files/diff context, extractJson for locating an object in model output, generate validating with Zod and retrying once with the prior validation error, slugify for record filenames, and recordCommit wiring loadConfig, git rev-parse, duplicate detection via readRecords, collect with redaction limits, dry-run output, symbol filtering to names present in the full diff, front-matter validation through ChangeRecordSchema, filename collision handling, and writeFileSync of the serialized change record.

## Why
Grounded in the commit message: the stated purpose is to add provider adapters for Anthropic, OpenAI, Ollama, and fake, plus a record pipeline; the writer must ask for JSON, validate with Zod, and retry once using the validation error.

## Impact / blast radius
Introduces new core entry points and types that other commands or hooks can call, so the blast radius includes the whole record pipeline rather than a single bugfix. Security and compliance effects are notable: prompts embed commit messages, file stats, and redacted diffs and are sent to external LLM endpoints, with provider/model/base_url configuration and timeout behavior; API keys come from environment variables and missing keys fail before network use. Ollama defaults to localhost over HTTP, while Anthropic and OpenAI use default HTTPS hosts unless overridden. Data effects are limited to reading git metadata and writing records under LEDGER_DIR; duplicate records are skipped unless forced, and commits with no files outside LEDGER_DIR are skipped to avoid hook feedback loops. LLM output is still untrusted until parsed and schema-validated, and this diff adds no tests.

## Testing notes
No tests were added or changed in the diff. Recommended coverage: assert fakeProvider returns schema-shaped output and uses the first configured category; assert getProvider throws for each provider when the required _API_KEY is absent and otherwise builds prompts with model/base overrides; test post timeout and non-OK response error truncation; test extractJson on plain JSON, fenced JSON, and malformed text; test generate returns parsed data on first success, appends the validation error and retries after invalid output, and throws after two failures; test recordCommit skips already-recorded SHAs unless forced, skips commits with no non-ledger file changes, returns dry-run prompt metadata, writes a new record with slug identity/date/commit collision suffix, preserves an existing id/path when regenerating, and filters symbols to those actually appearing in the full diff.
