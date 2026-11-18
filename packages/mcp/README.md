# Ledger MCP server

`ledger mcp` runs a **read-only** stdio MCP server over the current repo's `.ledger/`.
It never calls an AI provider and never touches the network: it only reads the local index
(`.ledger/.cache/index.db`, rebuilt automatically from `.ledger/` when missing or stale).

| Tool | Input | Use it |
|---|---|---|
| `ledger_related` | `{ files: string[] }` | **Before editing files**: past changes and bugs touching them |
| `ledger_why` | `{ path, line?, symbol? }` | Intent/history behind a file or symbol; `warnings` = past bugs |
| `ledger_search` | `{ query, limit? }` | Free-text questions when you don't know the file |
| `ledger_get_record` | `{ id }` | Full record by `chg_…`, `iss_…` or `#142` |
| `ledger_recent` | `{ limit?, type? }` | Orientation in an unfamiliar repo |

Every result carries record ids and `record_path`, so agents can cite them.

The server needs the repo root: it uses its working directory, or `--root <path>`.
Below, `ledger` must be on `PATH` (from this monorepo: `pnpm build && pnpm --filter @ledger/cli link --global`),
or replace it with `node /abs/path/to/packages/cli/dist/index.js`.

## Claude Code

```sh
# in the repo; project scope writes .mcp.json so the whole team gets it
claude mcp add --scope project ledger -- ledger mcp
```

Equivalent `.mcp.json`:

```json
{ "mcpServers": { "ledger": { "command": "ledger", "args": ["mcp"] } } }
```

Optional, in `CLAUDE.md`: *"Before modifying a file, call `ledger_related` with the files you plan to edit."*

## Cursor

`.cursor/mcp.json` in the repo:

```json
{ "mcpServers": { "ledger": { "command": "ledger", "args": ["mcp", "--root", "${workspaceFolder}"] } } }
```

## VS Code (GitHub Copilot agent mode)

`.vscode/mcp.json` in the repo:

```json
{ "servers": { "ledger": { "type": "stdio", "command": "ledger", "args": ["mcp", "--root", "${workspaceFolder}"] } } }
```
