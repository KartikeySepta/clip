const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');

test('clip --version prints the package version', () => {
  const out = execFileSync('node', ['bin/clip.cjs', '--version']).toString().trim();
  assert.strictEqual(out, require('../package.json').version);
});
