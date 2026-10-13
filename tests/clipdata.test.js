const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { parseTranscript } = require('../dist/transcript.js');
const { scoreEpisode } = require('../dist/score.js');
const { buildClipData } = require('../dist/clipdata.js');

const fx = (n) => path.join(__dirname, 'fixtures', n);
const meta = { repo: 'dev/proj', home: '/home/dev', root: '/home/dev/proj' };
const episode = () => scoreEpisode(parseTranscript(fx('red-green.jsonl'))[1]);

test('builds the clip facts from the red→green fixture', () => {
  const d = buildClipData(episode(), meta);
  assert.strictEqual(d.repo, 'dev/proj');
  assert.strictEqual(d.date, '2026-10-04');
  assert.strictEqual(d.minutes, 8);
  assert.deepStrictEqual(d.files.map((f) => [f.file, f.kind, f.added, f.removed, f.clock]), [
    ['src/clone.ts', 'new', 2, 0, '01:06'],
    ['src/snapshot.ts', 'changed', 3, 1, '02:06'],
    ['bin/core.cjs', 'changed', 2, 1, '03:06'],
  ]);
  assert.deepStrictEqual(d.tests[0], { clock: '04:12', passed: 8, failed: 1, total: 9, failingNames: ['copy fallback honours the size guard'] });
  assert.strictEqual(d.tests[1].failed, 0);
  assert.strictEqual(d.redCount, 1);
  assert.strictEqual(d.moreRuns, 0);
  assert.deepStrictEqual(d.commits, [{ hash: 'abc1234', subject: 'feat: thing' }]);
  assert.deepStrictEqual(d.codeLines, ['a', 'b']);
});

test('caps test states at 8: the first 7 plus the final run', () => {
  const e = episode();
  const run = e.events[4];
  const extra = Array.from({ length: 9 }, (_, i) => ({ ...run, at: new Date(Date.parse(run.at) + (i + 1) * 1000).toISOString() }));
  const last = { ...run, output: 'ℹ tests 50\nℹ pass 50\nℹ fail 0\n', at: new Date(Date.parse(run.at) + 20_000).toISOString() };
  const big = scoreEpisode({ ...e, events: [...e.events, ...extra, last] });
  const d = buildClipData(big, meta);
  assert.strictEqual(d.tests.length, 8);
  assert.strictEqual(d.moreRuns, 4);
  assert.strictEqual(d.tests[7].total, 50, 'the final run is always shown');
});

test('prompt whitespace is collapsed and code lines with secrets are dropped', () => {
  const e = episode();
  const leaky = { ...e, prompt: 'line one\n\n  line   two', events: e.events.map((ev, i) => (i === 0 ? { ...ev, lines: ['const password = "x"', 'ok line'] } : ev)) };
  const d = buildClipData(scoreEpisode(leaky), meta);
  assert.strictEqual(d.prompt, 'line one line two');
  assert.deepStrictEqual(d.codeLines, ['ok line']);
});

test('a failing run with unparsable output is not counted as red', () => {
  const e = episode();
  const unparsed = { kind: 'test', command: 'npm test', exitOk: false, output: 'segfault', at: e.endedAt };
  const d = buildClipData(scoreEpisode({ ...e, events: [...e.events, unparsed] }), meta);
  assert.strictEqual(d.redCount, 1);
  assert.strictEqual(d.tests.length, 2);
});

test('a planted secret in a patch never reaches the data', () => {
  const e = episode();
  const leaky = { ...e, prompt: 'use key sk-abcdefghijklmnopqrst please', events: e.events };
  const json = JSON.stringify(buildClipData(leaky, meta));
  assert.ok(!json.includes('sk-abcdefghijklmnopqrst'));
  assert.ok(!json.includes('/home/dev'));
});
