import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ClipData } from './clipdata';

export const HYPERFRAMES_VERSION = '0.8.150';
const TEMPLATES = path.join(__dirname, '..', 'templates');
const PLACEHOLDER = '/*__CLIP_DATA__*/null';

export type Durations = { s1: number; s2: number; s3: number; s4: number; total: number };

/** Scene lengths in seconds; s3 grows with the number of test states so the whole stays 24–34 s. */
export function sceneDurations(data: ClipData): Durations {
  const s1 = 6;
  const s2 = 6.5;
  const s3 = Math.max(4, Math.round((0.5 + 1.4 * data.tests.length + 1.6) * 10) / 10);
  const s4 = 7.5;
  return { s1, s2, s3, s4, total: Math.round((s1 + s2 + s3 + s4) * 10) / 10 };
}

/** Copy the bundled scenes into `dir`, inject the data, and write the HyperFrames project files. */
export function prepareProject(data: ClipData, dir: string): string {
  fs.cpSync(TEMPLATES, dir, { recursive: true });
  // Every "<" becomes < inside the JSON string literals, so no payload can close the <script> or open a comment.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const d = sceneDurations(data);
  const slots: Record<string, string> = {
    __TOTAL__: String(d.total),
    __S1__: String(d.s1),
    __S2_START__: String(d.s1),
    __S2__: String(d.s2),
    __S3_START__: String(Math.round((d.s1 + d.s2) * 10) / 10),
    __S3__: String(d.s3),
    __S4_START__: String(Math.round((d.s1 + d.s2 + d.s3) * 10) / 10),
    __S4__: String(d.s4),
  };
  const htmlFiles = [path.join(dir, 'index.html'), ...fs.readdirSync(path.join(dir, 'compositions')).map((f) => path.join(dir, 'compositions', f))];
  for (const file of htmlFiles) {
    let html = fs.readFileSync(file, 'utf8').split(PLACEHOLDER).join(json);
    for (const [token, value] of Object.entries(slots)) html = html.split(token).join(value);
    // The s3 scene's own data-duration must match its slot (the runtime reads the slot; lint reads this).
    if (file.endsWith('s3-tests.html')) html = html.replace(/(data-composition-id="s3-tests"[^>]*data-duration=")10\.5(")/, `$1${d.s3}$2`);
    fs.writeFileSync(file, html);
  }
  const run = `npx --yes hyperframes@${HYPERFRAMES_VERSION}`;
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'clip-render', private: true, type: 'module', scripts: { render: `${run} render`, check: `${run} check` } }, null, 2));
  fs.writeFileSync(path.join(dir, 'hyperframes.json'), JSON.stringify({ paths: { blocks: 'compositions', components: 'compositions/components', assets: 'assets' }, media: { autoProxy: true }, authoringSkill: 'general-video' }, null, 2));
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ id: 'clip-render', name: 'clip-render', createdAt: '2026-01-01T00:00:00.000Z' }));
  return dir;
}

export async function renderClip(data: ClipData, out: string, opts: { keepTemp?: boolean; quiet?: boolean } = {}): Promise<{ out: string; seconds: number; projectDir: string }> {
  const dir = prepareProject(data, fs.mkdtempSync(path.join(os.tmpdir(), 'clip-')));
  const outAbs = path.resolve(out);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  const r = spawnSync('npx', ['--yes', `hyperframes@${HYPERFRAMES_VERSION}`, 'render', '--quality', 'looks', '--output', outAbs], {
    cwd: dir,
    stdio: opts.quiet ? 'pipe' : 'inherit',
    env: { ...process.env, CI: '1' },
  });
  if (r.status !== 0 || !fs.existsSync(outAbs)) {
    throw new Error(`hyperframes render failed (exit ${r.status}). Project left at ${dir}` + (opts.quiet ? `\n${String(r.stderr)}` : ''));
  }
  if (!opts.keepTemp) fs.rmSync(dir, { recursive: true, force: true });
  return { out: outAbs, seconds: sceneDurations(data).total, projectDir: dir };
}
