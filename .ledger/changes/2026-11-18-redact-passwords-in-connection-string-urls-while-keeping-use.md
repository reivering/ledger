---
id: chg_01M7Q1WZFYH4RD9FGZ11JB65N0
type: change
title: Redact passwords in connection-string URLs while keeping user and host
commit: df4eeb5
author: ikcyrils@gmail.com
date: 2026-11-18T17:58:41+08:00
category: security
risk: low
issues: []
files: [ packages/core/src/redact.ts, packages/core/test/redact.test.ts ]
symbols: [ redact ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
Added a `URL_CREDENTIALS` regex to `packages/core/src/redact.ts` that matches `scheme://user:password@host` connection-string URLs and replaces only the password segment with `[REDACTED:url_password]`, preserving the scheme, username, and host for context. A negative lookahead `(?!\[REDACTED:)` prevents double-redacting already-redacted values. The replacement runs inside `redact()` after the known-pattern loop and before custom/env/quoted assignments, inserting the literal placeholder in place of the captured password. Added a test in `packages/core/test/redact.test.ts` covering a `postgres://` URL with special characters in the password (`S3cret!@`), and negative cases ensuring `https://example.com/a:b` path segments and `mailto:x@y.z` addresses without a `user:pass@` form are left untouched.

## Why
Connection strings embedded in source code carry credentials in `user:password@` URL form, which the pre-existing secret patterns (env-style `KEY=value`, quoted assignments, known secret types) did not catch, so literal passwords could pass through `redact()` unredacted. Stated in the commit message: "scheme://user:[REDACTED:url_password]@host credentials in source were sent unredacted. User and host are kept as context."

## Impact / blast radius
`redact()` output now masks URL-embedded passwords as `[REDACTED:url_password]` while preserving scheme/user/host, so redacted logs, reports, or committed output retain host and user context but no longer leak connection-string passwords. Only outputs containing `scheme://user:pass@host` patterns are affected; malformed or already-redacted input is unchanged. No API signature changes; `redact` remains a pure string transform with no persistence or network effects.

## Testing notes
Added test 'connection-string passwords, keeping user and host' asserting `postgres://app:S3cret!@db.internal:5432/pay` redacts to `postgres://app:[REDACTED:url_password]@db.internal:5432/pay` and that `https://example.com/a:b` and `mailto:x@y.z` are untouched. The existing 'does not double-redact' test continues to cover idempotence against other patterns. Further worth testing: credentials already containing `[REDACTED:...]` are not double-redacted, non-ASCII or empty passwords, URLs with ports without passwords (`host:5432/pay`), and userinfo containing `@` or quoted `@` characters.
