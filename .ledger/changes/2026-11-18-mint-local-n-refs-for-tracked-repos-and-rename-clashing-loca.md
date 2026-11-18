---
id: chg_01M7Q6E47TJ2CB5C5VPXS5BVPG
type: change
title: Mint LOCAL-N refs for tracked repos and rename clashing local issues on GitHub import
commit: "1071794"
author: ikcyrils@gmail.com
date: 2026-11-18T19:24:45+08:00
category: feature
risk: low
issues: []
files: [ packages/cli/src/index.ts, packages/core/src/issues.ts ]
symbols: [ main, nextLocalRef, newIssue, importIssues, nextLocalNumber ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
Replaced nextLocalNumber with nextLocalRef: plain repos still mint #N, while repos with a GitHub remote or previously imported non-local issues mint LOCAL-N. importIssues now detects a local issue whose external_id collides with an incoming GitHub issue, rewrites that local record to the next LOCAL-N ref, records the old and new refs in a returned renamed list, and the CLI prints each rename.

## Why
Commit message states local #N collided with GitHub #N; repos with a GitHub remote or imported issues now mint LOCAL-N, and importing a GitHub issue whose number a local issue already uses renames the local one because links are by id and survive.

## Impact / blast radius
Caller/CLI impact is narrow: the import command now surfaces renamed locals after the existing created/updated summary. Data model impact is additive and identifier-shaping: new local issues may receive LOCAL-N instead of #N once a repo is considered tracked, and an existing local issue can be rewritten to a new external_id during GitHub import when its number clashes; id-based links are claimed to survive, but human/text references to the old #N may become stale outside commit-ref matching. No security, auth, or compliance-relevant surface is introduced.

## Testing notes
No tests were included in this diff. Should cover nextLocalRef choosing #N for plain repos versus LOCAL-N with an imported issue or GitHub remote, collision handling when importIssues meets an existing local external_id, the new renamed return field, and CLI output printing each rename.
