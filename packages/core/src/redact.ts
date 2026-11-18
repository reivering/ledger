export interface CustomPattern {
  name: string;
  pattern: string;
}

const KNOWN: [type: string, re: RegExp][] = [
  // Unterminated blocks (e.g. cut off by truncation) are redacted to the end of the text.
  ['private_key', /-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----|$)/g],
  ['aws_key', /\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b/g],
  ['github_token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{22,255})\b/g],
  ['gitlab_token', /\bglpat-[A-Za-z0-9_-]{20,}/g],
  ['slack_token', /\bxox[abposr]-[A-Za-z0-9-]{10,}|https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+/g],
  ['stripe_key', /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{10,}\b|\bwhsec_[A-Za-z0-9]{20,}\b/g],
  ['jwt', /\beyJ[A-Za-z0-9_-]{5,}\.eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]+/g],
];

// ponytail: name-based heuristics over-redact some harmless code (e.g. `tokenType = "Bearer"`); safe direction.
const ENV_ASSIGN =
  /\b([A-Z0-9_]*(?:KEY|SECRET|PASSWORD|PASSWD|TOKEN)[A-Z0-9_]*["']?\s*[=:]\s*)(?!["']?\[REDACTED:)("[^"\n]*"|'[^'\n]*'|[^\s"',;]+)/g;
const QUOTED_ASSIGN =
  /\b(\w*(?:[a-z0-9]_?key|secret|passw(?:or)?d|token)["']?\s*[=:]\s*)(?!["']\[REDACTED:)("[^"\n]{4,}"|'[^'\n]{4,}')/gi;

const ENV_FILE = /(^|\/)\.env(\..*)?$/;
export const isEnvFile = (path: string): boolean => ENV_FILE.test(path);

/** Replaces secrets with `[REDACTED:<type>]`. Runs before any text leaves the machine. */
export function redact(text: string, custom: CustomPattern[] = []): string {
  let out = text;
  for (const [type, re] of KNOWN) out = out.replace(re, `[REDACTED:${type}]`);
  for (const { name, pattern } of custom) out = out.replace(new RegExp(pattern, 'g'), `[REDACTED:${name}]`);
  out = out.replace(ENV_ASSIGN, (_, k: string) => `${k}[REDACTED:generic_secret]`);
  return out.replace(QUOTED_ASSIGN, (_, k: string) => `${k}[REDACTED:generic_secret]`);
}
