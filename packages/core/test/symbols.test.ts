import { describe, expect, it } from 'vitest';
import { changedLines, enclosingSymbols } from '../src/symbols.js';
import { AUTH_V1 } from './fixture.js';

describe('enclosingSymbols', () => {
  it('typescript: methods qualified by class, functions, arrow consts', async () => {
    const src = `${AUTH_V1}\nexport const retry = async () => {\n  return 2;\n};\nconst top = 1;\n`;
    expect(await enclosingSymbols('a.ts', src, [3])).toEqual(['AuthClient.request']);
    expect(await enclosingSymbols('a.ts', src, [8])).toEqual(['refreshToken']);
    expect(await enclosingSymbols('a.ts', src, [12])).toEqual(['retry']);
    expect(await enclosingSymbols('a.ts', src, [14])).toEqual([]);
    expect(await enclosingSymbols('a.jsx', 'function App() {\n  return <div/>;\n}\n', [2])).toEqual(['App']);
  });

  it('python and go', async () => {
    expect(await enclosingSymbols('m.py', 'class Repo:\n    def save(self):\n        pass\n', [3])).toEqual(['Repo.save']);
    const go = 'package x\n\nfunc (c *Client) Do() {\n\treturn\n}\n\nfunc Free() {\n}\n';
    expect(await enclosingSymbols('x.go', go, [4, 8])).toEqual(['Client.Do', 'Free']);
  });

  it('unsupported languages fall back (null), never throw', async () => {
    expect(await enclosingSymbols('a.rb', 'def x; end', [1])).toBeNull();
  });
});

it('changedLines tracks new-side additions and old-side removals', () => {
  const diff = 'diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -2,3 +2,3 @@\n ctx\n-old\n+new\n+more\n ctx\n';
  expect(changedLines(diff)).toEqual({ added: [3, 4], removed: [3] });
});
