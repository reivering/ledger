# .ledger/ — engineering memory

This folder is written by Ledger. It is the source of truth for *how and why*
this codebase changed, and it lives in the repo so it is versioned, reviewed and
audited with the code. Nothing here is stored anywhere else.

- `changes/` — one Markdown record per recorded commit (what changed, why, impact, testing).
- `issues/` — incident / bug records: symptom, root cause, fix commits, affected files.
- `docs/` — longer-lived notes.
- `state/` — importer sync cursors (e.g. last GitHub sync), committed so the team shares them.
- `config.yaml` — AI provider, model, redaction patterns, categories. No secrets.

Records are plain Markdown with YAML front-matter. Edit them freely in a PR; set
`reviewed: true` once a human has checked a generated record.
`.ledger/.cache/` is a local search cache: gitignored and rebuildable.

Secrets are redacted before any text is sent to the configured AI provider.
