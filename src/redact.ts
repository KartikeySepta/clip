export type RedactOptions = { home: string; root: string };

const SECRET_RES = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,                           // OpenAI/Anthropic-style keys
  /\bsk_(?:live|test)_[A-Za-z0-9]{10,}\b/g,               // Stripe
  /\bxox[abpr]-[A-Za-z0-9-]{10,}\b/g,                     // Slack
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,                      // GitHub tokens
  /\bAKIA[0-9A-Z]{16}\b/g,                                // AWS access keys
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, // JWTs
  /(?<![A-Za-z0-9+/._-])[A-Za-z0-9+]{40,}={0,2}(?![A-Za-z0-9+/=._-])/g, // long base64-ish tokens (no "/": paths)
];
// "password = x", "token=abc", "API_KEY: …": mask the value, keep the key and the rest of the line.
const KEY_VALUE_RE = /\b(api[_-]?key|secret|token|password|passwd)(\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s&;,]+)/gi;
const SENSITIVE_LINE_RE = /password|passwd|secret|token=|api[_-]?key/i;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Scrub one string: project paths → relative, home → ~, key-shaped strings and key=value secrets → [redacted]. */
export function redact(text: string, opts: RedactOptions): string {
  const root = opts.root.replace(/\/$/, '');
  const home = opts.home.replace(/\/$/, '');
  let out = text;
  if (root) out = out.replace(new RegExp(escapeRe(root) + '/', 'g'), '');
  if (home) out = out.replace(new RegExp(escapeRe(home) + '(?=/|\\b)', 'g'), '~');
  for (const re of SECRET_RES) out = out.replace(re, '[redacted]');
  out = out.replace(KEY_VALUE_RE, '$1$2[redacted]');
  return out;
}

/** For multi-line code fields: a line that mentions a credential is dropped entirely. */
export function isSensitiveLine(line: string): boolean {
  return SENSITIVE_LINE_RE.test(line);
}

export function redactDeep<T>(value: T, opts: RedactOptions): T {
  if (typeof value === 'string') return redact(value, opts) as T;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, opts)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = redactDeep(v, opts);
    return out as T;
  }
  return value;
}
