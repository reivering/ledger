---
id: chg_01M7Q1R7XNKFTKR4RPTX73EFAZ
type: change
title: Add tree-sitter symbol anchoring for TS/JS, Python and Go
commit: 39b6c95
author: ikcyrils@gmail.com
date: 2026-11-18T17:50:54+08:00
category: feature
risk: low
issues: []
files: [ packages/core/grammars/tree-sitter-go.wasm, packages/core/grammars/tree-sitter-python.wasm, packages/core/grammars/tree-sitter-tsx.wasm, packages/core/grammars/tree-sitter-typescript.wasm, packages/core/package.json, packages/core/src/symbols.ts, packages/core/test/symbols.test.ts, pnpm-lock.yaml ]
symbols: [ parserFor, declName, enclosingSymbols, changedLines, show, anchorSymbols ]
generated_by: { provider: openai, model: IFM/K2-Horizon-375B-A23B }
reviewed: false
---

## What changed
New packages/core/src/symbols.ts module that uses web-tree-sitter (vendored .wasm grammars for typescript, tsx, python, go) to compute qualified enclosing symbols (e.g. `AuthClient.request`, `Repo.save`, `Client.Do`) at 1-based line numbers. Adds `enclosingSymbols` (returns null for unsupported languages or oversized sources), `changedLines` (parses unified diff hunks into added/removed 1-based line numbers), and `anchorSymbols` (maps a commit's added lines to the new file and removed lines to the old via `git show`). Vendored four grammar .wasm files under packages/core/grammars, added web-tree-sitter ^0.27.2 dependency, and added packages/core/test/symbols.test.ts.

## Why
Commit message: add tree-sitter symbol anchoring for TS/JS, Python and Go; grammar .wasm files are vendored; unsupported languages fall back to file-level anchoring (null) without failing. The source comments state grammars are vendored and nothing is fetched at runtime.

## Impact / blast radius
Adds a new module and new exports; no existing source files are modified, so no existing callers change behavior. Runtime reads code content via `git show` and parses it with wasm grammars in-process; a 2 MB source cap guards against oversized inputs. Unsupported languages or missing grammars return null (file-level anchor fallback) rather than throwing. No data writes, auth, or network access introduced.

## Testing notes
New test file packages/core/test/symbols.test.ts covers: TS method qualification by class, functions, arrow-function consts, and empty results; JSX function components; Python method qualification (Repo.save); Go receiver-qualified methods (Client.Do) and free functions; graceful null fallback for unsupported language (a.rb); and changedLines hunk parsing (added [3,4], removed [3]) against a sample unified diff. No existing tests changed.
