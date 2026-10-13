#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/cli.ts
var cli_exports = {};
__export(cli_exports, {
  main: () => main,
  parseArgs: () => parseArgs
});
module.exports = __toCommonJS(cli_exports);
var import_node_fs3 = __toESM(require("node:fs"));
var import_node_os3 = __toESM(require("node:os"));
var import_node_path3 = __toESM(require("node:path"));

// package.json
var version = "0.1.0";

// src/tests.ts
var FORMATS = [
  // node --test, spec reporter. The `tests N` line is optional: outputs piped through grep often keep only pass/fail.
  {
    re: /(?:ℹ tests (\d+)\s*\n\s*(?:ℹ suites \d+\s*\n\s*)?)?ℹ pass (\d+)\s*\n\s*ℹ fail (\d+)/g,
    pick: (m) => ({ total: m[1] ? +m[1] : void 0, passed: +m[2], failed: +m[3] })
  },
  // node --test, TAP reporter
  {
    re: /(?:# tests (\d+)\s*\n\s*(?:# suites \d+\s*\n\s*)?)?# pass (\d+)\s*\n\s*# fail (\d+)/g,
    pick: (m) => ({ total: m[1] ? +m[1] : void 0, passed: +m[2], failed: +m[3] })
  },
  // jest / vitest
  {
    re: /Tests:\s+(?:(\d+) failed, )?(?:(\d+) skipped, )?(\d+) passed, (\d+) total/g,
    pick: (m) => ({ failed: +(m[1] ?? 0), passed: +m[3], total: +m[4] })
  },
  // pytest
  {
    re: /=+ (?:(\d+) failed, )?(\d+) passed[^=\n]* in [\d.]+s/g,
    pick: (m) => ({ failed: +(m[1] ?? 0), passed: +m[2] })
  }
];
var FAILING_NAME_RE = /^\s*✖ (?!failing tests:)(.+?) \(\d[\d.]*m?s\)\s*$/gm;
function parseTestOutput(output) {
  let best = null;
  for (const f of FORMATS) {
    f.re.lastIndex = 0;
    for (let m = f.re.exec(output); m; m = f.re.exec(output))
      if (!best || m.index > best.index) best = { index: m.index, summary: f.pick(m) };
  }
  if (!best) return null;
  const { passed, failed } = best.summary;
  const total = best.summary.total ?? passed + failed;
  const tail = output.slice(prevSummaryEnd(output, best.index));
  const failingNames = failed > 0 ? [...new Set([...tail.matchAll(FAILING_NAME_RE)].map((m) => m[1].trim()))] : [];
  return { passed, failed, total, failingNames };
}
function prevSummaryEnd(output, winnerIndex) {
  let end = 0;
  for (const f of FORMATS) {
    f.re.lastIndex = 0;
    for (let m = f.re.exec(output); m; m = f.re.exec(output))
      if (m.index < winnerIndex) end = Math.max(end, m.index + m[0].length);
  }
  return end;
}

// src/score.ts
var minutesBetween = (a, b) => (Date.parse(b) - Date.parse(a)) / 6e4;
function isRed(run, summary) {
  return summary ? summary.failed > 0 : !run.exitOk;
}
function scoreEpisode(e) {
  const runs = e.events.filter((ev) => ev.kind === "test");
  const tests = runs.map((r) => parseTestOutput(r.output));
  const colors = runs.map((r, i) => isRed(r, tests[i]));
  const redToGreen = colors.some((red, i) => red && colors.slice(i + 1).includes(false));
  const edits = e.events.filter((ev) => ev.kind === "write" || ev.kind === "edit" || ev.kind === "shell").length;
  const minutes = minutesBetween(e.startedAt, e.endedAt);
  let score = 0;
  if (redToGreen) score += 3;
  score += Math.min(edits, 20) / 5;
  if (minutes >= 3 && minutes <= 90) score += 2;
  if (e.prompt.length > 0 && e.prompt.length <= 400) score += 2;
  return { ...e, score, redToGreen, tests };
}
function pickEpisode(episodes) {
  const eligible = episodes.filter((e) => e.events.some((ev) => ev.kind !== "test" && ev.kind !== "commit")).map(scoreEpisode).filter((e) => e.tests.some((t) => t !== null)).sort((a, b) => b.score - a.score);
  return eligible[0] ?? null;
}

// src/redact.ts
var SECRET_RES = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  // OpenAI/Anthropic-style keys
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  // GitHub tokens
  /\bAKIA[0-9A-Z]{16}\b/g,
  // AWS access keys
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  // JWTs
  /(?<![A-Za-z0-9+/])[A-Za-z0-9+/]{40,}={0,2}(?![A-Za-z0-9+/=])/g
  // long base64-ish tokens
];
var DROP_LINE_RE = /password|secret|token=/i;
var escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function redact(text, opts) {
  const root = opts.root.replace(/\/$/, "");
  const home = opts.home.replace(/\/$/, "");
  let out = text;
  if (root) out = out.replace(new RegExp(escapeRe(root) + "/", "g"), "");
  if (home) out = out.replace(new RegExp(escapeRe(home) + "(?=/|\\b)", "g"), "~");
  for (const re of SECRET_RES) out = out.replace(re, "[redacted]");
  if (!DROP_LINE_RE.test(out)) return out;
  const lines = out.split("\n");
  const trailing = lines[lines.length - 1] === "" ? lines.pop() : void 0;
  const kept = lines.filter((line) => !DROP_LINE_RE.test(line));
  return kept.join("\n") + (trailing !== void 0 ? "\n" : "");
}
function redactDeep(value, opts) {
  if (typeof value === "string") return redact(value, opts);
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, opts));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactDeep(v, opts);
    return out;
  }
  return value;
}

// src/clipdata.ts
var MAX_TEST_STATES = 8;
var MAX_FILES = 3;
var MAX_CODE_LINES = 4;
var MAX_CODE_CHARS = 90;
function clockSince(start, at) {
  const s = Math.max(0, Math.floor((Date.parse(at) - Date.parse(start)) / 1e3));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m < 10 ? "0" : ""}${m}:${r < 10 ? "0" : ""}${r}`;
}
function buildClipData(e, meta) {
  const edits = e.events.filter((ev) => ev.kind !== "test" && ev.kind !== "commit" && ev.file !== "");
  const runs = e.events.filter((ev) => ev.kind === "test");
  const byFile = /* @__PURE__ */ new Map();
  for (const ed of edits) {
    const cur = byFile.get(ed.file);
    if (cur) {
      cur.added += ed.added;
      cur.removed += ed.removed;
    } else {
      byFile.set(ed.file, { file: ed.file, kind: ed.kind === "write" ? "new" : "changed", added: ed.added, removed: ed.removed, clock: clockSince(e.startedAt, ed.at) });
    }
  }
  const files = [...byFile.values()].sort((a, b) => b.added + b.removed - (a.added + a.removed)).slice(0, MAX_FILES).sort((a, b) => a.clock.localeCompare(b.clock));
  const seenFailing = /* @__PURE__ */ new Set();
  const states = [];
  let redCount = 0;
  for (let i = 0; i < runs.length; i++) {
    const summary = e.tests[i];
    if (!summary) continue;
    if (isRed(runs[i], summary)) redCount++;
    const fresh = summary.failingNames.filter((n) => !seenFailing.has(n));
    const old = summary.failingNames.filter((n) => seenFailing.has(n));
    summary.failingNames.forEach((n) => seenFailing.add(n));
    const state = { clock: clockSince(e.startedAt, runs[i].at), ...summary, failingNames: [...fresh, ...old] };
    if (states.length > 0 && fresh.length > 0) state.isNew = true;
    states.push(state);
  }
  const commits = e.events.filter((ev) => ev.kind === "commit").map((c) => ({ hash: c.hash, subject: c.subject }));
  const data = {
    repo: meta.repo,
    date: e.startedAt.slice(0, 10),
    prompt: e.prompt,
    minutes: Math.round((Date.parse(e.endedAt) - Date.parse(e.startedAt)) / 6e4),
    files,
    codeLines: (edits.find((ed) => ed.lines?.length)?.lines ?? []).filter((l) => l.trim()).slice(0, MAX_CODE_LINES).map((l) => l.slice(0, MAX_CODE_CHARS)),
    tests: states.slice(0, MAX_TEST_STATES),
    moreRuns: Math.max(0, states.length - MAX_TEST_STATES),
    commits,
    redCount
  };
  return redactDeep(data, { home: meta.home, root: meta.root });
}

// src/render.ts
var import_node_child_process = require("node:child_process");
var import_node_fs = __toESM(require("node:fs"));
var import_node_os = __toESM(require("node:os"));
var import_node_path = __toESM(require("node:path"));
var HYPERFRAMES_VERSION = "0.8.150";
var TEMPLATES = import_node_path.default.join(__dirname, "..", "templates");
var PLACEHOLDER = "/*__CLIP_DATA__*/null";
function sceneDurations(data) {
  const s1 = 6;
  const s2 = 6.5;
  const s3 = Math.max(4, Math.round((0.5 + 1.4 * data.tests.length + 1.6) * 10) / 10);
  const s4 = 7.5;
  return { s1, s2, s3, s4, total: Math.round((s1 + s2 + s3 + s4) * 10) / 10 };
}
function prepareProject(data, dir) {
  import_node_fs.default.cpSync(TEMPLATES, dir, { recursive: true });
  const json = JSON.stringify(data).replace(/<\/script/gi, "<\\/script");
  const d = sceneDurations(data);
  const slots = {
    __TOTAL__: String(d.total),
    __S1__: String(d.s1),
    __S2_START__: String(d.s1),
    __S2__: String(d.s2),
    __S3_START__: String(Math.round((d.s1 + d.s2) * 10) / 10),
    __S3__: String(d.s3),
    __S4_START__: String(Math.round((d.s1 + d.s2 + d.s3) * 10) / 10),
    __S4__: String(d.s4)
  };
  const htmlFiles = [import_node_path.default.join(dir, "index.html"), ...import_node_fs.default.readdirSync(import_node_path.default.join(dir, "compositions")).map((f) => import_node_path.default.join(dir, "compositions", f))];
  for (const file of htmlFiles) {
    let html = import_node_fs.default.readFileSync(file, "utf8").split(PLACEHOLDER).join(json);
    for (const [token, value] of Object.entries(slots)) html = html.split(token).join(value);
    if (file.endsWith("s3-tests.html")) html = html.replace(/(data-composition-id="s3-tests"[^>]*data-duration=")10\.5(")/, `$1${d.s3}$2`);
    import_node_fs.default.writeFileSync(file, html);
  }
  const run = `npx --yes hyperframes@${HYPERFRAMES_VERSION}`;
  import_node_fs.default.writeFileSync(import_node_path.default.join(dir, "package.json"), JSON.stringify({ name: "clip-render", private: true, type: "module", scripts: { render: `${run} render`, check: `${run} check` } }, null, 2));
  import_node_fs.default.writeFileSync(import_node_path.default.join(dir, "hyperframes.json"), JSON.stringify({ paths: { blocks: "compositions", components: "compositions/components", assets: "assets" }, media: { autoProxy: true }, authoringSkill: "general-video" }, null, 2));
  import_node_fs.default.writeFileSync(import_node_path.default.join(dir, "meta.json"), JSON.stringify({ id: "clip-render", name: "clip-render", createdAt: "2026-01-01T00:00:00.000Z" }));
  return dir;
}
async function renderClip(data, out, opts = {}) {
  const dir = prepareProject(data, import_node_fs.default.mkdtempSync(import_node_path.default.join(import_node_os.default.tmpdir(), "clip-")));
  const outAbs = import_node_path.default.resolve(out);
  import_node_fs.default.mkdirSync(import_node_path.default.dirname(outAbs), { recursive: true });
  const r = (0, import_node_child_process.spawnSync)("npx", ["--yes", `hyperframes@${HYPERFRAMES_VERSION}`, "render", "--quality", "looks", "--output", outAbs], {
    cwd: dir,
    stdio: opts.quiet ? "pipe" : "inherit",
    env: { ...process.env, CI: "1" }
  });
  if (r.status !== 0 || !import_node_fs.default.existsSync(outAbs)) {
    throw new Error(`hyperframes render failed (exit ${r.status}). Project left at ${dir}` + (opts.quiet ? `
${String(r.stderr)}` : ""));
  }
  if (!opts.keepTemp) import_node_fs.default.rmSync(dir, { recursive: true, force: true });
  return { out: outAbs, seconds: sceneDurations(data).total, projectDir: dir };
}

// src/repo.ts
var import_node_child_process2 = require("node:child_process");
function repoVisibility(cwd, exec = import_node_child_process2.execFile) {
  return new Promise((resolve) => {
    exec("gh", ["repo", "view", "--json", "visibility"], { cwd }, (err, stdout) => {
      if (err) return resolve("UNKNOWN");
      try {
        const v = JSON.parse(String(stdout)).visibility;
        resolve(v === "PUBLIC" ? "PUBLIC" : v === "PRIVATE" ? "PRIVATE" : "UNKNOWN");
      } catch {
        resolve("UNKNOWN");
      }
    });
  });
}
function repoName(cwd, exec = import_node_child_process2.execFile) {
  return new Promise((resolve) => {
    exec("gh", ["repo", "view", "--json", "nameWithOwner"], { cwd }, (err, stdout) => {
      if (err) return resolve(null);
      try {
        resolve(JSON.parse(String(stdout)).nameWithOwner ?? null);
      } catch {
        resolve(null);
      }
    });
  });
}

// src/transcript.ts
var import_node_fs2 = __toESM(require("node:fs"));
var import_node_os2 = __toESM(require("node:os"));
var import_node_path2 = __toESM(require("node:path"));
var MAX_PATCH_LINES = 12;
var TEST_COMMAND_RE = /\b(npm (run )?test|pnpm test|yarn test|bun test|vitest|jest|node --test|pytest|go test|cargo test)\b/;
var COMMIT_RE = /\[\w[\w\/-]* ([0-9a-f]{7,})\] (.+)/;
function sessionsFor(cwd, home = import_node_os2.default.homedir()) {
  const dir = import_node_path2.default.join(home, ".claude", "projects", cwd.replace(/\//g, "-"));
  if (!import_node_fs2.default.existsSync(dir)) return [];
  return import_node_fs2.default.readdirSync(dir).filter((f) => f.endsWith(".jsonl")).map((f) => import_node_path2.default.join(dir, f)).sort((a, b) => import_node_fs2.default.statSync(b).mtimeMs - import_node_fs2.default.statSync(a).mtimeMs);
}
function promptText(content) {
  let text;
  if (typeof content === "string") text = content;
  else if (Array.isArray(content))
    text = content.filter((b) => b && b.type === "text").map((b) => b.text ?? "").join(" ");
  else return null;
  text = text.trim();
  if (!text || text.startsWith("<") || text.startsWith("Caveat:") || text.startsWith("Base directory for this skill:")) return null;
  return text;
}
function patchCounts(extra) {
  let added = 0;
  let removed = 0;
  const lines = [];
  for (const hunk of extra?.structuredPatch ?? [])
    for (const line of hunk.lines ?? []) {
      if (line.startsWith("+")) {
        added++;
        if (lines.length < MAX_PATCH_LINES) lines.push(line.slice(1));
      } else if (line.startsWith("-")) removed++;
    }
  return { added, removed, lines };
}
function relative(file, cwd) {
  return file.startsWith(cwd + "/") ? file.slice(cwd.length + 1) : file;
}
function parseTranscript(file) {
  const episodes = [];
  const calls = /* @__PURE__ */ new Map();
  let cur = null;
  for (const line of import_node_fs2.default.readFileSync(file, "utf8").split("\n")) {
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (!o || typeof o !== "object" || o.isSidechain) continue;
    const msg = o.message ?? {};
    const at = o.timestamp ?? cur?.endedAt ?? "";
    if (o.type === "user") {
      const p = promptText(msg.content);
      if (p !== null) {
        cur = { index: episodes.length, prompt: p, startedAt: at, endedAt: at, events: [] };
        episodes.push(cur);
        continue;
      }
      if (!cur || !Array.isArray(msg.content)) continue;
      cur.endedAt = at;
      const extra = typeof o.toolUseResult === "object" && o.toolUseResult ? o.toolUseResult : {};
      for (const b of msg.content) {
        if (!b || b.type !== "tool_result") continue;
        const call = calls.get(b.tool_use_id);
        if (!call) continue;
        const cwd = o.cwd ?? "";
        if (call.name === "Write" || call.name === "Edit" || call.name === "MultiEdit") {
          const { added, removed, lines } = patchCounts(extra);
          const ev = {
            kind: call.name === "Write" ? "write" : "edit",
            file: relative(extra.filePath ?? call.input.file_path ?? "?", cwd),
            added,
            removed,
            at
          };
          if (ev.kind === "write" && lines.length) ev.lines = lines;
          cur.events.push(ev);
        } else if (call.name === "Bash") {
          const command = call.input.command ?? "";
          const output = `${extra.stdout ?? ""}
${extra.stderr ?? ""}`;
          const commit = command.includes("git commit") ? COMMIT_RE.exec(output) : null;
          if (TEST_COMMAND_RE.test(command)) {
            cur.events.push({ kind: "test", command, exitOk: !b.is_error, output, at });
          } else if (commit) {
            cur.events.push({ kind: "commit", hash: commit[1], subject: commit[2].trim(), at });
          } else if (extra.bashEditDiff) {
            const diffFiles = Array.isArray(extra.bashEditDiff?.files) ? extra.bashEditDiff.files : [];
            if (diffFiles.length === 0) cur.events.push({ kind: "shell", file: "", added: 0, removed: 0, at });
            for (const df of diffFiles) {
              const { added, removed } = patchCounts({ structuredPatch: df.hunks });
              cur.events.push({ kind: "shell", file: relative(df.filePath ?? "", cwd), added, removed, at });
            }
          }
        }
      }
    } else if (o.type === "assistant" && cur) {
      cur.endedAt = at;
      for (const b of Array.isArray(msg.content) ? msg.content : [])
        if (b && b.type === "tool_use") calls.set(b.id, { name: b.name, input: b.input ?? {} });
    }
  }
  return episodes;
}

// src/cli.ts
var HELP = `clip ${version} \u2014 your Claude Code session \u2192 a 30-second video

Usage
  clip                         latest session in this folder \u2192 ./clip.mp4
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
function parseArgs(argv) {
  const a = { list: false, out: "clip.mp4", privateOk: false, help: false, version: false };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === "--list") a.list = true;
    else if (x === "--episode") a.episode = Number(argv[++i]);
    else if (x === "--out") a.out = argv[++i];
    else if (x === "--private-ok") a.privateOk = true;
    else if (x === "--prompt") a.prompt = argv[++i];
    else if (x === "--help" || x === "-h") a.help = true;
    else if (x === "--version" || x === "-v") a.version = true;
    else if (x.startsWith("--")) throw new Error(`Unknown option ${x}`);
    else a.session = x;
  }
  return a;
}
function fail(msg) {
  console.error(msg);
  return 1;
}
async function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    return fail(`clip: ${e.message}

${HELP}`);
  }
  if (args.version) return console.log(version), 0;
  if (args.help) return console.log(HELP), 0;
  const cwd = process.cwd();
  const home = import_node_os3.default.homedir();
  let sessions = sessionsFor(cwd, home);
  if (sessions.length === 0) return fail("No Claude Code sessions found for this folder.");
  if (args.session) {
    sessions = sessions.filter((s) => import_node_path3.default.basename(s).startsWith(args.session));
    if (sessions.length === 0) return fail(`No session starting with "${args.session}".`);
  }
  if (args.list) {
    for (const file of sessions) {
      const eps = parseTranscript(file).map(scoreEpisode).filter((e) => e.events.length > 0);
      console.log(`${import_node_path3.default.basename(file, ".jsonl")}  (${eps.length} episodes with activity)`);
      for (const e of eps) {
        const tests = e.tests.length ? `tests:${e.tests.length}${e.redToGreen ? " red\u2192green" : ""}` : "no tests";
        console.log(`  #${e.index} ${e.score.toFixed(1).padStart(5)}  ${tests.padEnd(18)} ${e.prompt.replace(/\s+/g, " ").slice(0, 70)}`);
      }
    }
    return 0;
  }
  let episode = null;
  if (args.episode !== void 0) {
    const episodes = parseTranscript(sessions[0]);
    if (!episodes[args.episode]) return fail(`Session has no episode #${args.episode}. Try --list.`);
    episode = scoreEpisode(episodes[args.episode]);
  } else {
    for (const file of sessions) {
      episode = pickEpisode(parseTranscript(file));
      if (episode) break;
    }
    if (!episode) return fail("Nothing clip-worthy yet: Clip needs a session with edits and a test run.");
  }
  const forced = process.env.CLIP_REPO_VISIBILITY;
  const visibility = forced ?? await repoVisibility(cwd);
  if (visibility !== "PUBLIC" && !args.privateOk) {
    return fail(
      visibility === "PRIVATE" ? "This repo is private on GitHub. A clip shows your prompt, file names and code lines. Re-run with --private-ok if that is fine." : "Could not confirm this repo is public (no GitHub remote, or gh is not logged in). Re-run with --private-ok to render anyway."
    );
  }
  const repo = (forced ? null : await repoName(cwd)) ?? import_node_path3.default.basename(cwd);
  if (args.prompt !== void 0) episode.prompt = args.prompt;
  const data = buildClipData(episode, { repo, home, root: cwd });
  const out = import_node_path3.default.resolve(cwd, args.out);
  if (process.env.CLIP_SKIP_RENDER === "1") {
    const sidecar = out.replace(/\.mp4$/i, "") + ".clipdata.json";
    import_node_fs3.default.mkdirSync(import_node_path3.default.dirname(sidecar), { recursive: true });
    import_node_fs3.default.writeFileSync(sidecar, JSON.stringify(data, null, 2));
    console.log(`Wrote ${sidecar} (render skipped)`);
    return 0;
  }
  console.log(`Episode #${episode.index}: "${episode.prompt.slice(0, 60)}" \u2014 ${data.minutes} min, ${data.tests.length} test runs. Rendering\u2026`);
  try {
    const r = await renderClip(data, out);
    console.log(`
\u2714 ${r.out}  (${r.seconds}s, 1080\xD71080)`);
    return 0;
  } catch (e) {
    return fail(`clip: ${e.message}`);
  }
}
if (require.main === module) main(process.argv.slice(2)).then((code) => process.exit(code));
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  main,
  parseArgs
});
