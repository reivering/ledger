# Ledger for VS Code

Shows the repository's engineering memory (`.ledger/`) where you work:

- **CodeLens** above functions/classes with history: `4 changes · 1 bug · Why?`
- **Hover**: the last records and any linked bug for the symbol under the cursor
- **Repeat-bug warnings**: editing code linked to a resolved bug shows a warning with the root cause and a *Show issue* quick fix
- **Timeline** sidebar with type/category/risk filters, plus stale module docs
- Commands: *Why is this code like this?*, *Search*, *Record last commit*, *Open record*, *Reindex*

Requires the `ledger` CLI (setting `ledger.path`, default `ledger` on `PATH`). The extension spawns
`ledger serve --stdio` and loads no native modules itself. Works in VS Code, Cursor, Windsurf and other forks
(install the `.vsix`).
