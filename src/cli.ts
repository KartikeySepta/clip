import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { version } from '../package.json';
import { buildClipData } from './clipdata';
import { renderClip } from './render';
import { repoName, repoVisibility, type Visibility } from './repo';
import { pickEpisode, scoreEpisode } from './score';
import { parseTranscript, sessionsFor } from './transcript';

const HELP = `clip ${version} — your Claude Code session → a 30-second video

Usage
  clip                         latest session in this folder → ./clip.mp4
  clip --list                  sessions and their candidate episodes, scored
  clip <session-id> [--episode <n>] [--out <file>]

Options
  --list            list sessions and episodes instead of rendering
  --episode <n>     pick an episode by its # from --list
  --out <file>      output path (default ./clip.mp4)
  --private-ok      render even when the repo is not public on GitHub
  --prompt <text>   replace the prompt shown on screen
  --version, --help

Clip runs on your machine. It reads ~/.claude/projects/, redacts keys and paths,
and renders with HyperFrames. Nothing is uploaded.`;

type Args = { list: boolean; episode?: number; out: string; privateOk: boolean; prompt?: string; session?: string; help: boolean; version: boolean };

export function parseArgs(argv: string[]): Args {
  const a: Args = { list: false, out: 'clip.mp4', privateOk: false, help: false, version: false };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--list') a.list = true;
    else if (x === '--episode') a.episode = Number(argv[++i]);
    else if (x === '--out') a.out = argv[++i];
    else if (x === '--private-ok') a.privateOk = true;
    else if (x === '--prompt') a.prompt = argv[++i];
    else if (x === '--help' || x === '-h') a.help = true;
    else if (x === '--version' || x === '-v') a.version = true;
    else if (x.startsWith('--')) throw new Error(`Unknown option ${x}`);
    else a.session = x;
  }
  return a;
}

function fail(msg: string): number {
  console.error(msg);
  return 1;
}

export async function main(argv: string[]): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    return fail(`clip: ${(e as Error).message}\n\n${HELP}`);
  }
  if (args.version) return (console.log(version), 0);
  if (args.help) return (console.log(HELP), 0);

  const cwd = process.cwd();
  const home = os.homedir();
  let sessions = sessionsFor(cwd, home);
  if (sessions.length === 0) return fail('No Claude Code sessions found for this folder.');
  if (args.session) {
    sessions = sessions.filter((s) => path.basename(s).startsWith(args.session!));
    if (sessions.length === 0) return fail(`No session starting with "${args.session}".`);
  }

  if (args.list) {
    for (const file of sessions) {
      const eps = parseTranscript(file).map(scoreEpisode).filter((e) => e.events.length > 0);
      console.log(`${path.basename(file, '.jsonl')}  (${eps.length} episodes with activity)`);
      for (const e of eps) {
        const tests = e.tests.length ? `tests:${e.tests.length}${e.redToGreen ? ' red→green' : ''}` : 'no tests';
        console.log(`  #${e.index} ${e.score.toFixed(1).padStart(5)}  ${tests.padEnd(18)} ${e.prompt.replace(/\s+/g, ' ').slice(0, 70)}`);
      }
    }
    return 0;
  }

  // An explicit --episode addresses the newest matching session; the default walks back to the
  // newest session that has something clip-worthy.
  let episode = null;
  if (args.episode !== undefined) {
    const episodes = parseTranscript(sessions[0]);
    if (!episodes[args.episode]) return fail(`Session has no episode #${args.episode}. Try --list.`);
    episode = scoreEpisode(episodes[args.episode]);
  } else {
    for (const file of sessions) {
      episode = pickEpisode(parseTranscript(file));
      if (episode) break;
    }
    if (!episode) return fail('Nothing clip-worthy yet: Clip needs a session with edits and a test run.');
  }

  const forced = process.env.CLIP_REPO_VISIBILITY as Visibility | undefined;
  const visibility = forced ?? (await repoVisibility(cwd));
  if (visibility !== 'PUBLIC' && !args.privateOk) {
    return fail(
      visibility === 'PRIVATE'
        ? 'This repo is private on GitHub. A clip shows your prompt, file names and code lines. Re-run with --private-ok if that is fine.'
        : 'Could not confirm this repo is public (no GitHub remote, or gh is not logged in). Re-run with --private-ok to render anyway.',
    );
  }

  const repo = (forced ? null : await repoName(cwd)) ?? path.basename(cwd);
  if (args.prompt !== undefined) episode.prompt = args.prompt;
  const data = buildClipData(episode, { repo, home, root: cwd });

  const out = path.resolve(cwd, args.out);
  if (process.env.CLIP_SKIP_RENDER === '1') {
    const sidecar = out.replace(/\.mp4$/i, '') + '.clipdata.json';
    fs.mkdirSync(path.dirname(sidecar), { recursive: true });
    fs.writeFileSync(sidecar, JSON.stringify(data, null, 2));
    console.log(`Wrote ${sidecar} (render skipped)`);
    return 0;
  }
  console.log(`Episode #${episode.index}: "${episode.prompt.slice(0, 60)}" — ${data.minutes} min, ${data.tests.length} test runs. Rendering…`);
  try {
    const r = await renderClip(data, out);
    console.log(`\n✔ ${r.out}  (${r.seconds}s, 1080×1080)`);
    return 0;
  } catch (e) {
    return fail(`clip: ${(e as Error).message}`);
  }
}

if (require.main === module) main(process.argv.slice(2)).then((code) => process.exit(code));
