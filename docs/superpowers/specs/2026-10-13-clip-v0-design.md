# Clip v0 — design

Clip turns a saved Claude Code session into a 30-second square video, rendered on the user's machine.

## Goal

`npx clip` in a project folder finds the best moment in the latest Claude Code session for that folder and writes `clip.mp4`. The result looks like the hand-made demo in this repo: ask → work → tests → result.

## Non-goals (v0)

- Picking moments with an AI model (scoring is rule-based).
- Music, voice, captions, formats other than 1080x1080.
- A Claude Code mod or UI. The CLI is the product; a mod can wrap it later.
- Sessions from agents other than Claude Code.

## Commands

```
npx clip                       # latest session in cwd → ./clip.mp4
npx clip --list                # sessions and their candidate episodes, scored
npx clip <session-id> --episode <n> [--out file.mp4]
npx clip ... --private-ok      # allow a repo that is not public on GitHub
npx clip ... --prompt "text"   # replace the prompt shown on screen
```

`<session-id>` accepts a prefix of the transcript file name.

## Input

Claude Code transcripts: `~/.claude/projects/<encoded-cwd>/<session>.jsonl`. The encoded folder name is the cwd with every non-alphanumeric character replaced by `-` (verified against real folders on 2026-10-13; very long paths may be truncated/hashed by newer versions, unverified). One JSON object per line. Facts Clip relies on (all verified on real transcripts):

- Every line has `timestamp`, `type` (`user` | `assistant` | …), `isSidechain`, `cwd`.
- A user prompt is a `user` line whose `message.content` is a string or has a `text` block. Lines starting with `<` or `Caveat:` are system attachments, not prompts.
- Tool calls are `assistant` lines with `tool_use` blocks: `name`, `id`, `input`.
- Tool results are `user` lines with `tool_result` blocks (`tool_use_id`, `is_error`) and a top-level `toolUseResult` object. For Edit/Write it holds `structuredPatch` and `filePath`; for Bash it holds `stdout`, `stderr`, and `bashEditDiff` when the command changed files.
- `is_error` reflects the command's exit status, not the tests. Pass/fail must be parsed from the runner's output.
- Sidechain lines (`isSidechain: true`) are subagents; v0 ignores them.

## Pipeline

Five modules, each a pure function over plain data, each testable alone.

### 1. `transcript.ts` — parse

`parseTranscript(path) → Episode[]`. An episode is one user prompt and everything until the next prompt: `{ prompt, startedAt, endedAt, events[] }`. Events are typed: `FileEdit { file, added, removed, kind: "write"|"edit"|"shell" }`, `TestRun { command, passed, failed, total, failingNames[], at }`, `Commit { hash, subject }`.

### 2. `tests.ts` — read test output

`parseTestOutput(stdout+stderr) → { passed, failed, total, failingNames }`. Supports: node `--test` (spec reporter `ℹ pass N` and TAP `# pass N`, the `tests N` line optional), jest (`Tests: … N total`, groups in any order), vitest (`Tests  N failed | M passed (T)`), pytest (`N failed, M passed in …`), cargo (`test result: … N passed; M failed`). Commands are recognised by regex (`npm test`, `node --test`, `vitest`, `jest`, `pytest`, `cargo test`); `go test` prints no counts and is not recognised. Unknown output → `null`; such runs are left out of the clip entirely (shown nowhere, not counted as red) and an episode needs at least one readable run to qualify.

### 3. `score.ts` — pick the episode

`scoreEpisode(e) → number`. Points for: a red→green turnaround (+3), file edits (up to +4), duration between 3 and 90 minutes (+2), a prompt under 400 characters (+2). Penalty for more than 12 prompts in a session (handled at session level). `--list` prints every episode with its score; the default run takes the highest in the latest session.

### 4. `redact.ts` — scrub

Applied to every string that reaches the render: replace the home directory with `~`, strip the project root from paths, mask `sk-…`, `gh[pousr]_…`, `AKIA…`, JWT-shaped and 40+ char base64 tokens with `[redacted]`, drop any line containing `password`, `secret`, `token=`. Before rendering, Clip checks `gh repo view --json visibility` for the cwd's origin; if it is not `PUBLIC` it stops with a message unless `--private-ok` is passed.

### 5. `render.ts` — build and render

Takes a `ClipData` object (prompt, file rows, code lines, test states with clock times, commits, total minutes, repo name) and writes it as a JSON variable into a copy of the four HyperFrames scenes bundled in `templates/`. Scenes read the data at build time via `data-composition-variables`. Then runs `hyperframes render --quality looks --output <out>`. HyperFrames and Chrome are resolved through `npx hyperframes`, which downloads what it needs.

Scene timing is derived from the data: scene 3 allots 1.4 s per test state (capped at 8 states, the rest summarised as "+N more runs"); the total stays between 24 and 34 s.

## Errors

- No transcript for cwd → "No Claude Code sessions found for this folder."
- No episode with at least one file edit and one test run → "Nothing clip-worthy yet: Clip needs a session with edits and a test run." (`--episode` still forces one.)
- Repo not public → stop with the `--private-ok` hint.
- Render failure → surface HyperFrames' message; leave the temp project dir for inspection and print its path.

## Testing

- Fixture transcripts under `tests/fixtures/` (synthetic, built from the real shape; no real user content): a clean red→green session, a session with no tests, one with jest output, one with pytest output.
- `transcript.test.ts`, `tests.test.ts`, `score.test.ts`: expected episodes, counts and ranking.
- `redact.test.ts`: planted secrets and paths never appear in `ClipData` serialised to JSON.
- `render.test.ts`: one smoke render of a fixture, asserts the MP4 exists, is 1080x1080 and 24–34 s (skipped when `CLIP_SKIP_RENDER=1`).

## Packaging

TypeScript, Node ≥ 22, `node:test`, esbuild bundle to `bin/clip.cjs` (same layout as agent-undo). Published as `@atpes/clip` so `npx @atpes/clip` works; the README documents `npm i -g @atpes/clip` → `clip`. MIT.
