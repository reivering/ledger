# Ledger check (GitHub Action)

Runs `ledger check` on the pull request diff and keeps **one** summary comment up to date
(it finds its own comment by a hidden marker and edits it on re-runs).

```yaml
on: pull_request
permissions: { contents: read, pull-requests: write }
jobs:
  ledger:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }          # the check diffs base..head
      - uses: <owner>/<repo>/packages/action@main
        with: { fail-on: critical }       # optional; default never fails
```

`dist/` is a self-contained bundle (`pnpm --filter @ledger/action build`), including the tree-sitter
grammars, so the action needs no install step.
