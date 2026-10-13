const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { parseTranscript } = require('../dist/transcript.js');
const { scoreEpisode, pickEpisode } = require('../dist/score.js');

const fx = (n) => path.join(__dirname, 'fixtures', n);

test('red→green episode scores 7.4', () => {
  const e = scoreEpisode(parseTranscript(fx('red-green.jsonl'))[1]);
  assert.strictEqual(e.redToGreen, true);
  assert.strictEqual(Math.round(e.score * 10) / 10, 7.4);
  assert.strictEqual(e.tests.length, 2);
  assert.strictEqual(e.tests[0].failed, 1);
});

test('pickEpisode returns the best episode with edits and a test run', () => {
  const best = pickEpisode(parseTranscript(fx('red-green.jsonl')));
  assert.strictEqual(best.index, 1);
});

test('pickEpisode is null when no episode has a test run', () => {
  assert.strictEqual(pickEpisode(parseTranscript(fx('no-tests.jsonl'))), null);
});

test('a prompt over 400 characters loses the short-prompt bonus', () => {
  const e = parseTranscript(fx('red-green.jsonl'))[1];
  const long = { ...e, prompt: 'x'.repeat(500) };
  assert.strictEqual(Math.round((scoreEpisode(e).score - scoreEpisode(long).score) * 10) / 10, 2);
});
