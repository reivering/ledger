import { ENV_PREFIX } from './product.js';
import type { Config } from './store.js';

export interface Prompt {
  system: string;
  user: string;
}
/** Takes an already-redacted prompt, returns the model's raw text. */
export type Provider = (prompt: Prompt) => Promise<string>;

function apiKey(name: string): string {
  const v = process.env[`${ENV_PREFIX}${name}_API_KEY`];
  if (!v) throw new Error(`set ${ENV_PREFIX}${name}_API_KEY in the environment`);
  return v;
}

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}: ${(await res.text()).slice(0, 500)}`);
  return res.json();
}

export const fakeProvider =
  (category: string): Provider =>
  async ({ user }) =>
    JSON.stringify({
      title: (/## Commit message\n(.*)/.exec(user)?.[1]?.trim() || 'Untitled change').slice(0, 100),
      category,
      risk: 'low',
      symbols: [],
      what_changed: 'Recorded offline by the fake provider.',
      why: 'Not stated.',
      impact: 'Not assessed (fake provider).',
      testing: 'Not assessed (fake provider).',
    });

// New providers (Bedrock, Azure OpenAI, Vertex): add a case here and to ConfigSchema.provider.
export function getProvider(cfg: Config): Provider {
  const { model, base_url: base } = cfg;
  switch (cfg.provider) {
    case 'anthropic':
      return async ({ system, user }) => {
        const j = (await post(
          `${base ?? 'https://api.anthropic.com'}/v1/messages`,
          { 'x-api-key': apiKey('ANTHROPIC'), 'anthropic-version': '2023-06-01' },
          { model, max_tokens: 4096, system, messages: [{ role: 'user', content: user }] },
        )) as { content: { text?: string }[] };
        return j.content.map((b) => b.text ?? '').join('');
      };
    case 'openai':
      return async ({ system, user }) => {
        const j = (await post(
          `${base ?? 'https://api.openai.com/v1'}/chat/completions`,
          { authorization: `Bearer ${apiKey('OPENAI')}` },
          {
            model,
            response_format: { type: 'json_object' },
            messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          },
        )) as { choices: { message: { content: string } }[] };
        return j.choices[0]?.message.content ?? '';
      };
    case 'ollama':
      return async ({ system, user }) => {
        const j = (await post(`${base ?? 'http://localhost:11434'}/api/chat`, {}, {
          model,
          stream: false,
          format: 'json',
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        })) as { message: { content: string } };
        return j.message.content;
      };
    case 'fake':
      return fakeProvider(cfg.categories[0] ?? 'chore');
  }
}
