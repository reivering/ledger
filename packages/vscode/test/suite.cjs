// Runs inside the VS Code extension host against the fixture from run.mjs.
const vscode = require('vscode');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const until = async (fn, ms, what) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 100));
  }
};
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

exports.run = async () => {
  const root = process.env.LEDGER_FIXTURE;
  const api = await vscode.extensions.getExtension('ledger.ledger-vscode').activate();
  await until(() => api.state() === 'ready', 30000, 'engine ready');
  assert.match(api.statusText(), /Ledger: \d+ records?/);

  const uri = vscode.Uri.file(path.join(root, 'src/auth.ts'));
  const doc = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(doc);
  const line = doc.getText().split('\n').findIndex((l) => l.includes('function refreshToken'));

  // CodeLens counts match `ledger why` for the same symbol.
  const lenses = await until(async () => {
    const l = await vscode.commands.executeCommand('vscode.executeCodeLensProvider', uri);
    return l && l.some((x) => x.range.start.line === line) ? l : null;
  }, 20000, 'codelens');
  const why = JSON.parse(execFileSync('node', [process.env.LEDGER_CLI, 'why', 'src/auth.ts#refreshToken', '--json', '--no-ai'], { cwd: root, encoding: 'utf8' }));
  const lens = lenses.find((x) => x.range.start.line === line);
  assert.equal(lens.command.title, `${plural(why.anchored.length, 'change')} · ${plural(why.issues.length, 'bug')} · Why?`);
  assert.equal(lens.command.title, '2 changes · 1 bug · Why?');
  assert.ok(lenses.some((x) => x.range.start.line === 0), 'AuthClient has a lens');

  // Hover shows records and the linked bug.
  const hovers = await vscode.commands.executeCommand('vscode.executeHoverProvider', uri, new vscode.Position(line + 1, 4));
  const hoverText = hovers.flatMap((h) => h.contents.map((c) => c.value ?? String(c))).join('\n');
  assert.match(hoverText, /#1\*\* \(resolved \d{4}-\d\d-\d\d\): Login times out under load/);

  // Editing refreshToken shows the repeat-bug warning with a "Show issue" quick fix.
  await editor.edit((e) => e.insert(new vscode.Position(line + 1, 0), '  // tweak\n'));
  const diags = await until(() => {
    const d = vscode.languages.getDiagnostics(uri).filter((x) => x.source === 'ledger');
    return d.length ? d : null;
  }, 10000, 'warning diagnostic');
  assert.equal(diags.length, 1);
  assert.equal(diags[0].severity, vscode.DiagnosticSeverity.Warning);
  assert.equal(diags[0].range.start.line, line);
  assert.match(diags[0].message, /^Previously caused #1 \(Login times out under load\)\. Root cause: Fake root cause/);
  const actions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', uri, diags[0].range);
  assert.ok(actions.some((a) => a.title === 'Show issue #1'), 'Show issue action');

  // Editing a symbol with no bug adds no warning.
  await editor.edit((e) => e.insert(new vscode.Position(2, 0), '    // other\n'));
  await new Promise((r) => setTimeout(r, 600));
  assert.equal(vscode.languages.getDiagnostics(uri).filter((x) => x.source === 'ledger').length, 1);

  // Sidebar timeline lists records.
  assert.ok((await api.timeline()).length >= 3);

  // Killing the engine: error state, then an automatic restart.
  const pid = api.pid();
  process.kill(pid, 'SIGKILL');
  await until(() => api.state() === 'error', 5000, 'error state');
  assert.match(api.statusText(), /engine error/);
  await until(() => api.state() === 'ready' && api.pid() !== pid, 15000, 'engine restart');

  await vscode.commands.executeCommand('workbench.action.files.revert');
};
