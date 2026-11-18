import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { DocStatus, Hit, SymbolSummary, WhyAnswer } from '@ledger/core';
import { connect } from '@ledger/core/rpc';
import * as vscode from 'vscode';

type State = 'none' | 'starting' | 'ready' | 'error';
type Summary = { path: string; symbols: SymbolSummary[] };
const cfg = () => vscode.workspace.getConfiguration('ledger');
const plural = (n: number, w: string): string => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Owns the `ledger serve --stdio` child process. Restarts it when it dies; the extension itself loads no native code. */
class Engine {
  state: State = 'none';
  detail = ''; // record count when ready, error message when not
  proc?: ChildProcess;
  private rpc?: ReturnType<typeof connect>;
  private restarts = 0;
  private stopped = false;
  readonly changed = new vscode.EventEmitter<void>();

  constructor(readonly root: string, private readonly onState: () => void) {}

  start(): void {
    const bin = cfg().get<string>('path') || 'ledger';
    // A .js path (e.g. a source checkout) runs under the `node` on PATH, never inside the extension host.
    const [cmd, args] = bin.endsWith('.js') ? ['node', [bin]] : [bin, []];
    this.set('starting');
    const proc = spawn(cmd, [...args, 'serve', '--stdio'], { cwd: this.root, stdio: ['pipe', 'pipe', 'pipe'] });
    this.proc = proc;
    let stderr = '';
    proc.stderr?.on('data', (d: Buffer) => (stderr = (stderr + d.toString()).slice(-2000)));
    proc.on('error', (e) => this.fail(proc, e.message));
    proc.on('exit', (code, signal) => this.fail(proc, `engine exited (${signal ?? code})${stderr ? `: ${stderr.trim().split('\n').pop()}` : ''}`));
    if (!proc.stdout || !proc.stdin) return;
    this.rpc = connect(proc.stdout, proc.stdin, (method) => method === 'ledger/indexChanged' && this.changed.fire());
    this.request<{ records: number }>('status').then(
      (s) => {
        this.restarts = 0;
        this.detail = `${plural(s.records, 'record')}`;
        this.set('ready');
        this.changed.fire();
      },
      (e: Error) => this.fail(proc, e.message),
    );
  }

  private fail(proc: ChildProcess, message: string): void {
    if (proc !== this.proc || this.stopped) return;
    this.proc = undefined;
    this.rpc = undefined;
    this.detail = message;
    this.set('error');
    // ponytail: fixed backoff, 5 tries; `Ledger: Restart engine` resets it.
    if (this.restarts++ < 5) setTimeout(() => !this.stopped && !this.proc && this.start(), 1000 * this.restarts);
  }

  restart(): void {
    this.restarts = 0;
    const p = this.proc;
    this.proc = undefined;
    p?.kill();
    this.start();
  }

  stop(): void {
    this.stopped = true;
    this.proc?.kill();
  }

  private set(s: State): void {
    this.state = s;
    this.onState();
  }

  request<T>(method: string, params: unknown = {}): Promise<T> {
    if (!this.rpc) return Promise.reject(new Error(`Ledger engine not running: ${this.detail}`));
    return this.rpc.request<T>(method, params);
  }
}

export function activate(context: vscode.ExtensionContext) {
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  status.command = 'ledger.restartEngine';
  status.show();
  context.subscriptions.push(status);
  const folder = vscode.workspace.workspaceFolders?.find((f) => existsSync(join(f.uri.fsPath, '.ledger', 'config.yaml')));
  if (!folder) {
    status.text = '$(circle-slash) Ledger: no .ledger';
    status.tooltip = 'Run `ledger init` in this repository to start recording.';
    return { state: () => 'none' as State };
  }
  const root = folder.uri.fsPath;
  const rel = (uri: vscode.Uri): string => relative(root, uri.fsPath).split('\\').join('/');
  const inRepo = (doc: vscode.TextDocument): boolean => doc.uri.scheme === 'file' && !relative(root, doc.uri.fsPath).startsWith('..');

  const engine: Engine = new Engine(root, () => {
    const s = engine.state;
    status.text = { none: '', starting: '$(sync~spin) Ledger: indexing', ready: `$(book) Ledger: ${engine.detail}`, error: '$(error) Ledger: engine error' }[s];
    status.tooltip = s === 'error' ? `${engine.detail}\nClick to restart.` : 'Ledger engine — click to restart';
    status.backgroundColor = s === 'error' ? new vscode.ThemeColor('statusBarItem.errorBackground') : undefined;
  });
  context.subscriptions.push({ dispose: () => engine.stop() });

  // ---- per-document summaries (CodeLens, hover, warnings), keyed by document version ----
  const summaries = new Map<string, { version: number; summary: Promise<Summary> }>();
  const summaryFor = (doc: vscode.TextDocument): Promise<Summary> => {
    const key = doc.uri.toString();
    const hit = summaries.get(key);
    if (hit?.version === doc.version) return hit.summary;
    const summary = engine.request<Summary>('fileSummary', { path: rel(doc.uri), text: doc.getText() });
    summaries.set(key, { version: doc.version, summary });
    summary.catch(() => summaries.delete(key));
    return summary;
  };
  const innermost = (s: Summary, line: number): SymbolSummary | undefined =>
    s.symbols.filter((x) => x.line <= line && line <= x.endLine).sort((a, b) => a.endLine - a.line - (b.endLine - b.line))[0];

  const lensChanged = new vscode.EventEmitter<void>();
  context.subscriptions.push(vscode.languages.registerCodeLensProvider({ scheme: 'file' }, {
    onDidChangeCodeLenses: lensChanged.event,
    async provideCodeLenses(doc) {
      if (!cfg().get('codeLens.enabled', true) || !inRepo(doc) || engine.state !== 'ready') return [];
      const s = await summaryFor(doc).catch(() => null);
      return (s?.symbols ?? []).map((x) => {
        const parts = [plural(x.changes, 'change'), ...(x.bugs ? [plural(x.bugs, 'bug')] : []), 'Why?'];
        return new vscode.CodeLens(new vscode.Range(x.line - 1, 0, x.line - 1, 0), {
          title: parts.join(' · '),
          command: 'ledger.whySymbol',
          arguments: [s?.path, x.name],
        });
      });
    },
  }));

  context.subscriptions.push(vscode.languages.registerHoverProvider({ scheme: 'file' }, {
    async provideHover(doc, pos) {
      if (!cfg().get('hover.enabled', true) || !inRepo(doc) || engine.state !== 'ready') return;
      const s = await summaryFor(doc).catch(() => null);
      const x = s && innermost(s, pos.line + 1);
      if (!x) return;
      const md = new vscode.MarkdownString(`**Ledger** · \`${x.name}\`\n\n`);
      for (const i of x.issues) md.appendMarkdown(`⚠ **${i.external_id}** (${i.status}${i.resolved_at ? ` ${i.resolved_at.slice(0, 10)}` : ''}): ${i.title}\n\n`);
      for (const r of x.records) md.appendMarkdown(`- ${r.date.slice(0, 10)} · ${r.category} · ${r.title}\n`);
      return new vscode.Hover(md);
    },
  }));

  // ---- repeat-bug warnings: symbols edited since the file was opened, linked to resolved bugs ----
  const diagnostics = vscode.languages.createDiagnosticCollection('ledger');
  context.subscriptions.push(diagnostics);
  const touched = new Map<string, Set<string>>();
  const timers = new Map<string, NodeJS.Timeout>();
  const refreshWarnings = async (doc: vscode.TextDocument): Promise<void> => {
    const names = touched.get(doc.uri.toString());
    if (!cfg().get('warnings.enabled', true) || !names?.size || !doc.isDirty) return diagnostics.delete(doc.uri);
    const s = await summaryFor(doc).catch(() => null);
    diagnostics.set(doc.uri, (s?.symbols ?? []).filter((x) => names.has(x.name)).flatMap((x) =>
      x.issues.filter((i) => i.status === 'resolved').map((i) => {
        const line = doc.lineAt(x.line - 1);
        const d = new vscode.Diagnostic(
          new vscode.Range(x.line - 1, line.firstNonWhitespaceCharacterIndex, x.line - 1, line.text.length),
          `Previously caused ${i.external_id} (${i.title}).${i.root_cause ? ` Root cause: ${i.root_cause.split('\n')[0]}` : ''}`,
          vscode.DiagnosticSeverity.Warning,
        );
        d.source = 'ledger';
        d.code = { value: i.external_id, target: vscode.Uri.file(join(root, i.path)) };
        return d;
      })));
  };
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (e) => {
      if (!inRepo(e.document) || !e.contentChanges.length || engine.state !== 'ready') return;
      const key = e.document.uri.toString();
      const s = await summaryFor(e.document).catch(() => null);
      const set = touched.get(key) ?? new Set<string>();
      for (const c of e.contentChanges) {
        const first = c.range.start.line + 1;
        const last = first + c.text.split('\n').length - 1;
        for (const x of s?.symbols ?? []) if (x.line <= last && first <= x.endLine) set.add(x.name);
      }
      touched.set(key, set);
      clearTimeout(timers.get(key));
      timers.set(key, setTimeout(() => void refreshWarnings(e.document), 250));
    }),
    vscode.workspace.onDidCloseTextDocument((d) => {
      touched.delete(d.uri.toString());
      diagnostics.delete(d.uri);
    }),
    vscode.languages.registerCodeActionsProvider({ scheme: 'file' }, {
      provideCodeActions: (_doc, _range, ctx) =>
        ctx.diagnostics.filter((d) => d.source === 'ledger' && typeof d.code === 'object').map((d) => {
          const code = d.code as { value: string; target: vscode.Uri };
          const a = new vscode.CodeAction(`Show issue ${code.value}`, vscode.CodeActionKind.QuickFix);
          a.command = { title: a.title, command: 'vscode.open', arguments: [code.target] };
          a.diagnostics = [d];
          return a;
        }),
    }),
  );

  // ---- sidebar timeline ----
  const filters: { type?: string; category?: string; risk?: string } = {};
  type Node = { kind: 'record'; hit: Hit } | { kind: 'docs'; docs: DocStatus[] } | { kind: 'doc'; doc: DocStatus };
  const treeChanged = new vscode.EventEmitter<void>();
  const tree: vscode.TreeDataProvider<Node> = {
    onDidChangeTreeData: treeChanged.event,
    async getChildren(n) {
      if (engine.state !== 'ready') return [];
      if (n?.kind === 'docs') return n.docs.map((doc) => ({ kind: 'doc' as const, doc }));
      if (n) return [];
      const [recent, docs] = await Promise.all([engine.request<Hit[]>('recent', { limit: 200 }), engine.request<DocStatus[]>('docsStatus')]);
      const shown = recent.filter((h) =>
        (!filters.type || h.type === filters.type) &&
        (!filters.category || (h.type === 'change' && h.category === filters.category)) &&
        (!filters.risk || (h.type === 'change' ? h.risk : h.severity) === filters.risk));
      return [...(docs.length ? [{ kind: 'docs' as const, docs }] : []), ...shown.map((hit) => ({ kind: 'record' as const, hit }))];
    },
    getTreeItem(n) {
      if (n.kind === 'docs') {
        const stale = n.docs.filter((d) => d.stale).length;
        const t = new vscode.TreeItem(`Docs (${stale} stale)`, vscode.TreeItemCollapsibleState.Collapsed);
        t.iconPath = new vscode.ThemeIcon(stale ? 'warning' : 'book');
        return t;
      }
      if (n.kind === 'doc') {
        const t = new vscode.TreeItem(n.doc.module);
        t.description = n.doc.stale ? `stale: ${n.doc.changes.map((c) => c.symbol).join(', ')}` : 'up to date';
        t.command = { title: 'Open', command: 'vscode.open', arguments: [vscode.Uri.file(join(root, n.doc.path))] };
        return t;
      }
      const h = n.hit;
      const t = new vscode.TreeItem(h.title);
      t.description = `${h.date.slice(0, 10)} · ${h.type === 'change' ? `${h.category} · ${h.risk}` : `${h.external_id} ${h.status}`}`;
      t.iconPath = new vscode.ThemeIcon(h.type === 'issue' ? 'bug' : h.type === 'change' && h.risk === 'high' ? 'flame' : 'git-commit');
      t.command = { title: 'Open record', command: 'vscode.open', arguments: [vscode.Uri.file(join(root, h.path))] };
      return t;
    },
  };
  context.subscriptions.push(vscode.window.registerTreeDataProvider('ledger.timeline', tree));

  const refreshAll = (): void => {
    summaries.clear();
    lensChanged.fire();
    treeChanged.fire();
    for (const d of vscode.workspace.textDocuments) if (touched.has(d.uri.toString())) void refreshWarnings(d);
  };
  context.subscriptions.push(engine.changed.event(refreshAll));

  // ---- commands ----
  const showWhy = async (spec: { path: string; line?: number; symbol?: string }): Promise<void> => {
    const r = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Ledger: asking why…' }, () =>
      engine.request<WhyAnswer>('why', { ...spec, ai: true }));
    const label = `${r.target.path}${r.target.symbol ? `#${r.target.symbol}` : ''}`;
    const line = (h: Hit): string => `- ${h.date.slice(0, 10)} [${h.title}](${vscode.Uri.file(join(root, h.path))}) \`${h.id}\``;
    const content = [
      `# Why is \`${label}\` like this?`, '',
      ...r.warnings.map((w) => `> ${w}`), ...(r.warnings.length ? [''] : []),
      ...(r.anchored.length ? ['## Changes to this symbol', ...r.anchored.map(line), ''] : []),
      ...(r.file_level.length ? ['## Other changes to the file', ...r.file_level.map(line), ''] : []),
      r.answer ? `## Answer\n\n${r.answer}` : r.ai_error ? `_AI answer unavailable: ${r.ai_error}_` : '_No records touch this code yet._',
    ].join('\n');
    const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content });
    await vscode.commands.executeCommand('markdown.showPreviewToSide', doc.uri).then(undefined, () => vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside));
  };
  const openRecordPick = async (hits: Hit[], placeHolder: string): Promise<void> => {
    const pick = await vscode.window.showQuickPick(hits.map((h) => ({ label: h.title, description: `${h.date.slice(0, 10)} · ${h.id}`, h })), { placeHolder, matchOnDescription: true });
    if (pick) await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(join(root, pick.h.path)));
  };
  const cmd = (id: string, fn: (...a: never[]) => unknown): void =>
    void context.subscriptions.push(vscode.commands.registerCommand(id, async (...a: never[]) => {
      try {
        await fn(...a);
      } catch (e) {
        void vscode.window.showErrorMessage(`Ledger: ${(e as Error).message}`);
      }
    }));
  cmd('ledger.why', async () => {
    const ed = vscode.window.activeTextEditor;
    if (!ed || !inRepo(ed.document)) throw new Error('open a file in this repository first');
    await showWhy({ path: rel(ed.document.uri), line: ed.selection.active.line + 1 });
  });
  cmd('ledger.whySymbol', (path: string, symbol: string) => showWhy({ path, symbol }));
  cmd('ledger.search', async () => {
    const q = await vscode.window.showInputBox({ prompt: 'Search the ledger', placeHolder: 'e.g. token refresh timeout' });
    if (q) await openRecordPick((await engine.request<{ hits: Hit[] }>('search', { query: q, limit: 30 })).hits, `Results for "${q}"`);
  });
  cmd('ledger.openRecord', async () => openRecordPick(await engine.request<Hit[]>('recent', { limit: 100 }), 'Open a record'));
  cmd('ledger.recordLastCommit', async () => {
    const r = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Ledger: recording HEAD…' }, () =>
      engine.request<{ status: string; path?: string; reason?: string }>('record'));
    if (r.path) await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(r.path));
    else void vscode.window.showInformationMessage(`Ledger: ${r.reason ?? r.status}`);
  });
  cmd('ledger.reindex', async () => {
    const r = await engine.request<{ records: number }>('reindex');
    void vscode.window.showInformationMessage(`Ledger: indexed ${plural(r.records, 'record')}`);
    refreshAll();
  });
  cmd('ledger.restartEngine', () => engine.restart());
  cmd('ledger.filter', async () => {
    const field = await vscode.window.showQuickPick(['type', 'category', 'risk', 'clear filters'], { placeHolder: 'Filter the timeline by…' });
    if (!field) return;
    if (field === 'clear filters') Object.assign(filters, { type: undefined, category: undefined, risk: undefined });
    else {
      const values = { type: ['change', 'issue'], category: ['feature', 'bugfix', 'refactor', 'security', 'config', 'docs', 'chore'], risk: ['low', 'medium', 'high', 'critical'] }[field] ?? [];
      const value = await vscode.window.showQuickPick(['(any)', ...values], { placeHolder: `${field} =` });
      if (!value) return;
      filters[field as keyof typeof filters] = value === '(any)' ? undefined : value;
    }
    treeChanged.fire();
  });
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('ledger.path')) engine.restart();
    else if (e.affectsConfiguration('ledger')) refreshAll();
  }));

  engine.start();
  // Test/automation surface.
  return { state: () => engine.state, pid: () => engine.proc?.pid, statusText: () => status.text, timeline: () => tree.getChildren() };
}

export function deactivate(): void {}
