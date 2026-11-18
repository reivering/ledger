---
id: chg_01M7Q1RXJK8BYWTCVWHS4XFQQA
type: change
title: Add embedders, JSON mode flag, and shared generate() to providers
commit: 5dae036
author: ikcyrils@gmail.com
date: 2026-11-18T17:50:54+08:00
category: feature
risk: medium
issues: []
files: [ packages/core/src/providers.ts ]
symbols: [ Prompt, post, fakeProvider, getProvider, fakeEmbed, getEmbedder, extractJson, generate ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
In packages/core/src/providers.ts: (1) added optional `json` flag to the `Prompt` interface and a new `Embedder` type `(texts: string[]) => Promise<Float32Array[]>`; (2) raised the shared `post` timeout from 120s to 300s; (3) `fakeProvider` now returns free text (echoing chg_/iss_ record ids found in the prompt) when `json` is unset, and its JSON branch gained `root_cause` and `fix` fields; (4) extracted OLLAMA/OPENAI base-URL constants and made OpenAI's `response_format: json_object` and Ollama's `format: json` conditional on the `json` flag; (5) added `getEmbedder(cfg)` with OpenAI embeddings, Ollama /api/embed, a deterministic fake (64-dim bag-of-words hash via `fakeEmbed`), and a config-error default; (6) added `generate<S>(provider, prompt, schema)` which calls the provider with `json: true`, extracts JSON between the first '{' and last '}', validates with a Zod schema, retries once appending the Zod error to the user prompt, and throws after two failures.

## Why
Per the commit message: generate() is shared by record and issue close; providers get a json flag so free-text answers (why) are possible; an embedder interface with OpenAI, Ollama and a deterministic fake is added. Not stated: the reason for the 120s→300s timeout increase or the choice of 64 dimensions for the fake embedder.

## Impact / blast radius
Callers: record and issue-close flows are expected to adopt the exported `generate` helper, and semantic search can now obtain vectors via `getEmbedder`. Behavior change: OpenAI and Ollama providers previously always emitted JSON (json_object/format:json); without the new flag they now return free text, and fakeProvider likewise defaults to free text, so any existing caller relying on implicit JSON output will change behavior. The retry-once logic in `generate` can double external API calls (cost) when a provider returns invalid JSON. The timeout increase to 300s affects every provider and embedder HTTP call. API keys are read from `${ENV_PREFIX}OPENAI_API_KEY` for both chat and embeddings. Embedder requests send redacted text to third-party embedding endpoints; the deterministic fake keeps semantic search runnable offline in tests/CI. None of the new exports is used within this file, so the blast radius for consumers is limited to whoever opts into `generate`/`getEmbedder`.

## Testing notes
No test files were changed in this commit. The commit adds test infrastructure (deterministic fake embedder, free-text fake provider path) but ships no tests. Should be tested: `generate` happy path; invalid-JSON retry (first attempt fails validation, second succeeds); two consecutive invalid responses throw with the Zod error message; `extractJson` on text with leading/trailing prose, on text with no braces (throws), and on nested braces; `fakeEmbed` determinism, 64-dimension length, and zero-vector for input with no [a-z0-9] tokens; `getEmbedder` default case throwing the config-error message; and that OpenAI/Ollama providers omit `response_format`/`format` when `json` is falsy.
