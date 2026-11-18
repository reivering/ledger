import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Language, Parser, type Node } from 'web-tree-sitter';
import { git } from './git.js';

// Grammar .wasm files are vendored in packages/core/grammars; nothing is fetched at runtime.
const GRAMMAR_BY_EXT: Record<string, string> = {
  ts: 'typescript', mts: 'typescript', cts: 'typescript',
  tsx: 'tsx', js: 'tsx', jsx: 'tsx', mjs: 'tsx', cjs: 'tsx',
  py: 'python', go: 'go',
};
const MAX_SOURCE = 2_000_000;

let ready: Promise<void> | undefined;
const languages = new Map<string, Promise<Language>>();

async function parserFor(path: string): Promise<Parser | null> {
  const grammar = GRAMMAR_BY_EXT[extname(path).slice(1).toLowerCase()];
  if (!grammar) return null;
  await (ready ??= Parser.init());
  let lang = languages.get(grammar);
  if (!lang) {
    lang = Language.load(fileURLToPath(new URL(`../grammars/tree-sitter-${grammar}.wasm`, import.meta.url)));
    languages.set(grammar, lang);
  }
  const parser = new Parser();
  parser.setLanguage(await lang);
  return parser;
}

const FN_VALUES = new Set(['arrow_function', 'function_expression', 'function', 'class']);

/** Name contributed by a declaration node to a qualified symbol, or null if it isn't one. */
function declName(n: Node): string | null {
  const name = n.childForFieldName('name')?.text ?? null;
  switch (n.type) {
    case 'function_declaration': // ts/js + go
    case 'generator_function_declaration':
    case 'class_declaration':
    case 'abstract_class_declaration':
    case 'interface_declaration':
    case 'enum_declaration':
    case 'type_alias_declaration':
    case 'method_definition':
    case 'function_definition': // python
    case 'class_definition':
    case 'type_spec': // go
      return name;
    case 'variable_declarator': // const f = () => {}
    case 'public_field_definition': // class field arrow functions
    case 'field_definition':
      return FN_VALUES.has(n.childForFieldName('value')?.type ?? '') ? name : null;
    case 'method_declaration': {
      // go: func (c *Client) Do() -> Client.Do
      const recv = n.childForFieldName('receiver')?.descendantsOfType('type_identifier')[0]?.text;
      return name && recv ? `${recv}.${name}` : name;
    }
    default:
      return null;
  }
}

/** Qualified enclosing symbols (e.g. `AuthClient.request`) for 1-based lines. null = language unsupported. */
export async function enclosingSymbols(path: string, source: string, lines: number[]): Promise<string[] | null> {
  const parser = await parserFor(path);
  if (!parser) return null;
  const tree = source.length > MAX_SOURCE ? null : parser.parse(source);
  const found = new Set<string>();
  for (const line of tree ? lines : []) {
    const names: string[] = [];
    for (let n: Node | null = tree?.rootNode.descendantForPosition({ row: line - 1, column: 0 }) ?? null; n; n = n.parent) {
      const name = declName(n);
      if (name) names.unshift(name);
    }
    if (names.length) found.add(names.join('.'));
  }
  tree?.delete();
  parser.delete();
  return [...found];
}

export interface SymbolRange {
  name: string; // qualified, same scheme as enclosingSymbols
  line: number; // 1-based
  endLine: number;
  hash: string; // content hash of the declaration's source text
}

export const contentHash = (text: string): string => createHash('sha256').update(text).digest('hex').slice(0, 16);

/** Every declaration in a file with its line range and content hash. null = language unsupported. */
export async function listSymbols(path: string, source: string): Promise<SymbolRange[] | null> {
  const parser = await parserFor(path);
  if (!parser) return null;
  const out: SymbolRange[] = [];
  const tree = source.length > MAX_SOURCE ? null : parser.parse(source);
  const walk = (n: Node, prefix: string[]): void => {
    const name = declName(n);
    const names = name ? [...prefix, name] : prefix;
    if (name) out.push({ name: names.join('.'), line: n.startPosition.row + 1, endLine: n.endPosition.row + 1, hash: contentHash(n.text) });
    for (const c of n.namedChildren) if (c) walk(c, names);
  };
  if (tree) walk(tree.rootNode, []);
  tree?.delete();
  parser.delete();
  return out;
}

/** New-side (added) and old-side (removed) line numbers touched by one file's unified diff. */
export function changedLines(fileDiff: string): { added: number[]; removed: number[] } {
  const added: number[] = [];
  const removed: number[] = [];
  let a = 0;
  let r = 0;
  let inHunk = false;
  for (const line of fileDiff.split('\n')) {
    const h = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (h) {
      r = Number(h[1]);
      a = Number(h[2]);
      inHunk = true;
    } else if (!inHunk) continue;
    else if (line.startsWith('+')) added.push(a++);
    else if (line.startsWith('-')) removed.push(r++);
    else if (line.startsWith(' ')) {
      a++;
      r++;
    }
  }
  return { added, removed };
}

const show = (root: string, spec: string): string => {
  try {
    return git(root, ['show', spec]);
  } catch {
    return '';
  }
};

/** Symbols touched by a commit: added lines against the new file, removed lines against the old one. */
export async function anchorSymbols(
  root: string,
  c: { sha: string; base: string; lines: { path: string; added: number[]; removed: number[] }[] },
): Promise<string[]> {
  const out = new Set<string>();
  for (const { path, added, removed } of c.lines) {
    for (const [rev, lines] of [[c.sha, added], [c.base, removed]] as const) {
      if (!lines.length) continue;
      for (const s of (await enclosingSymbols(path, show(root, `${rev}:${path}`), lines)) ?? []) out.add(s);
    }
  }
  return [...out];
}
