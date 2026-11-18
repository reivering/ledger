---
id: chg_01M7Q25DAST6TZ3PRM841TFGJS
type: change
title: "Add living module docs: build, stale status and block-preserving update"
commit: 48ecb29
author: ikcyrils@gmail.com
date: 2026-11-18T18:09:08+08:00
category: feature
risk: low
issues: []
files: [ packages/core/src/docs.ts, packages/core/src/providers.ts, packages/core/src/store.ts ]
symbols: [ Anchor, serializeDoc, parseDoc, block, putBlock, Module, resolveModule, moduleFiles, anchorsFor, recentBlock, generateBlocks, Rec, moduleRecords, DocResult, buildDoc, write, DocStatus, docsStatus, updateDoc, fakeProvider ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
- Added `packages/core/src/docs.ts`: a living module documentation system.
  - `DocSchema` validates a YAML front-matter record (type, module, paths, timestamps, provider, anchors) and `serializeDoc`/`parseDoc` round-trip it.
  - Generated content lives in `<!-- ledger:begin <key> --> … <!-- ledger:end <key> -->` blocks; `putBlock` replaces/inserts a single block and `dropBlock` removes stale ones, guaranteeing text outside blocks is never touched.
  - `buildDoc` resolves a module (via `config.docs.modules` or a folder, slugified), lists git-tracked files, hashes exported symbols (`anchorsFor`), collects related records (`moduleRecords`), prompts the provider with a schema-enforced set of keys (overview/decisions/pitfalls/file:<path>), and writes `<ledger>/docs/modules/<name>.md` with fresh anchors.
  - `docsStatus` recomputes anchors and flags docs whose anchored symbols changed or were removed (`stale`).
  - `updateDoc` only regenerates `file:*` blocks whose anchors changed plus the `recent` record list, preserving all other blocks and anchors.
- `store.ts`: `ConfigSchema` gains `docs.modules` (module name → folder path(s), regex-validated) and `check.pre_push_fail_on` (optional enum threshold for pre-push gating), both with defaults and commented examples in the config template.
- `providers.ts`: `fakeProvider` now parses the `## Requested keys` JSON in the user prompt and returns a fake answer for each requested key, enabling offline doc generation.

## Why
Not stated beyond the commit message: the author wants 'living module docs' where generated sections are anchored to symbol content hashes, and an update pass rewrites only the blocks of files whose content changed while never touching text outside `ledger:begin/end` blocks. The config additions (docs.modules, check.pre_push_fail_on) are introduced alongside but their activation (e.g. a `docs`/`check` CLI flag wiring) is not present in this diff.

## Impact / blast radius
Blast radius:
- New filesystem writes confined to `<repo>/.ledger/docs/modules/*.md` (via `LEDGER_DIR`); no existing repo files are modified except the generated doc file itself.
- Reads the local git index (`git ls-files`), the local search index (`openIndex`) and working-tree sources; no network calls other than those already performed by the configured provider.
- Secrets handling: source snippets and record bodies are passed through `redact(cfg.redaction.patterns)` before reaching the prompt, and the prompt instructs the model that secrets were replaced with [REDACTED:<type>], but anything matched only by the default (not extra configured) patterns could leak into generated markdown; generated docs live in the repo.
- Config schema is a zod strict object with `default({})`, so existing configs without `docs`/`check` keep working; unknown keys would now fail validation if previously tolerated.
- `updateDoc` is a no-op (empty `regenerated`) when no anchors changed; premature `dropBlock` of missing `file:` blocks is bounded to blocks actually present.
- The fake provider change only affects offline/test usage.

## Testing notes
No tests were added or modified in this commit. Should test:
- `putBlock` replaces an existing block, inserts before the `recent` block when absent, appends when no blocks exist, and never alters text outside blocks.
- `parseDoc`/`serializeDoc` round-trip preserves body, front-matter keys, and `generated_at` offset.
- `buildDoc` end-to-end with `fakeProvider` for a temp git repo: creates the expected doc path, front-matter anchors match `listSymbols` hashes, all requested keys present, citation regex satisfied by schema.
- `docsStatus`: modified/removed symbols are flagged `changed`/`removed`; untouched symbols are not.
- `updateDoc`: changes in one file regenerate only its `file:` block plus `recent`, keep other blocks byte-identical, and drop the block when the file is removed.
- Config parsing: existing configs pass; `docs.modules` accepts string/array paths and rejects bad module names; `check.pre_push_fail_on` accepts only the enum values.
- Config fixture comments show the new sections.
