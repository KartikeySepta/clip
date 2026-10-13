const { test } = require('node:test');
const assert = require('node:assert');
const { redact, redactDeep } = require('../dist/redact.js');

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

test('lines mentioning passwords, secrets or token= are dropped', () => {
  assert.strictEqual(redact('ok\nconst password = "hunter2";\nstill ok\nSECRET: 1\nurl?token=abc\n', opts), 'ok\nstill ok\n');
});

test('plain code is unchanged', () => {
  const code = "const x = require('koffi').load('/usr/lib/libSystem.B.dylib');";
  assert.strictEqual(redact(code, opts), code);
});

test('redactDeep walks arrays and objects', () => {
  const out = redactDeep({ a: ['/Users/x/proj/f.ts', { b: 'sk-abcdefghijklmnopqrst' }], n: 3 }, opts);
  assert.deepStrictEqual(out, { a: ['f.ts', { b: '[redacted]' }], n: 3 });
});
