const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BIN = path.join(__dirname, '..', 'bin', 'clip.cjs');
const FX = path.join(__dirname, 'fixtures');

// A fake HOME with the fixture sessions filed under the encoded cwd of a temp project folder.
function world(sessions) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clip-cli-home-'));
  // realpath: process.cwd() resolves symlinks (macOS /var → /private/var), and Claude Code encodes that.
  const cwd = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'clip-cli-proj-')));
  const dir = path.join(home, '.claude', 'projects', cwd.replace(/\//g, '-'));
  fs.mkdirSync(dir, { recursive: true });
  const t = Date.now() / 1000;
  sessions.forEach((name, i) => {
    const dest = path.join(dir, name);
    fs.copyFileSync(path.join(FX, name), dest);
    fs.utimesSync(dest, t - (sessions.length - i) * 10, t - (sessions.length - i) * 10); // last = newest
  });
  return { home, cwd };
}

function run(w, args, env = {}) {
  const r = spawnSync('node', [BIN, ...args], {
    cwd: w.cwd,
    env: { ...process.env, HOME: w.home, CLIP_SKIP_RENDER: '1', CLIP_REPO_VISIBILITY: 'PUBLIC', ...env },
    encoding: 'utf8',
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

test('no sessions for this folder', () => {
  const r = run(world([]), []);
  assert.strictEqual(r.code, 1);
  assert.match(r.err, /No Claude Code sessions found for this folder\./);
});

test('sessions but nothing clip-worthy', () => {
  const r = run(world(['no-tests.jsonl']), []);
  assert.strictEqual(r.code, 1);
  assert.match(r.err, /Nothing clip-worthy yet: Clip needs a session with edits and a test run\./);
});

test('--list prints scored episodes of every session', () => {
  const r = run(world(['no-tests.jsonl', 'red-green.jsonl']), ['--list']);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /red-green/);
  assert.match(r.out, /#1 .*7\.6/);
  assert.match(r.out, /Make the snapshot engine faster/);
});

test('private repo stops with the --private-ok hint', () => {
  const r = run(world(['red-green.jsonl']), [], { CLIP_REPO_VISIBILITY: 'PRIVATE' });
  assert.strictEqual(r.code, 1);
  assert.match(r.err, /--private-ok/);
});

test('--private-ok, --out and --prompt reach the clip data', () => {
  const w = world(['red-green.jsonl']);
  const out = path.join(w.cwd, 'sub', 'my.mp4');
  const r = run(w, ['--private-ok', '--out', out, '--prompt', 'hi there'], { CLIP_REPO_VISIBILITY: 'PRIVATE' });
  assert.strictEqual(r.code, 0, r.err);
  const data = JSON.parse(fs.readFileSync(path.join(w.cwd, 'sub', 'my.clipdata.json'), 'utf8'));
  assert.strictEqual(data.prompt, 'hi there');
  assert.strictEqual(data.tests.length, 2);
});

test('a session-id prefix and --episode pick explicitly', () => {
  const w = world(['red-green.jsonl', 'no-tests.jsonl']);
  const r = run(w, ['red-gr', '--episode', '1', '--out', path.join(w.cwd, 'clip.mp4')]);
  assert.strictEqual(r.code, 0, r.err);
  assert.ok(fs.existsSync(path.join(w.cwd, 'clip.clipdata.json')));
});

test('default run falls back past a newest session with nothing clip-worthy', () => {
  const w = world(['red-green.jsonl', 'no-tests.jsonl']); // no-tests is newest
  const r = run(w, ['--out', path.join(w.cwd, 'clip.mp4')]);
  assert.strictEqual(r.code, 0, r.err);
  const data = JSON.parse(fs.readFileSync(path.join(w.cwd, 'clip.clipdata.json'), 'utf8'));
  assert.strictEqual(data.tests.length, 2);
});

test('--help exits 0 and names the flags', () => {
  const r = run(world([]), ['--help']);
  assert.strictEqual(r.code, 0);
  for (const f of ['--list', '--episode', '--out', '--private-ok', '--prompt']) assert.ok(r.out.includes(f), f);
});
