---
id: chg_01M7Q1MXAMBJMAXNV7TH4YQCEE
type: change
title: Add non-blocking post-commit/post-merge git hooks with install/uninstall
commit: 2a77066
author: ikcyrils@gmail.com
date: 2026-11-18T17:49:16+08:00
category: feature
risk: medium
issues: []
files: [ packages/core/src/hooks.ts, packages/core/src/index.ts ]
symbols: [ hookPaths, installHooks, uninstallHooks, checkLicense ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
Adds `packages/core/src/hooks.ts` with `installHooks` and `uninstallHooks`. It writes POSIX sh stubs for `post-commit` and `post-merge` into the git hooks directory resolved via `git rev-parse --git-path hooks`, preserving `core.hooksPath`. Each stub records the current `HEAD` by backgrounding the supplied CLI argv with `nohup ... &`, appending to `<git-dir>/<BIN_NAME>-hook.log`, and always `exit 0` so git is never blocked. Installation refuses to overwrite existing hooks that do not contain the managed marker; uninstall removes only marked hooks. It also creates `packages/core/src/index.ts` as a barrel exporting existing modules plus `checkLicense()`, a no-op stub with a Milestone 3 comment about verifying an offline Ed25519-signed license.

## Why
The commit message states: "Add post-commit/post-merge hooks that never block git." The implementation matches by writing non-blocking sh stubs that background the CLI `record` command and `exit 0`, while refusing foreign hooks and only removing managed ones. The `checkLicense()` stub is explained by its own comment as a future Milestone 3 license-verification hook; no issue references are provided.

## Impact / blast radius
Repositories using `installHooks` will execute shell scripts in `.git/hooks` on post-commit and post-merge. Those scripts run the caller-supplied CLI argv in the background and cannot block git because they always exit 0. Existing unmanaged hooks are left intact and cause installation to fail rather than be overwritten; uninstall only deletes files containing the managed marker. Security-relevant effects: the feature installs executable code in git's hook path, so callers must pass a trusted command; the script single-quote-escapes argv for POSIX sh, but hook-directory manipulation or a malicious command argument could still execute code during git operations. This diff itself does not persist new data; it invokes the existing `record` command and writes a background log inside the git directory.

## Testing notes
No tests were added in this diff. Recommended tests: temp-repo installation creates both hooks with the managed marker, shebang, `exit 0`, and executable mode; `core.hooksPath` is respected; pre-existing foreign hooks cause refusal without modification; `uninstallHooks` removes only managed hooks; generated scripts quote command args containing spaces/single quotes correctly; `git rev-parse HEAD` failure still exits 0; background invocation lands in `<git-dir>/<BIN_NAME>-hook.log`; and hook execution returns immediately without blocking the git operation.
