import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildDoc, check, closeIssue, docsStatus, fileSummary, updateDoc, whyQuery } from '../src/index.js';
import { AUTH_V2, seededRepo } from './fixture.js';

let repo: Awaited<ReturnType<typeof seededRepo>> | undefined;
afterEach(() => repo?.cleanup());

const resolvedRepo = async () => {
  const r = (repo = await seededRepo());
  await closeIssue(r.dir, '1', r.fixSha);
  r.commit('record fix');
  return r;
};

describe('check', () => {
  it('--staged reports the past bug on refreshToken, and nothing for an unrelated symbol', async () => {
    const r = await resolvedRepo();
    r.write('src/auth.ts', AUTH_V2.replace('await backoff();', 'await backoff(2);'));
    r.git('add', '-A');
    const findings = await check(r.dir, { staged: true });
    expect(findings).toEqual([expect.objectContaining({ severity: 'high', kind: 'repeat-bug', path: 'src/auth.ts', symbol: 'refreshToken' })]);
    expect(findings[0]!.message).toMatch(/^src\/auth\.ts#refreshToken previously caused #1 \(resolved \d{4}-\d\d-\d\d\): Login times out under load\. Root cause: Fake root cause/);

    r.write('src/auth.ts', AUTH_V2.replace('return 1;', 'return 2;'));
    r.git('add', '-A');
    expect(await check(r.dir, { staged: true })).toEqual([]);
  });

  it('--range and --diff map lines the same way', async () => {
    const r = await resolvedRepo();
    r.write('src/auth.ts', AUTH_V2.replace("return 'token';", "return 'token2';"));
    const diff = r.git('diff');
    expect((await check(r.dir, { diff })).map((f) => f.symbol)).toEqual(['refreshToken']);
    r.commit('tweak');
    expect((await check(r.dir, { range: 'HEAD~1..HEAD' })).map((f) => f.symbol)).toEqual(['refreshToken']);
  });
});

it('fileSummary counts equal `why` for every symbol', async () => {
  const r = await resolvedRepo();
  const s = await fileSummary(r.dir, 'src/auth.ts');
  expect(s.symbols.map((x) => [x.name, x.changes, x.bugs])).toEqual([['AuthClient', 1, 0], ['AuthClient.request', 1, 0], ['refreshToken', 2, 1]]);
  for (const x of s.symbols) {
    const w = await whyQuery(r.dir, r.dir, `src/auth.ts#${x.name}`);
    expect([w.anchored.length, w.issues.length]).toEqual([x.changes, x.bugs]);
  }
  expect(s.symbols[2]!.issues[0]).toMatchObject({ external_id: '#1', status: 'resolved', root_cause: expect.stringContaining('Fake root cause') });
});

describe('living docs', () => {
  it('build → edit anchored fn → stale (also a check finding) → update keeps human text and clears it', async () => {
    const r = await resolvedRepo();
    const doc = await buildDoc(r.dir, 'src');
    expect(doc).toMatchObject({ module: 'src', path: '.ledger/docs/modules/src.md' });
    const file = join(r.dir, doc.path);
    let text = readFileSync(file, 'utf8');
    expect(text).toMatch(/anchors:\n {2}- \{ file: src\/auth\.ts, symbol: AuthClient, hash: \w{16} \}/);
    for (const k of ['overview', 'decisions', 'pitfalls', 'file:src/auth.ts', 'recent']) expect(text).toContain(`<!-- ledger:begin ${k} -->`);
    expect(text).toMatch(/⚠ #1 Login times out under load \(resolved, high\) \[iss_/);
    const human = 'Team note: never call refreshToken from a hot loop.';
    writeFileSync(file, text.replace('## Files', `${human}\n\n## Files`));
    expect((await docsStatus(r.dir))[0]).toMatchObject({ stale: false, changes: [] });

    r.write('src/auth.ts', AUTH_V2.replace("return 'token';", "return 'fresh';"));
    expect((await docsStatus(r.dir))[0]).toMatchObject({ stale: true, changes: [{ file: 'src/auth.ts', symbol: 'refreshToken', change: 'changed' }] });
    expect(await check(r.dir)).toContainEqual(expect.objectContaining({ severity: 'info', kind: 'stale-doc', message: expect.stringContaining('ledger docs update src') }));

    const before = readFileSync(file, 'utf8');
    expect(await updateDoc(r.dir, 'src')).toMatchObject({ regenerated: ['file:src/auth.ts', 'recent'] });
    text = readFileSync(file, 'utf8');
    expect((await docsStatus(r.dir))[0]!.stale).toBe(false);
    expect(text).toContain(human);
    const overview = (s: string) => /<!-- ledger:begin overview -->[\s\S]*?<!-- ledger:end overview -->/.exec(s)?.[0];
    expect(overview(text)).toBe(overview(before)); // untouched block
    expect(await updateDoc(r.dir, 'src')).toMatchObject({ regenerated: [] });
  });
});
