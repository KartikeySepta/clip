# ● clip

**Your Claude Code session → a 30-second video.**

![A real 22-minute Claude Code session as a 30-second clip](clip-demo.gif)

That's a real session: one prompt, 22 minutes, tests went red three times and came back green every time, 35/35 passing, 3 commits. Every number on screen comes from the session's own transcript. ([Full-quality MP4](clip-demo.mp4))

## Install

```bash
npx @atpes/clip            # run it without installing
npm i -g @atpes/clip       # or install the `clip` command
```

Needs Node 22+ and `ffmpeg` on your PATH. The first render downloads HyperFrames and a headless Chrome (about a minute).

## Use

In any project folder you've used Claude Code in:

```bash
clip                       # best moment of the latest session → ./clip.mp4
clip --list                # every session and its candidate moments, scored
clip 14ac5b --episode 2    # pick a session (id prefix) and a moment (# from --list)
clip --out demo.mp4        # choose the output path
clip --prompt "text"       # replace the prompt shown on screen
clip --private-ok          # render even if the repo isn't public on GitHub
```

Clip picks the episode (one prompt and the work that followed it) with the best story: edits, a test run that went red and came back green, a sensible length. The clip shows the prompt as typed, the files changed, every test run with its real time offset, the commits, and the total minutes.

## Privacy

- Runs entirely on your machine. Nothing is uploaded.
- Reads only `~/.claude/projects/<this folder>/*.jsonl`, the transcripts Claude Code already saves.
- Before anything renders, your home directory becomes `~`, project paths become relative, and key-shaped strings (`sk-…`, `ghp_…`, `AKIA…`, JWTs, long base64) become `[redacted]`. Lines mentioning `password`, `secret` or `token=` are dropped.
- If the folder's GitHub repo is not public (or `gh` can't tell), Clip stops and asks for `--private-ok`. A clip shows your prompt, file names and a few code lines; decide before you post it.

## What it reads

Test results come from the runner's own summary, not the command's exit code: node `--test`, jest, vitest, pytest and cargo. Runs it can't read (and `go test`, which prints no counts) are left out of the clip. macOS and Linux only for now. File changes come from Claude's Edit/Write calls and from shell commands that changed files (`sed`, heredocs, codegen).

## Status

v0. One square format, silent, one look. Built from a hand-made demo of [agent-undo](https://github.com/KartikeySepta/agent-undo); rendered with [HyperFrames](https://github.com/heygen-com/hyperframes).

MIT © Kartikey Septa
