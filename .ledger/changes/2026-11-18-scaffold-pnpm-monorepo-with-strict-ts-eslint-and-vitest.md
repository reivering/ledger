---
id: chg_01M7Q1H2257PXB375366T5XTG5
type: change
title: Scaffold pnpm monorepo with strict TS, ESLint, and Vitest
commit: 2bd8599
author: ikcyrils@gmail.com
date: 2026-11-18T17:49:16+08:00
category: chore
risk: low
issues: []
files: [ .gitignore, eslint.config.js, package.json, packages/cli/package.json, packages/cli/tsconfig.json, packages/core/package.json, packages/core/tsconfig.json, pnpm-lock.yaml, pnpm-workspace.yaml, tsconfig.base.json, tsconfig.json, vitest.config.ts ]
symbols: []
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
Initial repository scaffolding: added pnpm workspace (`pnpm-workspace.yaml`, `packages/*`), root `package.json` with build/typecheck/lint/test/check scripts, shared strict TypeScript config (`tsconfig.base.json`, root `tsconfig.json`), ESLint flat config using typescript-eslint strict, Vitest config with workspace test discovery, `.gitignore` for `node_modules/`, `dist/`, and `*.tsbuildinfo`, plus two workspace packages: `@ledger/core` (deps: yaml, zod) and `@ledger/cli` (bin `ledger`, depends on `@ledger/core`). Package lockfile `pnpm-lock.yaml` generated.

## Why
Not stated.

## Impact / blast radius
No application logic, auth, data, or money movement exists yet. Blast radius is limited to developer tooling: future package code must conform to strict TS (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax`), type NodeNext ESM, pass `lint`, `typecheck`, and `test` gates. Builds output declarations and sourcemaps to per-package `dist/`. Requires pnpm lockfile version compatibility with Node >=22.

## Testing notes
No tests were added (no `test/` directories yet). Vitest is configured to run `packages/*/test/**/*.test.ts` with a 30s timeout; the `test` script runs `pnpm build` first, so future tests execute against built output in `dist/`. To validate this scaffold, running `pnpm check` (lint + typecheck + build + vitest) should pass with zero source files present; CI should verify this and add unit tests once package source lands.
