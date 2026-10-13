const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { prepareProject, renderClip, sceneDurations } = require('../dist/render.js');

const data = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'clipdata.json'), 'utf8'));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'clip-render-'));

test('scene durations keep the total between 24 and 34 s', () => {
  const one = sceneDurations({ ...data(), tests: data().tests.slice(0, 1) });
  const eight = sceneDurations(data());
  assert.ok(one.total >= 24 && one.total <= 34, String(one.total));
  assert.ok(eight.total >= 24 && eight.total <= 34, String(eight.total));
  assert.strictEqual(eight.s3, Math.round((0.5 + 1.4 * 7 + 1.6) * 10) / 10);
});

test('prepareProject injects the data into every scene and sets the slot times', () => {
  const d = data();
  const extra = Array.from({ length: 4 }, (_, i) => ({ ...d.tests[1], clock: `18:0${i}` }));
  const big = { ...d, tests: [...d.tests, ...extra].slice(0, 8), moreRuns: 3 };
  const dir = prepareProject(big, tmp());
  const index = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  assert.match(index, /data-composition-id="s3-tests"[^>]*data-duration="13.3"/);
  assert.ok(!index.includes('__CLIP_DATA__'));
  for (const f of ['s1-ask', 's2-work', 's3-tests', 's4-end']) {
    const html = fs.readFileSync(path.join(dir, 'compositions', `${f}.html`), 'utf8');
    assert.ok(!html.includes('__CLIP_DATA__'), f);
    assert.ok(html.includes('"moreRuns":3'), f);
  }
  assert.ok(fs.existsSync(path.join(dir, 'package.json')));
  assert.ok(fs.existsSync(path.join(dir, 'hyperframes.json')));
});

test('injected JSON cannot close the script tag or open a comment', () => {
  const d = { ...data(), codeLines: ['<!-- <script>', '</script><b>'] };
  const dir = prepareProject(d, tmp());
  const html = fs.readFileSync(path.join(dir, 'compositions', 's2-work.html'), 'utf8');
  assert.ok(!html.includes('<!-- <script>'));
  assert.ok(!html.includes('</script><b>'));
  assert.ok(html.includes('\\u003c!-- \\u003cscript>'));
});

test('renders a 1080x1080 mp4 between 24 and 34 s', { skip: process.env.CLIP_SKIP_RENDER === '1' }, async () => {
  const out = path.join(tmp(), 'out.mp4');
  const r = await renderClip(data(), out);
  assert.ok(fs.statSync(r.out).size > 100_000);
  const probe = JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', r.out]).toString(),
  );
  assert.strictEqual(probe.streams[0].width, 1080);
  assert.strictEqual(probe.streams[0].height, 1080);
  const dur = Number(probe.format.duration);
  assert.ok(dur >= 24 && dur <= 34, String(dur));
  assert.ok(!fs.existsSync(r.projectDir), 'temp project removed after a good render');
});
