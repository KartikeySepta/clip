const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseTranscript, sessionsFor } = require('../dist/transcript.js');

const fx = (n) => path.join(__dirname, 'fixtures', n);

test('splits into episodes and typed events', () => {
  const eps = parseTranscript(fx('red-green.jsonl'));
  assert.strictEqual(eps.length, 2);
  const e = eps[1];
  assert.strictEqual(e.prompt, 'Make the snapshot engine faster and keep the tests green');
  assert.deepStrictEqual(e.events.map((x) => x.kind), ['write', 'edit', 'test', 'test', 'commit']);
  assert.deepStrictEqual(e.events[0], { kind: 'write', file: 'src/clone.ts', added: 2, removed: 0, at: e.events[0].at });
  assert.deepStrictEqual(e.events[1], { kind: 'edit', file: 'src/snapshot.ts', added: 3, removed: 1, at: e.events[1].at });
  assert.strictEqual(e.events[2].exitOk, false);
  assert.match(e.events[2].output, /pass 8/);
  assert.strictEqual(e.events[4].hash, 'abc1234');
  assert.strictEqual(e.events[4].subject, 'feat: thing');
  assert.strictEqual(e.startedAt, '2026-10-04T04:01:00.000Z');
  assert.strictEqual(e.endedAt, '2026-10-04T04:09:00.000Z');
});

test('skips sidechain lines, broken JSON and orphan results', () => {
  const eps = parseTranscript(fx('broken-lines.jsonl'));
  assert.strictEqual(eps.length, 2);
  assert.strictEqual(eps[1].events.length, 5);
});

test('sessionsFor maps cwd to the encoded project folder, newest first', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clip-home-'));
  const dir = path.join(home, '.claude', 'projects', '-home-dev-proj');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'old.jsonl'), '');
  fs.writeFileSync(path.join(dir, 'new.jsonl'), '');
  const t = Date.now() / 1000;
  fs.utimesSync(path.join(dir, 'old.jsonl'), t - 10, t - 10);
  fs.utimesSync(path.join(dir, 'new.jsonl'), t, t);
  assert.deepStrictEqual(sessionsFor('/home/dev/proj', home).map((p) => path.basename(p)), ['new.jsonl', 'old.jsonl']);
  assert.deepStrictEqual(sessionsFor('/nowhere', home), []);
});
