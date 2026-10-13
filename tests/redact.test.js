const { test } = require('node:test');
const assert = require('node:assert');
const { redact, redactDeep, isSensitiveLine } = require('../dist/redact.js');

const opts = { home: '/Users/x', root: '/Users/x/proj' };

test('project paths become relative, other home paths get ~', () => {
  assert.strictEqual(redact('see /Users/x/proj/src/a.ts and /Users/x/other/b.ts', opts), 'see src/a.ts and ~/other/b.ts');
});

test('key-shaped strings are masked', () => {
  const cases = [
    'sk-abcdefghijklmnopqrst',
    'ghp_' + 'a'.repeat(36),
    'AKIA' + 'B'.repeat(16),
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    'A'.repeat(44),
  ];
  for (const c of cases) assert.strictEqual(redact(`x=${c};`, opts), 'x=[redacted];', c);
});

test('key=value pairs are masked, the surrounding text survives', () => {
  assert.strictEqual(redact('const password = "hunter2";', opts), 'const password = [redacted];');
  assert.strictEqual(redact('url?token=abc&x=1', opts), 'url?token=[redacted]&x=1');
  assert.strictEqual(redact('API_KEY: deadbeefdeadbeefdeadbeefdeadbeef', opts), 'API_KEY: [redacted]');
});

test('ordinary words and paths that mention secrets are left alone', () => {
  assert.strictEqual(redact('Fix the password reset flow', opts), 'Fix the password reset flow');
  assert.strictEqual(redact('src/auth/secrets.ts', opts), 'src/auth/secrets.ts');
  const long = 'packages/frontend/src/components/forms/Input.tsx';
  assert.strictEqual(redact(long, opts), long);
});

test('Stripe and Slack keys are masked', () => {
  assert.strictEqual(redact('sk_live_abcdefghijklmnop', opts), '[redacted]');
  assert.strictEqual(redact('xoxb-1234567890-abcdefghij', opts), '[redacted]');
});

test('isSensitiveLine flags lines for multi-line code fields', () => {
  assert.strictEqual(isSensitiveLine('const password = "x"'), true);
  assert.strictEqual(isSensitiveLine('SECRET: 1'), true);
  assert.strictEqual(isSensitiveLine('return a + b;'), false);
});

test('plain code is unchanged', () => {
  const code = "const x = require('koffi').load('/usr/lib/libSystem.B.dylib');";
  assert.strictEqual(redact(code, opts), code);
});

test('redactDeep walks arrays and objects', () => {
  const out = redactDeep({ a: ['/Users/x/proj/f.ts', { b: 'sk-abcdefghijklmnopqrst' }], n: 3 }, opts);
  assert.deepStrictEqual(out, { a: ['f.ts', { b: '[redacted]' }], n: 3 });
});
