import { z } from 'zod';
import { ENV_PREFIX } from './product.js';
import type { Config } from './store.js';

export interface Prompt {
  system: string;
  user: string;
  json?: boolean; // ask the provider for a JSON object
}
/** Takes an already-redacted prompt, returns the model's raw text. */
export type Provider = (prompt: Prompt) => Promise<string>;
/** Takes already-redacted texts, returns one vector per text. */
export type Embedder = (texts: string[]) => Promise<Float32Array[]>;

function apiKey(name: string): string {
  const v = process.env[`${ENV_PREFIX}${name}_API_KEY`];
  if (!v) throw new Error(`set ${ENV_PREFIX}${name}_API_KEY in the environment`);
  return v;
}

async function post(url: string, headers: Record<string, string>, body: unknown, timeoutMs = 300_000): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}: ${(await res.text()).slice(0, 500)}`);
  return res.json();
}

/** Offline provider for tests/CI. Returns every structured field any caller asks for; Zod strips the rest. */
export const fakeProvider =
  (category: string): Provider =>
  async ({ user, json }) => {
    if (!json) {
      const ids = [...new Set(user.match(/\b(?:chg|iss)_[0-9A-Z]{26}\b/g) ?? [])];
      return `Fake answer based on ${ids.map((i) => `[${i}]`).join(', ') || 'no records'}.`;
    }
    const requested = /## Requested keys\n(\[.*\])/.exec(user)?.[1];
    if (requested) {
      const keys = JSON.parse(requested) as string[];
      return JSON.stringify(Object.fromEntries(keys.map((k) => [k, `Fake ${k} text, see \`${k.startsWith('file:') ? k.slice(5) : 'src/'}\`.`])));
    }
    return JSON.stringify({
      title: (/## Commit message\n(.*)/.exec(user)?.[1]?.trim() || 'Untitled change').slice(0, 100),
      category,
      risk: 'low',
      symbols: [],
      what_changed: 'Recorded offline by the fake provider.',
      why: 'Not stated.',
      impact: 'Not assessed (fake provider).',
      testing: 'Not assessed (fake provider).',
      root_cause: 'Fake root cause derived from the fix diff.',
      fix: 'Fake fix summary.',
    });
  };

const OLLAMA = 'http://localhost:11434';
const OPENAI = 'https://api.openai.com/v1';

// New providers (Bedrock, Azure OpenAI, Vertex): add a case here and to ConfigSchema.provider.
export function getProvider(cfg: Config): Provider {
  const { model, base_url: base } = cfg;
  const ms = cfg.timeout_seconds * 1000;
  switch (cfg.provider) {
    case 'anthropic':
      return async ({ system, user }) => {
        const j = (await post(
          `${base ?? 'https://api.anthropic.com'}/v1/messages`,
          { 'x-api-key': apiKey('ANTHROPIC'), 'anthropic-version': '2023-06-01' },
          { model, max_tokens: 4096, system, messages: [{ role: 'user', content: user }] },
          ms,
        )) as { content: { text?: string }[]; stop_reason?: string };
        if (j.stop_reason === 'max_tokens') throw new Error(`${model} hit its output token limit; the answer was cut off`);
        return j.content.map((b) => b.text ?? '').join('');
      };
    case 'openai':
      return async ({ system, user, json }) => {
        const j = (await post(
          `${base ?? OPENAI}/chat/completions`,
          { authorization: `Bearer ${apiKey('OPENAI')}` },
          {
            model,
            ...(json && { response_format: { type: 'json_object' } }),
            messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          },
          ms,
        )) as { choices: { message: { content: string }; finish_reason?: string }[] };
        if (j.choices[0]?.finish_reason === 'length') throw new Error(`${model} hit its output token limit; the answer was cut off`);
        return j.choices[0]?.message.content ?? '';
      };
    case 'ollama':
      return async ({ system, user, json }) => {
        const j = (await post(`${base ?? OLLAMA}/api/chat`, {}, {
          model,
          stream: false,
          ...(json && { format: 'json' }),
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        }, ms)) as { message: { content: string } };
        return j.message.content;
      };
    case 'fake':
      return fakeProvider(cfg.categories[0] ?? 'chore');
  }
}

/** Deterministic bag-of-words hashing vector: lets semantic search run offline in tests. */
const fakeEmbed = (text: string): Float32Array => {
  const v = new Float32Array(64);
  for (const w of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    let h = 0;
    for (const ch of w) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    v[h % 64] = (v[h % 64] ?? 0) + 1;
  }
  return v;
};

export function getEmbedder(cfg: Config): Embedder {
  const kind = cfg.search.provider ?? cfg.provider;
  const base = cfg.search.provider ? undefined : cfg.base_url;
  switch (kind) {
    case 'openai':
      return async (input) => {
        const j = (await post(`${base ?? OPENAI}/embeddings`, { authorization: `Bearer ${apiKey('OPENAI')}` }, {
          model: cfg.search.model ?? 'text-embedding-3-small',
          input,
        })) as { data: { embedding: number[] }[] };
        return j.data.map((d) => Float32Array.from(d.embedding));
      };
    case 'ollama':
      return async (input) => {
        const j = (await post(`${base ?? OLLAMA}/api/embed`, {}, { model: cfg.search.model ?? 'nomic-embed-text', input })) as {
          embeddings: number[][];
        };
        return j.embeddings.map((e) => Float32Array.from(e));
      };
    case 'fake':
      return async (input) => input.map(fakeEmbed);
    default:
      throw new Error(`${kind} has no embeddings API; set search.provider to openai or ollama in .ledger/config.yaml`);
  }
}

function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('no JSON object in response');
  return JSON.parse(text.slice(start, end + 1));
}

/** Asks for structured JSON, validates, retries once with the validation error. */
export async function generate<S extends z.ZodType>(provider: Provider, prompt: Prompt, schema: S): Promise<z.infer<S>> {
  let user = prompt.user;
  let error = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await provider({ system: prompt.system, user, json: true });
    try {
      return schema.parse(extractJson(raw));
    } catch (e) {
      error = e instanceof z.ZodError ? z.prettifyError(e) : (e as Error).message;
      user = `${prompt.user}\n\n## Your previous response was invalid\n${error}\nReturn ONLY the corrected JSON object.`;
    }
  }
  throw new Error(`provider returned invalid output twice:\n${error}`);
}
