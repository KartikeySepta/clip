const { test } = require('node:test');
const assert = require('node:assert');
const { parseTestOutput } = require('../dist/tests.js');

test('node --test spec reporter with failing names', () => {
  const out = 'ℹ tests 20\nℹ pass 18\nℹ fail 2\n✖ failing tests:\n✖ a revert that fails (1ms)\n✖ copy fallback (2ms)\n';
  assert.deepStrictEqual(parseTestOutput(out), {
    passed: 18, failed: 2, total: 20, failingNames: ['a revert that fails', 'copy fallback'],
  });
});

test('node --test TAP reporter', () => {
  assert.deepStrictEqual(parseTestOutput('# tests 3\n# pass 3\n# fail 0\n'), { passed: 3, failed: 0, total: 3, failingNames: [] });
});

test('jest / vitest summary', () => {
  assert.deepStrictEqual(parseTestOutput('Tests: 2 failed, 33 passed, 35 total\n'), { passed: 33, failed: 2, total: 35, failingNames: [] });
});

test('pytest summary', () => {
  assert.deepStrictEqual(parseTestOutput('==== 1 failed, 34 passed in 2.1s ====\n'), { passed: 34, failed: 1, total: 35, failingNames: [] });
});

test('two summaries in one output: the last wins', () => {
  const out = 'ℹ tests 9\nℹ pass 8\nℹ fail 1\n✖ copy fallback (1ms)\n...\nℹ tests 9\nℹ pass 9\nℹ fail 0\n';
  assert.deepStrictEqual(parseTestOutput(out), { passed: 9, failed: 0, total: 9, failingNames: [] });
});

test('grep-filtered node output without the tests line still parses', () => {
  assert.deepStrictEqual(parseTestOutput('ℹ pass 4\nℹ fail 0\n'), { passed: 4, failed: 0, total: 4, failingNames: [] });
  assert.deepStrictEqual(parseTestOutput('# pass 3\n# fail 1\n'), { passed: 3, failed: 1, total: 4, failingNames: [] });
});

test('all-failing jest and pytest runs still parse', () => {
  assert.deepStrictEqual(parseTestOutput('Tests: 1 failed, 1 total\n'), { passed: 0, failed: 1, total: 1, failingNames: [] });
  assert.deepStrictEqual(parseTestOutput('==== 2 failed in 0.12s ====\n'), { passed: 0, failed: 2, total: 2, failingNames: [] });
});

test('jest with todo and skipped groups in any order', () => {
  assert.deepStrictEqual(parseTestOutput('Tests: 1 failed, 1 todo, 3 passed, 5 total\n'), { passed: 3, failed: 1, total: 5, failingNames: [] });
  assert.deepStrictEqual(parseTestOutput('Tests: 2 skipped, 3 passed, 5 total\n'), { passed: 3, failed: 0, total: 5, failingNames: [] });
});

test('vitest summary', () => {
  assert.deepStrictEqual(parseTestOutput(' Tests  1 failed | 5 passed (6)\n'), { passed: 5, failed: 1, total: 6, failingNames: [] });
  assert.deepStrictEqual(parseTestOutput(' Tests  6 passed (6)\n'), { passed: 6, failed: 0, total: 6, failingNames: [] });
});

test('cargo test summary', () => {
  assert.deepStrictEqual(parseTestOutput('test result: FAILED. 5 passed; 1 failed; 0 ignored\n'), { passed: 5, failed: 1, total: 6, failingNames: [] });
});

test('unknown output is null', () => {
  assert.strictEqual(parseTestOutput('hello'), null);
});
