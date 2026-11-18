import { describe, expect, it } from 'vitest';
import { redact } from '../src/redact.js';

// Split so the fixtures themselves don't trip secret scanners.
const j = (...p: string[]): string => p.join('');

describe('redact', () => {
  const cases: [string, string][] = [
    ['aws_key', j('AKIA', 'IOSFODNN7EXAMPLE')],
    ['github_token', j('ghp_', 'a'.repeat(36))],
    ['github_token', j('github_pat_', 'A1'.repeat(15))],
    ['gitlab_token', j('glpat-', 'x'.repeat(20))],
    ['slack_token', j('xoxb-', '1234567890-abcdef')],
    ['slack_token', j('https://hooks.slack.com/services/', 'T000/B000/XXXX')],
    ['stripe_key', j('sk_live_', '4eC39HqLyjWDarjtT1zdp7dc')],
    ['jwt', j('eyJhbGciOiJIUzI1NiJ9', '.eyJzdWIiOiIxMjM0In0', '.sig_nature-abc')],
  ];
  it.each(cases)('%s', (type, secret) => {
    const out = redact(`token = ${secret} trailing`);
    expect(out).not.toContain(secret);
    expect(out).toContain(`[REDACTED:${type}]`);
  });

  it('private key blocks, including unterminated ones', () => {
    const block = j('-----BEGIN RSA PRIVATE', ' KEY-----\n+MIIEow\n+abc\n-----END RSA PRIVATE KEY-----');
    expect(redact(`a\n${block}\nb`)).toBe('a\n[REDACTED:private_key]\nb');
    expect(redact(j('x -----BEGIN OPENSSH PRIVATE', ' KEY-----\nMIIE cut off'))).toBe('x [REDACTED:private_key]');
  });

  it('generic assignments', () => {
    expect(redact('+DB_PASSWORD=hunter2')).toBe('+DB_PASSWORD=[REDACTED:generic_secret]');
    expect(redact('API_KEY: "a b c"')).toBe('API_KEY: [REDACTED:generic_secret]');
    expect(redact('const apiKey = "s3cr3tvalue";')).toBe('const apiKey = [REDACTED:generic_secret];');
    expect(redact('password: \'longpass\'')).toBe('password: [REDACTED:generic_secret]');
    expect(redact('const key = getKey();')).toBe('const key = getKey();');
  });

  it('does not double-redact', () => {
    expect(redact(j('AWS_ACCESS_KEY_ID=AKIA', 'IOSFODNN7EXAMPLE'))).toBe('AWS_ACCESS_KEY_ID=[REDACTED:aws_key]');
  });

  it('custom patterns', () => {
    expect(redact('id ACME-12345678 ok', [{ name: 'acme_id', pattern: 'ACME-[0-9]{8}' }])).toBe('id [REDACTED:acme_id] ok');
  });
});
