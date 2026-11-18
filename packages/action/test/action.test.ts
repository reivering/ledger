import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { closeIssue } from '../../core/src/index.js';
import { AUTH_V2, env, seededRepo } from '../../core/test/fixture.js';

const BUNDLE = fileURLToPath(new URL('../dist/index.js', import.meta.url));
let repo: Awaited<ReturnType<typeof seededRepo>> | undefined;
afterEach(() => repo?.cleanup());

/** Minimal fake of the GitHub comments API, holding state across runs. */
function fakeGitHub() {
  const comments: { id: number; body: string }[] = [];
  const calls: string[] = [];
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (d) => (raw += d));
    req.on('end', () => {
      calls.push(`${req.method} ${req.url}`);
      const body = raw ? (JSON.parse(raw) as { body: string }) : undefined;
      let out: unknown = comments;
      if (req.method === 'POST') comments.push((out = { id: comments.length + 100, body: body!.body }) as { id: number; body: string });
      if (req.method === 'PATCH') {
        const c = comments.find((x) => req.url?.endsWith(`/comments/${x.id}`))!;
        c.body = body!.body;
        out = c;
      }
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(out));
    });
  });
  return { server, comments, calls };
}

const runBundle = (vars: Record<string, string>) =>
  new Promise<number>((resolve) => {
    const p = spawn(process.execPath, [BUNDLE], { env: { ...env, ...vars }, stdio: 'inherit' });
    p.on('exit', (c) => resolve(c ?? 1));
  });

it('bundled action posts one PR comment and updates it in place on re-run', async () => {
  const r = (repo = await seededRepo());
  await closeIssue(r.dir, '1', r.fixSha);
  r.commit('records');
  const base = r.git('rev-parse', 'HEAD').trim();
  r.write('src/auth.ts', AUTH_V2.replace("return 'token';", "return 'other';"));
  const head = r.commit('PR change');
  const eventPath = join(r.dir, '..', `event-${Date.now()}.json`);
  writeFileSync(eventPath, JSON.stringify({ pull_request: { number: 7, base: { sha: base }, head: { sha: head } } }));

  const gh = fakeGitHub();
  await new Promise<void>((ok) => gh.server.listen(0, '127.0.0.1', ok));
  const port = (gh.server.address() as { port: number }).port;
  const vars = { GITHUB_EVENT_PATH: eventPath, GITHUB_WORKSPACE: r.dir, GITHUB_REPOSITORY: 'acme/pay', GITHUB_API_URL: `http://127.0.0.1:${port}`, 'INPUT_GITHUB-TOKEN': 't' };
  try {
    expect(await runBundle(vars)).toBe(0);
    expect(await runBundle({ ...vars, 'INPUT_FAIL-ON': 'high' })).toBe(1);
  } finally {
    gh.server.close();
  }
  expect(gh.comments).toHaveLength(1);
  expect(gh.calls.filter((c) => !c.startsWith('GET'))).toEqual(['POST /repos/acme/pay/issues/7/comments', 'PATCH /repos/acme/pay/issues/comments/100']);
  expect(gh.comments[0]!.body).toMatch(/<!-- ledger-check -->\n### Ledger check\n\n1 finding/);
  expect(gh.comments[0]!.body).toContain('previously caused #1');
  expect(execFileSync('git', ['status', '--porcelain'], { cwd: r.dir, encoding: 'utf8' })).not.toContain('src/');
});
