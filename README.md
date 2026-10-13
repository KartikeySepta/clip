# ● clip

**Your Claude Code session → a 30-second video.**

![A real 22-minute Claude Code session as a 30-second clip](clip-demo.gif)

That's a real session: one prompt, 22 minutes, tests went red three times and came back green every time, 35/35 passing, 3 commits. Every number on screen comes from the session's own transcript. ([Full-quality MP4](clip-demo.mp4))

## Status

Not built yet. This clip was made by hand to find out whether anyone wants the tool.

If you'd use it, **star or watch this repo**. That's the signal I'm waiting for.

## What it would do

- Read a saved Claude Code session from `~/.claude/projects/`. No screen recording.
- Pick the moments that matter: the ask, the edits, the test runs, the result.
- Render a short video on your machine with [HyperFrames](https://github.com/heygen-com/hyperframes).
- Hide secrets, keys and home paths before anything renders. Nothing leaves your machine.

Made from a session of [agent-undo](https://github.com/KartikeySepta/agent-undo).
