---
type: doc
module: packages-core-src
paths: [ packages/core/src ]
generated_at: 2026-11-18T10:16:32Z
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
anchors:
  - { file: packages/core/src/collect.ts, symbol: FileStat, hash: bceb6aa1b04a1ca5 }
  - { file: packages/core/src/collect.ts, symbol: Collected, hash: 59979cf0bfdb118c }
  - { file: packages/core/src/collect.ts, symbol: issueRefs, hash: 03355fe4fd511dd7 }
  - { file: packages/core/src/collect.ts, symbol: truncate, hash: e1ca8b0afcb0a174 }
  - { file: packages/core/src/collect.ts, symbol: collect, hash: b458512b363beddb }
  - { file: packages/core/src/collect.ts, symbol: collect.isOurs, hash: 66acb224930d50d0 }
  - { file: packages/core/src/db.ts, symbol: Index, hash: 656ae4b0270a0a67 }
  - { file: packages/core/src/db.ts, symbol: Hit, hash: 93a4785323cbab7d }
  - { file: packages/core/src/db.ts, symbol: Row, hash: 9700667275cbf307 }
  - { file: packages/core/src/db.ts, symbol: toHit, hash: 98f8e5a829ca2a57 }
  - { file: packages/core/src/db.ts, symbol: openIndex, hash: 03daa0a1de042ba9 }
  - { file: packages/core/src/db.ts, symbol: syncIndex, hash: 241ac36f0a56b4bc }
  - { file: packages/core/src/db.ts, symbol: reindex, hash: ef7dd7f090a8b420 }
  - { file: packages/core/src/db.ts, symbol: sync, hash: 6791ddffb57684d6 }
  - { file: packages/core/src/db.ts, symbol: sync.remove, hash: c6369c30e4983ad2 }
  - { file: packages/core/src/db.ts, symbol: findRow, hash: 524591e497cd0059 }
  - { file: packages/core/src/db.ts, symbol: getRecord, hash: 5793735b2f615834 }
  - { file: packages/core/src/db.ts, symbol: recent, hash: cdf95b9f3e525a30 }
  - { file: packages/core/src/db.ts, symbol: touching, hash: ac7fffd329a60100 }
  - { file: packages/core/src/db.ts, symbol: linkedIssues, hash: 59ea3b2a05556bce }
  - { file: packages/core/src/db.ts, symbol: WhyTarget, hash: 14d30d2f4009d2aa }
  - { file: packages/core/src/db.ts, symbol: WhyResult, hash: 9c864f55e7ee695b }
  - { file: packages/core/src/db.ts, symbol: symbolMatches, hash: 05aa922ba993054b }
  - { file: packages/core/src/db.ts, symbol: why, hash: b2195ca186566067 }
  - { file: packages/core/src/db.ts, symbol: related, hash: 61e42480614c19ac }
  - { file: packages/core/src/db.ts, symbol: resolveTarget, hash: f8dedf37b6342ffc }
  - { file: packages/core/src/db.ts, symbol: ftsQuery, hash: ff6da4bc065eb522 }
  - { file: packages/core/src/db.ts, symbol: toVec, hash: b9b0314ba8954aa2 }
  - { file: packages/core/src/db.ts, symbol: cosine, hash: c2fb3e90a24c6080 }
  - { file: packages/core/src/db.ts, symbol: search, hash: c5446512b4ffc2cc }
  - { file: packages/core/src/db.ts, symbol: semanticSearch, hash: e8bb439978a4d0f7 }
  - { file: packages/core/src/db.ts, symbol: issueWarning, hash: 4a57977da073b2bc }
  - { file: packages/core/src/db.ts, symbol: explain, hash: 1019d4aeb16f5484 }
  - { file: packages/core/src/docs.ts, symbol: Anchor, hash: c23a77bbd5077d9d }
  - { file: packages/core/src/docs.ts, symbol: DocFront, hash: 69b6f7ab87717185 }
  - { file: packages/core/src/docs.ts, symbol: serializeDoc, hash: 72f303e5e95b251e }
  - { file: packages/core/src/docs.ts, symbol: parseDoc, hash: 338d0f5f5b70a6a9 }
  - { file: packages/core/src/docs.ts, symbol: esc, hash: 0b678252c5ec87fa }
  - { file: packages/core/src/docs.ts, symbol: blockRe, hash: f2b0d47a78789cd7 }
  - { file: packages/core/src/docs.ts, symbol: heading, hash: df1b2d3bf1d63cf0 }
  - { file: packages/core/src/docs.ts, symbol: block, hash: 6abce3330de76eb1 }
  - { file: packages/core/src/docs.ts, symbol: putBlock, hash: f15256e25f8d0d84 }
  - { file: packages/core/src/docs.ts, symbol: dropBlock, hash: c0d986a8de5f7090 }
  - { file: packages/core/src/docs.ts, symbol: Module, hash: 9606adfdb91a6105 }
  - { file: packages/core/src/docs.ts, symbol: docPath, hash: 5871b9025d8268e3 }
  - { file: packages/core/src/docs.ts, symbol: resolveModule, hash: a5336ee03460deaf }
  - { file: packages/core/src/docs.ts, symbol: moduleFiles, hash: 572257d4e53537f1 }
  - { file: packages/core/src/docs.ts, symbol: readWorking, hash: be1f812a1276c069 }
  - { file: packages/core/src/docs.ts, symbol: anchorsFor, hash: 790ce5d0abe8c126 }
  - { file: packages/core/src/docs.ts, symbol: recentBlock, hash: c65eab3b8f41fb64 }
  - { file: packages/core/src/docs.ts, symbol: generateBlocks, hash: caa56c641d8dc8d0 }
  - { file: packages/core/src/docs.ts, symbol: generateBlocks.r, hash: d145444d54c604f7 }
  - { file: packages/core/src/docs.ts, symbol: Rec, hash: 4f045b9cddb8571f }
  - { file: packages/core/src/docs.ts, symbol: moduleRecords, hash: 312d0904df412e79 }
  - { file: packages/core/src/docs.ts, symbol: DocResult, hash: bbc7fb49d9795572 }
  - { file: packages/core/src/docs.ts, symbol: buildDoc, hash: e4b507aac8dc1641 }
  - { file: packages/core/src/docs.ts, symbol: write, hash: 845298346e3efbb3 }
  - { file: packages/core/src/docs.ts, symbol: DocStatus, hash: 2c33bc681c4a2e4b }
  - { file: packages/core/src/docs.ts, symbol: docsStatus, hash: a5304b73d3d47fcf }
  - { file: packages/core/src/docs.ts, symbol: updateDoc, hash: 703add6084180db8 }
  - { file: packages/core/src/engine.ts, symbol: withIndex, hash: 2e0bc29bcaabc282 }
  - { file: packages/core/src/engine.ts, symbol: WhyAnswer, hash: d66227546501984c }
  - { file: packages/core/src/engine.ts, symbol: whyQuery, hash: ffb5984d10384679 }
  - { file: packages/core/src/engine.ts, symbol: searchQuery, hash: 66b449d65eade569 }
  - { file: packages/core/src/engine.ts, symbol: getRecordQuery, hash: bba39391e675aec8 }
  - { file: packages/core/src/engine.ts, symbol: relatedQuery, hash: d05fd458f93791a5 }
  - { file: packages/core/src/engine.ts, symbol: recentQuery, hash: 6f3b67f876dd3b5c }
  - { file: packages/core/src/engine.ts, symbol: IssueBrief, hash: cea91ceb21b00478 }
  - { file: packages/core/src/engine.ts, symbol: issueBrief, hash: a44f850e9c9ca789 }
  - { file: packages/core/src/engine.ts, symbol: SymbolSummary, hash: 6dec9451ebd85288 }
  - { file: packages/core/src/engine.ts, symbol: fileSummary, hash: 288d156bf04808fa }
  - { file: packages/core/src/engine.ts, symbol: FindingSeverity, hash: fb80f0112a5d4d04 }
  - { file: packages/core/src/engine.ts, symbol: severityRank, hash: 5e2c12f453812e49 }
  - { file: packages/core/src/engine.ts, symbol: Finding, hash: b7eb050b78470862 }
  - { file: packages/core/src/engine.ts, symbol: CheckOptions, hash: 39105a0402dcc79e }
  - { file: packages/core/src/engine.ts, symbol: show, hash: a22ba2b920f3a036 }
  - { file: packages/core/src/engine.ts, symbol: check, hash: fb622dc689a1b391 }
  - { file: packages/core/src/engine.ts, symbol: check.worktree, hash: e63761c007e59783 }
  - { file: packages/core/src/engine.ts, symbol: check.add, hash: 461a468b934024ff }
  - { file: packages/core/src/git.ts, symbol: git, hash: 78ddd78f7f32495b }
  - { file: packages/core/src/git.ts, symbol: repoRoot, hash: 67c36e7b144b698b }
  - { file: packages/core/src/hooks.ts, symbol: shq, hash: 9db51c5ac9cf0feb }
  - { file: packages/core/src/hooks.ts, symbol: hooksDir, hash: fdcf40ca7548039b }
  - { file: packages/core/src/hooks.ts, symbol: isOurs, hash: 68bdadfbe83ec7bf }
  - { file: packages/core/src/hooks.ts, symbol: scripts, hash: 1f11dc0b4ad4d8e5 }
  - { file: packages/core/src/hooks.ts, symbol: installHooks, hash: cb1eda433dedb746 }
  - { file: packages/core/src/hooks.ts, symbol: uninstallHooks, hash: 1de7a78c9b2fb9f9 }
  - { file: packages/core/src/index.ts, symbol: checkLicense, hash: a39669d7d017ec81 }
  - { file: packages/core/src/issues.ts, symbol: Severity, hash: 124294dbac798772 }
  - { file: packages/core/src/issues.ts, symbol: Status, hash: 824f730104df067d }
  - { file: packages/core/src/issues.ts, symbol: union, hash: ffffee815bac5566 }
  - { file: packages/core/src/issues.ts, symbol: addSha, hash: 18066d5549180fc3 }
  - { file: packages/core/src/issues.ts, symbol: setSection, hash: 7f1827a6a3d97de0 }
  - { file: packages/core/src/issues.ts, symbol: getSection, hash: 46ce8ff082e4ee9b }
  - { file: packages/core/src/issues.ts, symbol: issueBody, hash: bceb112978f611c9 }
  - { file: packages/core/src/issues.ts, symbol: linkIssue, hash: 202cfe62baa54e2c }
  - { file: packages/core/src/issues.ts, symbol: linkChange, hash: 86c077e6be61c9b8 }
  - { file: packages/core/src/issues.ts, symbol: nextLocalNumber, hash: 68bf690d7cc8e6b2 }
  - { file: packages/core/src/issues.ts, symbol: newIssue, hash: 56c20ed0eeff37fe }
  - { file: packages/core/src/issues.ts, symbol: closeIssue, hash: 231655f135077c18 }
  - { file: packages/core/src/issues.ts, symbol: closeIssue.r, hash: d145444d54c604f7 }
  - { file: packages/core/src/issues.ts, symbol: ImportedIssue, hash: 32a8993c7a0a74e8 }
  - { file: packages/core/src/issues.ts, symbol: IssueSource, hash: 78f199c242da76df }
  - { file: packages/core/src/issues.ts, symbol: severityFromLabels, hash: 26af3d3c284a0952 }
  - { file: packages/core/src/issues.ts, symbol: importIssues, hash: 5ce7cd39b70ab482 }
  - { file: packages/core/src/issues.ts, symbol: GhIssue, hash: bf9190a3f94dee04 }
  - { file: packages/core/src/issues.ts, symbol: githubRepoFromRemote, hash: f5022addaa049c53 }
  - { file: packages/core/src/issues.ts, symbol: githubSource, hash: c1cd12988cb5ea77 }
  - { file: packages/core/src/issues.ts, symbol: githubSource.gh, hash: cdabfb8ddcc89881 }
  - { file: packages/core/src/issues.ts, symbol: githubSource.pull, hash: 4c3d710f64362395 }
  - { file: packages/core/src/providers.ts, symbol: Prompt, hash: f3f0c0f46f7c5871 }
  - { file: packages/core/src/providers.ts, symbol: Provider, hash: c1acabbc25818fd6 }
  - { file: packages/core/src/providers.ts, symbol: Embedder, hash: 982ca07ba99df315 }
  - { file: packages/core/src/providers.ts, symbol: apiKey, hash: ae591222bef48ea1 }
  - { file: packages/core/src/providers.ts, symbol: post, hash: ec98d97e2673a8c0 }
  - { file: packages/core/src/providers.ts, symbol: fakeProvider, hash: 61288dfe6e3efdd0 }
  - { file: packages/core/src/providers.ts, symbol: getProvider, hash: 0ebb8ca395391e14 }
  - { file: packages/core/src/providers.ts, symbol: fakeEmbed, hash: 2a109b09e515423e }
  - { file: packages/core/src/providers.ts, symbol: getEmbedder, hash: 1f6595fa1d85d3d1 }
  - { file: packages/core/src/providers.ts, symbol: extractJson, hash: f725ddfacfe3b807 }
  - { file: packages/core/src/providers.ts, symbol: generate, hash: a6841260d80fdfd9 }
  - { file: packages/core/src/record.ts, symbol: writerSchema, hash: 25fcd93b340cbcec }
  - { file: packages/core/src/record.ts, symbol: buildPrompt, hash: a9bbec9d957d5a63 }
  - { file: packages/core/src/record.ts, symbol: RecordOptions, hash: cdf5376e0c131a3a }
  - { file: packages/core/src/record.ts, symbol: RecordResult, hash: 929f72b9116e4984 }
  - { file: packages/core/src/record.ts, symbol: recordCommit, hash: 89f3e52138559f90 }
  - { file: packages/core/src/redact.ts, symbol: CustomPattern, hash: d2b148ce773c2868 }
  - { file: packages/core/src/redact.ts, symbol: isEnvFile, hash: c737709b007746ae }
  - { file: packages/core/src/redact.ts, symbol: redact, hash: 520d6e263f5f5997 }
  - { file: packages/core/src/rpc.ts, symbol: Message, hash: 59a140c9c96ae2a3 }
  - { file: packages/core/src/rpc.ts, symbol: frame, hash: 009a688beff366c3 }
  - { file: packages/core/src/rpc.ts, symbol: reader, hash: e606fd1d756cf2d7 }
  - { file: packages/core/src/rpc.ts, symbol: connect, hash: c634636eb7f41e9c }
  - { file: packages/core/src/rpc.ts, symbol: connect.fail, hash: c33983ad6907cd99 }
  - { file: packages/core/src/rpc.ts, symbol: connect.request, hash: d05b72d878f7c19e }
  - { file: packages/core/src/store.ts, symbol: validRegex, hash: 34cec399581f7c9d }
  - { file: packages/core/src/store.ts, symbol: Config, hash: de321ea3912f88c5 }
  - { file: packages/core/src/store.ts, symbol: ChangeRecord, hash: 4fd4920f3e4c2f28 }
  - { file: packages/core/src/store.ts, symbol: IssueRecord, hash: 76a037daf22e2f4b }
  - { file: packages/core/src/store.ts, symbol: LedgerRecord, hash: fb4c59508f4c4112 }
  - { file: packages/core/src/store.ts, symbol: ulid, hash: 33f65f695c9f8609 }
  - { file: packages/core/src/store.ts, symbol: serializeRecord, hash: f3859d2a8ec09030 }
  - { file: packages/core/src/store.ts, symbol: parseRecord, hash: e9c93cf54e3a056b }
  - { file: packages/core/src/store.ts, symbol: StoredRecord, hash: a54acb7bcdc9010b }
  - { file: packages/core/src/store.ts, symbol: readRecords, hash: 4fbf86c06bf2b171 }
  - { file: packages/core/src/store.ts, symbol: writeRecord, hash: 9362411f624b0b16 }
  - { file: packages/core/src/store.ts, symbol: readRecord, hash: 3518ff6bb78dd17d }
  - { file: packages/core/src/store.ts, symbol: findRecord, hash: ef58c1b27a223463 }
  - { file: packages/core/src/store.ts, symbol: stripHeading, hash: a7c9af8f2e17f276 }
  - { file: packages/core/src/store.ts, symbol: nowIso, hash: 9985b67eba3ead97 }
  - { file: packages/core/src/store.ts, symbol: slugify, hash: 192d2cc7172d9771 }
  - { file: packages/core/src/store.ts, symbol: loadConfig, hash: bc2a3ab611bcb91e }
  - { file: packages/core/src/store.ts, symbol: init, hash: 3f61a27d3dda9343 }
  - { file: packages/core/src/symbols.ts, symbol: parserFor, hash: 0fa46c90d4b1e5b7 }
  - { file: packages/core/src/symbols.ts, symbol: declName, hash: bf66e9fc03762bef }
  - { file: packages/core/src/symbols.ts, symbol: enclosingSymbols, hash: 09cf3c63a34871db }
  - { file: packages/core/src/symbols.ts, symbol: SymbolRange, hash: a5400fb5d5fff7c1 }
  - { file: packages/core/src/symbols.ts, symbol: contentHash, hash: f014c55413906ec3 }
  - { file: packages/core/src/symbols.ts, symbol: listSymbols, hash: c7579d149719d1bd }
  - { file: packages/core/src/symbols.ts, symbol: listSymbols.walk, hash: 973a6440cb16aded }
  - { file: packages/core/src/symbols.ts, symbol: changedLines, hash: 8f68efbc766de9b4 }
  - { file: packages/core/src/symbols.ts, symbol: show, hash: a22ba2b920f3a036 }
  - { file: packages/core/src/symbols.ts, symbol: anchorSymbols, hash: ef5449e55b9c0cbc }
---

# Module `packages-core-src`

> Generated by Ledger from `packages/core/src` and its records. Text inside `ledger:begin/end` blocks is regenerated by `ledger docs update`; anything outside them is yours and is kept.

<!-- ledger:begin overview -->
## What it does

packages/core is the shared engine behind the `ledger` CLI, the MCP server, and `ledger serve --stdio` for editors; every command opens the index and so callers never see stale records [chg_01M7Q267AD1QQF4C6RZ5N9F136, chg_01M7Q27XEFMJK1X8CCFTHBZEJY]. The data lifecycle is: records live in `.ledger/` (changes/ + issues/ markdown with YAML front matter, ULID ids), git hooks background the CLI to record commits, `collect` gathers commit metadata/diff with redaction and truncation, and `db.openIndex` syncs a SQLite index by mtime+size stamp on every open and rebuilds it only on SCHEMA_VERSION mismatch [chg_01M7Q1T5WDXW6H33ZAA1MBB8JK, chg_01M7Q1K69XH29JW2R7F2DGZAQJ, chg_01M7Q1MXAMBJMAXNV7TH4YQCEE]. The DB layer answers `why`/`related`/`recent`/`getRecord`/`search` (FTS5 plus optional semantic fusion), `engine.ts` adds `fileSummary` and the `check` finding pipeline (repeat-bug, high-risk-change, stale-doc), `docs.ts` generates living module docs anchored to content-hashed symbols and updates only stale blocks, `rpc.ts` frames the same queries over stdio as JSON-RPC, and all outputs are redacted and validated before leaving the machine [chg_01M7Q267AD1QQF4C6RZ5N9F136, chg_01M7Q25DAST6TZ3PRM841TFGJS, chg_01M7Q27XEFMJK1X8CCFTHBZEJY, chg_01M7Q1WZFYH4RD9FGZ11JB65N0].
<!-- ledger:end overview -->
<!-- ledger:begin decisions -->
## Key decisions

State is markdown + YAML front matter on disk in `.ledger/` so the whole trail is git-committed and reviewable: `store.ts` owns the strict Zod schemas, ULID id generation, and an idempotent `init` [chg_01M7Q1JQPWVRB60PEJS1B16EW5]. The index does not live in the records' writers: `openIndex` creates `.ledger/.cache/index.db`, deletes and recreates it (including -wal/-shm sidecars) when `SCHEMA_VERSION` differs, and `sync()` upserts by a `mtimeMs:size` stamp inside a transaction [chg_01M7Q1T5WDXW6H33ZAA1MBB8JK]. Merge commits are diffed only against the first parent — what the merge brought in — and root commits against the empty tree; `.ledger/` paths are excluded everywhere so records never feed back into payloads [chg_01M7Q1K69XH29JW2R7F2DGZAQJ]. Truncation is first-fit in git path order (header, then as many hunks as fit), not relevance-ranked, with a `NOISE` denylist for lockfiles/build output — ponytailed to be revisited once relevant ranking exists [chg_01M7Q1K69XH29JW2R7F2DGZAQJ]. `why()` scopes issues to the target symbol (anchored changes plus issues whose own symbols match) so one function's bug stops warning on neighbours, anchored vs file-level hits carry distinct `match` values [chg_01M7Q24E3QZ3E495C4VCTNKA3M]. Docs are built into `<!-- ledger:begin/end -->` marker blocks so human text outside them is never touched; `updateDoc` regenerates only blocks whose anchored symbols changed per content-hash, anchors are recorded in front matter, and stale docs surface as `info` check findings pointing at `ledger docs update` [chg_01M7Q25DAST6TZ3PRM841TFGJS, chg_01M7Q267AD1QQF4C6RZ5N9F136]. Hooks never block git: post-commit/post-merge background the CLI with nohup and always exit 0, skip recording during rebases, respect `core.hooksPath`, refuse to overwrite foreign hooks, and pre-push warns unconditionally but blocks only on exit code `PRE_PUSH_BLOCK_EXIT` = 3 when `check.pre_push_fail_on` is configured — any other engine error lets the push through [chg_01M7Q1MXAMBJMAXNV7TH4YQCEE, chg_01M7Q1QHGQ45VXPG8SKJFQKDB5, chg_01M7Q26Z7NJFGESWK9JECJ68YR]. Redaction happens at egress with typed `[REDACTED:<type>]` markers: helper functions take already-redacted text, existing markers are skipped, connection-URL passwords are redacted while scheme/user/host are preserved, and env files are reduced to a header [chg_01M7Q1J5E0AVQES8DFKSA03CQF, chg_01M7Q1WZFYH4RD9FGZ11JB65N0]. `generate()` centralizes the provider contract — JSON mode plus a Zod schema, extraction between the first `{` and last `}`, and one retry appending the validation error — shared by record, issue close, and docs; embedders use per-model and per-text deduped caching [chg_01M7Q1RXJK8BYWTCVWHS4XFQQA, chg_01M7Q1M3BHDMYMY4KRSCY3ENX0].
<!-- ledger:end decisions -->
<!-- ledger:begin pitfalls -->
## Known pitfalls and bugs

Scaling is ponytailed with explicit limits: `sync()` stats every record file per open (fine to ~50k records), semantic search computes embeddings in batches of 32 and brute-force JS cosine is fine past ~100k records, and `generateBlocks` does first-fit per-file source budgeting that can truncate whole files [chg_01M7Q1T5WDXW6H33ZAA1MBB8JK, chg_01M7Q25DAST6TZ3PRM841TFGJS]. Local issue numbers are unique only per checkout: two branches can both mint the same `#N`, so the store uses a bare-number regex and the records tell you to rename on merge [chg_01M7Q1VB3WQCTDM0MXKBBF04DA]. Rebase detection in the generated hooks relies on git internals (`rebase-merge`/`rebase-apply` directories), and commits made concurrently during a rebase are also skipped — accepted at the time [chg_01M7Q1QHGQ45VXPG8SKJFQKDB5]. `collect` derives change line numbers from the raw diff while the shown diff is redacted, because redaction can collapse multi-line secrets — symbol anchors are verified against an untruncated redacted `fullDiff`, but keep any verification consistent with that asymmetry; env files drop all hunks entirely, so symbol anchoring never sees them [chg_01M7Q1K69XH29JW2R7F2DGZAQJ]. In `issues.ts`, `issueBody` seeds Root cause with an `_Unknown — filled in by ledger issue close_` placeholder and engine.issueBrief strips exactly that placeholder-underscore convention — a hand-written 'unknown' that does not start with an underscore would be treated as a real root cause [chg_01M7Q267AD1QQF4C6RZ5N9F136]. `closeIssue` matches fix commits by prefix (`sha.startsWith(x.front.commit)`), so clones/forks with colliding short hashes could mis-link [chg_01M7Q1VB3WQCTDM0MXKBBF04DA]. `documentationStatus`-based `stale-doc` findings tell engineers to run `ledger docs update <module>`, but anchors compare content hashes only — renames keep the hash logic intact, while an unchanged declaration moved in the file still matches since only text is hashed [chg_01M7Q25DAST6TZ3PRM841TFGJS, chg_01M7Q24E3QZ3E495C4VCTNKA3M]. `remove` during sync deletes from six tables keyed by record id, and parse failures push an `errors` entry while removing — the error strings are surfaced, not indexed, by openIndex, so bears with `syncIndex`/`withIndex` printing `invalid record: ...` [chg_01M7Q1T5WDXW6H33ZAA1MBB8JK]. The index is a derived cache: deleting `.ledger/.cache/index.db` or bumping SCHEMA_VERSION forces a rebuild from records, so never ship a partial new schema without re-running `issues`/`changes` through parseRecord-compatible files [chg_01M7Q1T5WDXW6H33ZAA1MBB8JK]. `provider.ts` and `post()` treat the 300s timeout and per-provider base-URL overrides as fixed; `generate()` retries only once, so flaky providers surface as thrown errors that `check`/`why` convert into `ai_error` rather than crashing the push [chg_01M7Q1RXJK8BYWTCVWHS4XFQQA]. Local `nextLocalNumber` ignores imported issues (external_id like PROJ-142 does not match the `#N` regex, and any non-matching id contributes 0 to the max), so gutters can reuse imported numbers [chg_01M7Q1VB3WQCTDM0MXKBBF04DA].
<!-- ledger:end pitfalls -->

## Files

<!-- ledger:begin file:packages/core/src/collect.ts -->
### `packages/core/src/collect.ts`

Data model: `FileStat` (path, nullable added/deleted — null means binary/numstat dash) and `Collected` (sha, short, author, iso date, parents, base, redacted message, per-file added/removed line numbers `lines` for anchoring, issue refs, file stats, truncated redacted `diff` for the provider, untruncated redacted `fullDiff` for symbol verification, and `notes` listing omissions) [chg_01M7Q1K69XH29JW2R7F2DGZAQJ]. `issueRefs(text)` regex-matches `#123` and `PROJ-123` forms, skipping a NOT_ISSUE denylist of acronyms (UTF, SHA, ISO, RFC, TLS, HTTP, X) [chg_01M7Q1K69XH29JW2R7F2DGZAQJ]. `NOISE` pattern matches lockfiles (pnpm-lock.yaml, package-lock.json, yarn.lock, bun.lock, Cargo.lock, go.sum, poetry.lock, composer.lock), minified JS/CSS, and dist/build/vendor/node_modules paths — those files contribute only a summary note [chg_01M7Q1K69XH29JW2R7F2DGZAQJ]. `truncate` returns `{diff, notes}`: it is path-order first-fit — keeps whole per-file text when it fits, otherwise the header plus as many hunks as fit, recording 'N of M hunks omitted' or 'diff omitted' notes [chg_01M7Q1K69XH29JW2R7F2DGZAQJ]. `collect` uses `git show -s` for commit metadata (NUL-separated fields), diffs merges against the first parent and root commits against the empty tree, reads numstat for order, computes `lines` from the raw diff before redaction, strips env files to a `[REDACTED:env_file]` header via `isEnvFile`, redacts everything else, and filters `.ledger/` out of files/diff/fullDiff with an `isOurs` local helper [chg_01M7Q1K69XH29JW2R7F2DGZAQJ, chg_01M7Q1VB3WQCTDM0MXKBBF04DA]. `base` and raw-diff `lines` were added with the issue feature so `anchorSymbols` and close-issue can verify [chg_01M7Q1VB3WQCTDM0MXKBBF04DA].
<!-- ledger:end file:packages/core/src/collect.ts -->

<!-- ledger:begin file:packages/core/src/db.ts -->
### `packages/core/src/db.ts`

The index module: `Index` = `{db, root, errors}`; errors are invalid record files, reported and not indexed [chg_01M7Q1T5WDXW6H33ZAA1MBB8JK]. Schema v1 (`SCHEMA_VERSION = 1`) has `records` (unique path, title/category/risk for changes; status/severity/external_id for issues), link tables `record_files`/`record_symbols`/`record_issues`, an FTS5 `records_fts` tokenizer porter unicode61, and an `embeddings` table keyed by `id + model` [chg_01M7Q1T5WDXW6H33ZAA1MBB8JK]. `openIndex` rebuilds on version mismatch (with `busy_timeout=5000` and WAL), `reindex` deletes and rebuilds, `syncIndex` just opens+closes, and `sync()` upserts by `mtimeMs:size` stamp in a transaction, deleting vanished files from all six tables via `remove` [chg_01M7Q1T5WDXW6H33ZAA1MBB8JK]. Queries: `getRecord`/`findRow` resolve by id OR external_id (bare digits become `#N`), `recent` orders by date desc id desc, `touching` handles directory paths by prefix `substr`, `linkedIssues` combines issue-type hits with issue references from changes, and `related` accumulates `matched_files` across inputs sorted by date [chg_01M7Q1T5WDXW6H33ZAA1MBB8JK]. `resolveTarget` parses `path`, `path#symbol`, or `path:line`, converting a line to its enclosing symbol in `resolveTarget` [chg_01M7Q1T5WDXW6H33ZAA1MBB8JK]. `why` returns `{anchored, file_level, issues, target}` with `match: 'symbol'|'file'`; symbol-scoped issue filtering via `symbolMatches` (exact, prefix-dot, suffix-dot, contains-dot) and the issueList built only from anchored changes plus matching issue-type hits was introduced to stop one function's bugs warning on neighbours [chg_01M7Q24E3QZ3E495C4VCTNKA3M]. `search` builds an FTS query from word-ish terms (`BM25` + `snippet()`), optionally fuses semantic results with reciprocal-rank scores `1/(60+rank)`, and downgrades with a warning when semantic is unavailable (its `warnings` list) [chg_01M7Q1T5WDXW6H33ZAA1MBB8JK]. `semanticSearch` lazily embeds pending records per model in batches of 32 (redacted text), redacts before embedding, caches per model id, and brute-force cosine-ranks with a ponytail to sqlite-vec past ~100k records; queries redact, too [chg_01M7Q1T5WDXW6H33ZAA1MBB8JK]. `issueWarning` renders an emoji warning naming the external id and resolving-or-open state, and `explain` asks the provider (capped at 15 records, 2000-char bodies) for a concise under-200-words answer citing `[chg_…]` ids, leading with bugs/incidents and explicitly saying when records don't explain something [chg_01M7Q1T5WDXW6H33ZAA1MBB8JK].
<!-- ledger:end file:packages/core/src/db.ts -->

<!-- ledger:begin file:packages/core/src/docs.ts -->
### `packages/core/src/docs.ts`

Living module docs: a generated doc file has YAML front matter validated by `DocSchema`/`DocFront` (`type`, `module`, `paths`, `generated_at`, `generated_by` with provider/model, `anchors`), serializeDoc emits flow-style YAML where safe, parseDoc throws on missing front matter, and the body is segmented by `<!-- ledger:begin <key> --> … <!-- ledger:end <key> -->` blocks [chg_01M7Q25DAST6TZ3PRM841TFGJS]. HEADINGS map the four standard keys (overview→'## What it does', decisions→'## Key decisions', pitfalls→'## Known pitfalls and bugs', recent→'## Recent changes'); `heading()` falls back to `### <name>` for `file:<path>` keys; `putBlock` replaces an existing block or inserts before the `recent` block, and `dropBlock` removes stale ones — text outside blocks is never touched [chg_01M7Q25DAST6TZ3PRM841TFGJS]. `resolveModule` checks `cfg.docs.modules` first, then an existing doc's paths, then treats the arg as a directory (slugified name); `moduleFiles` lists git-tracked files excluding `.ledger/` [chg_01M7Q25DAST6TZ3PRM841TFGJS]. Generation: `anchorsFor` hashes every declaration via `listSymbols` (unsupported languages have none), `moduleRecords` opens the index once and merges issues+changes sorted by date newest first (bodies fetched via `getRecord`), and `generateBlocks` sends files/symbols/source snippets (first-fit budget with a '… (truncated)' note and a source-budget ponytail) plus up to 30 records and requests exactly `['overview','decisions','pitfalls', 'file:…']` with a refinement that every value must cite `[chg_…]`/`[iss_…]` or a backtick path (`CITED`) [chg_01M7Q25DAST6TZ3PRM841TFGJS]. `buildDoc` regenerates all keys plus the `recent` list (12 newest records), deletes per-file blocks whose anchors disappeared, and writes fresh anchors; `docsStatus` recomputes anchors and flags changed/removed by hash comparison; `updateDoc` regenerates only blocks for files whose anchors changed and the `recent` list, preserving all others and keeping unchanged anchors in front matter [chg_01M7Q25DAST6TZ3PRM841TFGJS]. `fakeProvider` was taught to parse the '## Requested keys' JSON to make docs testable offline [chg_01M7Q25DAST6TZ3PRM841TFGJS].
<!-- ledger:end file:packages/core/src/docs.ts -->

<!-- ledger:begin file:packages/core/src/engine.ts -->
### `packages/core/src/engine.ts`

`withIndex(root, fn)` is the single entry convention: it opens the index (which self-syncs), logs each `invalid record: ...` error, runs fn, and always closes [chg_01M7Q267AD1QQF4C6RZ5N9F136]. Thin wrappers `searchQuery`, `getRecordQuery`, `relatedQuery`, `recentQuery` all go through it [chg_01M7Q267AD1QQF4C6RZ5N9F136]. Auth `whyQuery` resolves the spec, runs `why()`, maps issues through `issueWarning` strings, and when `ai` is requested calls `explain` — failures are captured into `ai_error` instead of throwing [chg_01M7Q267AD1QQF4C6RZ5N9F136]. `fileSummary` works on the unsaved buffer when given (`text?`), lists symbols via `enclosingSymbols`-powered `listSymbols`, and emits per-symbol `SymbolSummary` (anchored change count, bug count, newest 3 record refs, full `IssueBrief`s), casting each symbol to `how(ix, {path, symbol})` [chg_01M7Q267AD1QQF4C6RZ5N9F136]. `IssueBrief.root_cause` strips a leading `_` placeholder so 'unknown' is not presented as a root cause [chg_01M7Q267AD1QQF4C6RZ5N9F136]. `check` is the finding engine (`FINDING_SEVERITY = ['info', ...SEVERITY]`, `severityRank` simple indexOf) and takes options with exactly one of staged/diff/range: `--range a..b` diffs with `--no-renames` and shows sides from git, `--staged` vs HEAD, otherwise an explicit `--diff` unified text or the full working-tree diff [chg_01M7Q267AD1QQF4C6RZ5N9F136]. It maps added/removed lines to symbols per file (falling back to file-level for unsupported languages where `t.symbols` is null), skips `.ledger/` paths, and produces dedup-keyed `Finding`s of kind `repeat-bug` (severity = the past issue's severity, message names the symbol or path, issue id, status/date, and first root-cause paragraph), `high-risk-change` (severity medium, only for symbol-scoped anchored changes with risk 'high'), and `stale-doc` (severity info, message says to run `ledger docs update <module>`, records empty) [chg_01M7Q267AD1QQF4C6RZ5N9F136]. Findings are `sort(severityRank(b) - severityRank(a))` descending and returned as an array [chg_01M7Q267AD1QQF4C6RZ5N9F136].
<!-- ledger:end file:packages/core/src/engine.ts -->

<!-- ledger:begin file:packages/core/src/git.ts -->
### `packages/core/src/git.ts`

Two utilities: `git(cwd, args)` wraps `execFileSync('git', ['-c', 'core.quotepath=off', ...])` with utf8 encoding, a 1 GiB `maxBuffer`, and piped stdio — it throws on non-zero exit, which callers like `check.show` and `resolveTarget` turn into empty-string fallbacks, and everything is synchronous [chg_01M7Q1HJS0513E8ZPYYRZPKW86]. `repoRoot(cwd)` runs `git rev-parse --show-toplevel` and `.trim()`s [chg_01M7Q1HJS0513E8ZPYYRZPKW86]. Product constants (defined in product.ts, consumed throughout the package): PRODUCT_NAME 'Ledger', BIN_NAME 'ledger', LEDGER_DIR '.ledger', INDEX_CACHE '.ledger/.cache/', ENV_PREFIX 'LEDGER_' [chg_01M7Q1HJS0513E8ZPYYRZPKW86].
<!-- ledger:end file:packages/core/src/git.ts -->

<!-- ledger:begin file:packages/core/src/hooks.ts -->
### `packages/core/src/hooks.ts`

Installs and removes POSIX sh stubs: the post-commit/post-merge script records HEAD non-blockingly (`nohup <cmd> record <sha> >>log 2>&1 &`, always `exit 0`), skips when `rebase-merge` or `rebase-apply` exists so replays aren't recorded (added in the rebase fix), and the pre-push script reads stdin lines (`lref lsha rref rsha`), computes `base..lsha` for new/updated branches, runs `check --pre-push --range`, and sets `block=1` only on exit `PRE_PUSH_BLOCK_EXIT` (3) [chg_01M7Q1MXAMBJMAXNV7TH4YQCEED]. `MARK` (`# managed-by: <BIN_NAME>`) marks our own hooks: `isOurs` greps for it, `uninstallHooks` removes only managed files, and `installHooks` refuses to overwrite foreign hooks, printing a suggested one-liner to add instead [chg_01M7Q1MXAMBJMAXNV7TH4YQCEE]. `hooksDir` respects `core.hooksPath` via `git rev-parse --git-path hooks` rather than hardcoding `.git/hooks`; scripts are generated by `scripts(cmd, prePush)` so pre-push is opt-in via `installHooks(..., {prePush: true})` [chg_01M7Q1MXAMBJMAXNV7TH4YQCEE, chg_01M7Q26Z7NJFGESWK9JECJ68YR]. `shq` single-quote-shell-escapes (paired `'\''`), and the pre-push guard deliberately lets any non-configured error through so a broken engine never blocks a push — matching its own comment 'any ledger error lets the push through' [chg_01M7Q26Z7NJFGESWK9JECJ68YR]. In one record the generated script content was partially secret, matching the commit that reduced payload size; the hook script itself echoes no secrets [chg_01M7Q26Z7NJFGESWK9JECJ68YR].
<!-- ledger:end file:packages/core/src/hooks.ts -->

<!-- ledger:begin file:packages/core/src/index.ts -->
### `packages/core/src/index.ts`

Pure barrel: it re-exports all of product, git, redact, store, collect, providers, record, hooks, symbols, issues, db, engine, and docs, and exposes `checkLicense()` — a no-op with a Milestone 3 comment saying the offline Ed25519-signed license file hook will live here and throw to refuse once licensing is built [chg_01M7Q1MXAMBJMAXNV7TH4YQCEE].
<!-- ledger:end file:packages/core/src/index.ts -->

<!-- ledger:begin file:packages/core/src/issues.ts -->
### `packages/core/src/issues.ts`

Issue record lifecycle: `Severity`/`Status` derive from config `SEVERITY` and `ISSUE_STATUS` (open|resolved|wontfix — 'mitigated' removed), `union` dedupes, and `addSha` treats a short and a full SHA of the same commit as one value [chg_01M7Q1SGRVAHX9FTJQQA5SVWF3, chg_01M7Q1VB3WQCTDM0MXKBBF04DA]. `setSection`/`getSection` operate on '## Heading' sections with regex boundaries and `setSection` normalizes injected text with `stripHeading` (added so the model doesn't double headings) [chg_01M7Q2CAWTGP58P0H37JS7G43H]. `issueBody` seeds Symptom (with '_Not described._' fallback), Root cause ('_Unknown — filled in by ledger issue close_'), and Fix ('_Pending._') [chg_01M7Q1VB3WQCTDM0MXKBBF04DA]. `linkIssue` idempotently merges fix_commits, related_changes, files, and symbols into an issue front matter; `linkChange` rewrites a change's raw issue ref ('#142') to the resolved record id [chg_01M7Q1VB3WQCTDM0MXKBBF04DA]. `nextLocalNumber` uses nextUnused across existing records, caveat noted per checkout (same `#N` possible on two branches; rename on merge) [chg_01M7Q1VW5MTVPD0MXKBBF04DA]. `newIssue` writes `.ledger/issues/iss_<ulid>-slug.md`, syncs through the DB instead of returning stale, and `closeIssue` collects the fix commit (redacted diff), generates Root cause/Fix out of `closeSchema` (root_cause must be non-empty — write 'Not determinable...' if unclear), anchors symbols, marks `resolved` with `resolved_at`, links change by commit prefix, and syncs [chg_01M7Q1VB3WQCTDM0MXKBBF04DA]. `importIssues` is incremental and additive: a `.ledger/state/<source>.json` cursor persists `last_sync`, updated-at drives the new cursor, tracker updates go into tracker fields (title, status, labels, resolved_at) while preserving local body edits, and pre-existing changes referencing the ref are bidirectional-linked; `severityFromLabels` maps critical/p0/sev-1/blocker etc. on label text [chg_01M7Q1VB3WQCTDM0MXKBBF04DA]. `githubSource` filters PRs out of the issues endpoint, maps `state_reason: not_planned` to wontfix, uses `closed` events' `commit_id` for fix_commits (12-char slice), and paginates while pages are full; `githubRepoFromRemote` parses the origin URL for owner/name [chg_01M7Q1VB3WQCTDM0MXKBBF04DA].
<!-- ledger:end file:packages/core/src/issues.ts -->

<!-- ledger:begin file:packages/core/src/providers.ts -->
### `packages/core/src/providers.ts`

Note: the tail of this file is truncated in the provided source; the facts below come from the surviving header plus the records [chg_01M7Q1M3BHDMYMY4KRSCY3ENX0, chg_01M7Q1RXJK8BYWTCVWHS4XFQQA]. `Provider` and `Embedder` take already-redacted text and callbacks, so redaction is always the caller's job [chg_01M7Q1J5E0AVQES8DFKSA03CQ]. `Prompt.json` asks the provider for a JSON object; the shared `post()` fetch wrapper is what got the timeout raised from 120s to 300s (the visible header shows `AbortSignal.timeout(300_000)`) [chg_01M7Q1RXJK8BYWTCVWHS4XFQQA]. `apiKey(name)` reads `LEDGER_<NAME>_API_KEY` (check `ENV_PREFIX`) and throws with a clear message when missing; `getProvider(cfg)` selects anthropic/openai/ollama/fake adapters with model and base-URL override hooks, and `getEmbedder(cfg)` picked the same four families published as OLLAMA/OPENAI constants [chg_01M7Q1M3BHDMYMY4KRSCY3ENX0, chg_01M7Q1RXJK8BYWTCVWHS4XFQQA]. `extractJson` finds the first `{` to last `}` span. `generate<S>` (added in the same providers milestone) calls with `json: true`, extracts the object, validates with the Zod schema, retries exactly once appending the prior Zod error to the user prompt, and throws after two failures [chg_01M7Q1RXJK8BYWTCVWHS4XFQQA]. `fakeEmbed` is a deterministic 64-dim bag-of-words hash over redacted text, used by the fake source and by tests [chg_01M7Q1RXJK8BYWTCVWHS4XFQQA]. `fakeProvider` echoes chg_/iss_ ids found in the prompt when free text is asked and supports a JSON branch; the docs milestone taught it to parse the '## Requested keys' JSON for offline doc generation [chg_01M7Q25DAST6TZ3PRM841TFGJS].
<!-- ledger:end file:packages/core/src/providers.ts -->

<!-- ledger:begin file:packages/core/src/record.ts -->
### `packages/core/src/record.ts`

This file's body is truncated in the provided snapshot, but its symbols and the records pin its shape: `writerSchema` is built from allowed categories and RISKS, `buildPrompt` produces the JSON-only audit instructions with commit/files/diff context (accepts an issue-title map so refs resolve to titled, redacted titles), `RecordOptions` carries dry-run and related knobs, `RecordResult` includes `linked` when fix refs resolved to issue records, and `recordCommit` wires duplicate detection via readRecords, collect() with the config's redaction limits, symbol filtering to names present in the full diff, dry-run output, front-matter validation through ChangeRecordSchema, filename-collision handling, writeRecord, and syncIndex [chg_01M7Q1M3BHDMYMY4KRSCY3ENX0, chg_01M7Q1VB3WQCTDM0MXKBBF04DA]. Since [chg_01M7Q2CAWTGP58P0H37JH3G43H] what_changed, why, impact, and testing pass through stripHeading(heading, text) so generated sections don't repeat their own '##' heading [chg_01M7Q2CAWTGP58P0H37J53H]. And since the 'fix #N' change-listing work, prompt generation used a shared `generate` from providers (the local extractJson/generate were removed) and requests native JSON [chg_01M7Q1VB3WQCTDM0MXKBBF04DA]. Verify the truncation boundaries before editing: the symptom history says exactly one regression test exists in packages/core/test/record.test.ts [chg_01M7Q2CAWTGP58P0H37J53H].
<!-- ledger:end file:packages/core/src/record.ts -->

<!-- ledger:begin file:packages/core/src/redact.ts -->
### `packages/core/src/redact.ts`

Also truncated in the snapshot; the surviving export list plus the records define the contract: `isEnvFile(path)` decides whether a file is entirely secret-bearing (used by collect.ts to strip diff hunks to a header) [chg_01M7Q1K69XH29JW2R7F2DGZAQJ, chg_01M7Q1J5E0AVQES8DFKSA03CQF]. `redact(text, patterns)` replaces known secret shapes (AWS keys, GitHub/GitLab tokens, Slack, Stripe, JWTs, private-key blocks) with `[REDACTED:<type>]`, then applies caller-supplied `CustomPattern`s, then redacts assignments that look like KEY/SECRET/PASSWORD/TOKEN while skipping any already-marked marker (with its negative lookahead so a second pass can't double-redact) — the name-based heuristics deliberately over-redact to be safe [chg_01M7Q1J5E0AVQES8DFKSA03CQF, chg_01M7Q1WZFYH4RD9FGZ11JB65N0]. The later `URL_CREDENTIALS` regex covers `scheme://user:password@host`, replacing only the password segment with `[REDACTED:url_password]` while keeping scheme, user, and host for context; negative cases keep `https://example.com/a:b` path pairs and plain `mailto:x@y.z` untouched [chg_01M7Q1WZFYH4RD9FGZ11JB65N0]. Its test suite splits fixtures from scanner patterns so fixture secrets don't trip scanners and covers double-redact and custom-pattern behavior [chg_01M7Q1J5E0AVQES8DFKSA03CQF, chg_01M7Q1WZFYH4RD9FGZ11JB65N0]. Redaction only helps if applied at every egress — the fast flag: prompts, records and embeddings are redacted before going to providers or indexers [chg_01M7Q1J5E0AVQES8DFKSA03CQF, chg_01M7Q1T5WDXW6H33ZAA1MBB8JK].
<!-- ledger:end file:packages/core/src/redact.ts -->

<!-- ledger:begin file:packages/core/src/rpc.ts -->
### `packages/core/src/rpc.ts`

Truncated in the snapshot. Per the milestone record: dependency-free JSON-RPC 2.0 over LSP-style Content-Length framing — `frame`/`reader` implement the wire protocol, `connect` is the client side with query helpers `connect.request`/`connect.fail`, and it is exported as the `@ledger/core/rpc` subpath export [chg_01M7Q27XEFMJK1X8CCFTHBZEJY]. The serve-side consumer runs it on stdio with stdout for protocol and stderr for logs, watches `.ledger/` (200 ms debounce, `.cache` ignored) and sends `ledger/indexChanged` notifications [chg_01M7Q27XEFMJK1X8CCFTHBZEJY]. That server fronts the shared engine: how/search/getRecord/related/recent/fileSummary/check/docsStatus/reindex/record, and the MCP server moved onto those shared functions [chg_01M7Q27XEFMJK1X8CCFTHBZEJY].
<!-- ledger:end file:packages/core/src/rpc.ts -->

<!-- ledger:begin file:packages/core/src/store.ts -->
### `packages/core/src/store.ts`

Truncated in the snapshot; the two milestones + a bugfix define it: `Config`/`ChangeRecord`/`IssueRecord`/`LedgerRecord` are strict Zod-discriminated-union schemas with YAML front matter; Config has the search block (`search.semantic` boolean, `search.provider` openai|ollama|fake, `search.model`) defaulting semantic to false, `docs.modules` regex-validated, and `check.pre_push_fail_on` as an optional threshold, and IssueRecord gained severity, `source` (`/^[a-z]+$/`), `external_id` (raw '#142' or 'PROJ-142'), symbols, related_changes, resolved_at, labels and the simplified open|resolved|wontfix lifecycle (status strings replaced with the exported ISSUE_STATUS list) [chg_01M7Q1SGRVAHX9FTJQQA5SVWF3, chg_01M7Q25DAST6TZ3PRM841TFGJS]. `ulid`, `serializeRecord`/`parseRecord` provide the file round-trip; `readRecords` strictly validates everything and reports invalid files rather than skipping; `writeRecord`/`readRecord` do file IO; `findRecord` resolves a record by id, external ref, or bare number; `nowIso` is a date helper, and `slugify` filenames [chg_01M7Q1JQPWVRB60PEJS1B16EW5, chg_01M7Q1SGRVAHX9FTJQQA5SVWF3]. A shared `sha` regex (`/^[0-9a-f]{7,40}$/`) is the single place for commit-sha-shape validation [chg_01M7Q1SGRVAHX9FTJQQA5SVWF3]. `stripHeading(heading, text)` trims and strips a repeated section heading case-insensitively — used by recordCommit for what_changed/why/impact/testing and by `setSection` for issue sections [chg_01M7Q2CAWTGP58P0H37JH3G43H]. `init` is idempotent: creates changes/, issues/, docs/, a state/ directory (for importer cursors), config.yaml, README, and appends the cache entry to .gitignore — without overwriting [chg_01M7Q1JQPWVRB60PEJS1B16EW5, chg_01M7Q1SGRVAHX9FTJQQA5SVWF3].
<!-- ledger:end file:packages/core/src/store.ts -->

<!-- ledger:begin file:packages/core/src/symbols.ts -->
### `packages/core/src/symbols.ts`

Truncated in the snapshot; three records cover its design: `parserFor` loads vendored tree-sitter grammars (typescript, tsx, python, go .wasm files — nothing is fetched at runtime), and everything sits behind MAX_SOURCE's 2 MB guard, so unsupported languages or oversized inputs return null instead of throwing (that's the file-level fallback contract) [chg_01M7Q1R7XNKFTKR4RPTX73EFAZ]. `enclosingSymbols` returns qualified names (e.g. `AuthClient.request`) at 1-based lines; `changedLines` parses unified diff hunks into added/removed line sets with shared hunk-width math; and anchorSymbols maps a commit's added lines to the new file and removed lines to the old via `git show` [chg_01M7Q1R7XNKFTKR4RPTX73EFAZ]. The public `listSymbols(path, source)` returns `SymbolRange[]` (`name`, 1-based `line`/`endLine`, `hash` of the declaration's source text), or null when unsupported, walking the tree via `listSymbols.walk` and freeing parser/tree [chg_01M7Q24E3QZ3E495C4VCTNA3M]. `contentHash(text)` is sha256 truncated to 16 hex chars via node:crypto — that's what anchors compare, so docstring anchors go stale only when declaration text changes, not on moves [chg_01M7Q24E3QZ3E495C4VCTNKA3M]. USCORE-name in collect.ts derived real line numbers from this API, and check.ts calls it on both sides of the diff [chg_01M7Q1K69XH29JW2R7F2DGZAQJ, chg_01M7Q267AD1QQF4C6RZ5N9F136]. Its test suite covers TS methods and python functions with cross-language fallback [chg_01M7Q1R7XNKFTKR4RPTX73EFAZ].
<!-- ledger:end file:packages/core/src/symbols.ts -->

<!-- ledger:begin recent -->
## Recent changes

- 2026-11-18 Drop repeated section headings from model output in records and issue sections (`d90b6f6`, bugfix/low) [chg_01M7Q2CAWTGP58P0H37JS7AGH3]
- 2026-11-18 Add shared engine + ledger check for repeat bugs, high-risk changes, stale docs (`4d7e9da`, feature/low) [chg_01M7Q267AD1QQF4C6RZ5N9F136]
- 2026-11-18 Add opt-in pre-push hook that warns and blocks only when configured (`576eca7`, feature/low) [chg_01M7Q26Z7NJFGESWK9JECJ68YR]
- 2026-11-18 Add `ledger serve --stdio` JSON-RPC engine, plus `check` and `docs` CLI commands (`f62c3d5`, feature/medium) [chg_01M7Q27XEFMJK1X8CCFTHBZEJY]
- 2026-11-18 Scope why() issues to the target symbol; add listSymbols with content hashes (`242254a`, feature/low) [chg_01M7Q24E3QZ3E495C4VCTNKA3M]
- 2026-11-18 Add living module docs: build, stale status and block-preserving update (`48ecb29`, feature/low) [chg_01M7Q25DAST6TZ3PRM841TFGJS]
- 2026-11-18 Redact passwords in connection-string URLs while keeping user and host (`df4eeb5`, security/low) [chg_01M7Q1WZFYH4RD9FGZ11JB65N0]
- 2026-11-18 Add issue records: new, close, GitHub import, and bidirectional auto-linking (`357f763`, feature/medium) [chg_01M7Q1VB3WQCTDM0MXKBBF04DA]
- 2026-11-18 Add local SQLite index with FTS5 plus why/related/search and semantic fusion (`13e061f`, feature/medium) [chg_01M7Q1T5WDXW6H33ZAA1MBB8JK]
- 2026-11-18 Add embedders, JSON mode flag, and shared generate() to providers (`5dae036`, feature/medium) [chg_01M7Q1RXJK8BYWTCVWHS4XFQQA]
- 2026-11-18 Extend issue record schema and add search config / state dir (`cd58975`, feature/medium) [chg_01M7Q1SGRVAHX9FTJQQA5SVWF3]
- 2026-11-18 Add tree-sitter symbol anchoring for TS/JS, Python and Go (`39b6c95`, feature/low) [chg_01M7Q1R7XNKFTKR4RPTX73EFAZ]
<!-- ledger:end recent -->
