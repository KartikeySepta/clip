# Changelog

## 0.1.0

First release.

- `clip` turns the best episode of a Claude Code session into a 1080×1080 MP4 (24–34 s), rendered locally with HyperFrames.
- `--list`, `--episode`, `--out`, `--prompt`, `--private-ok`.
- Reads node `--test`, jest/vitest and pytest summaries; file changes from Edit/Write and from shell commands that changed files.
- Redacts home and project paths, key-shaped strings and sensitive lines; refuses non-public repos without `--private-ok`.
