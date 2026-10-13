export type RedactOptions = { home: string; root: string };

const SECRET_RES = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,                 // OpenAI/Anthropic-style keys
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,             // GitHub tokens
  /\bAKIA[0-9A-Z]{16}\b/g,                       // AWS access keys
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, // JWTs
  /(?<![A-Za-z0-9+/])[A-Za-z0-9+/]{40,}={0,2}(?![A-Za-z0-9+/=])/g,  // long base64-ish tokens
];
const DROP_LINE_RE = /password|secret|token=/i;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Scrub one string: project paths → relative, home → ~, key-shaped strings → [redacted], sensitive lines dropped. */
export function redact(text: string, opts: RedactOptions): string {
  const root = opts.root.replace(/\/$/, '');
  const home = opts.home.replace(/\/$/, '');
  let out = text;
  if (root) out = out.replace(new RegExp(escapeRe(root) + '/', 'g'), '');
  if (home) out = out.replace(new RegExp(escapeRe(home) + '(?=/|\\b)', 'g'), '~');
  for (const re of SECRET_RES) out = out.replace(re, '[redacted]');
  if (!DROP_LINE_RE.test(out)) return out;
  // Split keeps a trailing '' after a final newline; filtering lines must not drop or duplicate it.
  const lines = out.split('\n');
  const trailing = lines[lines.length - 1] === '' ? lines.pop() : undefined;
  const kept = lines.filter((line) => !DROP_LINE_RE.test(line));
  return kept.join('\n') + (trailing !== undefined ? '\n' : '');
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
