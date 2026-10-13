import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type FileEdit = {
  kind: 'write' | 'edit' | 'shell';
  file: string;
  added: number;
  removed: number;
  at: string;
  /** First added lines of a Write's patch, for the code card. */
  lines?: string[];
};
const MAX_PATCH_LINES = 12;
export type TestRun = { kind: 'test'; command: string; exitOk: boolean; output: string; at: string };
export type Commit = { kind: 'commit'; hash: string; subject: string; at: string };
export type Event = FileEdit | TestRun | Commit;
export type Episode = { index: number; prompt: string; startedAt: string; endedAt: string; events: Event[] };

export const TEST_COMMAND_RE =
  /\b(npm (run )?test|pnpm test|yarn test|bun test|vitest|jest|node --test|pytest|go test|cargo test)\b/;
const COMMIT_RE = /\[\w[\w\/-]* ([0-9a-f]{7,})\] (.+)/;

type ToolCall = { name: string; input: Record<string, any> };

/** Transcript files for a cwd, newest first. */
export function sessionsFor(cwd: string, home: string = os.homedir()): string[] {
  const dir = path.join(home, '.claude', 'projects', cwd.replace(/\//g, '-'));
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => path.join(dir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function promptText(content: unknown): string | null {
  let text: string;
  if (typeof content === 'string') text = content;
  else if (Array.isArray(content))
    text = content.filter((b) => b && b.type === 'text').map((b) => b.text ?? '').join(' ');
  else return null;
  text = text.trim();
  // System attachments, command echoes and skill expansions arrive as user lines but nobody typed them.
  if (!text || text.startsWith('<') || text.startsWith('Caveat:') || text.startsWith('Base directory for this skill:')) return null;
  return text;
}

function patchCounts(extra: any): { added: number; removed: number; lines: string[] } {
  let added = 0;
  let removed = 0;
  const lines: string[] = [];
  for (const hunk of extra?.structuredPatch ?? [])
    for (const line of hunk.lines ?? []) {
      if (line.startsWith('+')) {
        added++;
        if (lines.length < MAX_PATCH_LINES) lines.push(line.slice(1));
      } else if (line.startsWith('-')) removed++;
    }
  return { added, removed, lines };
}

function relative(file: string, cwd: string): string {
  return file.startsWith(cwd + '/') ? file.slice(cwd.length + 1) : file;
}

export function parseTranscript(file: string): Episode[] {
  const episodes: Episode[] = [];
  const calls = new Map<string, ToolCall>();
  let cur: Episode | null = null;

  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    let o: any;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (!o || typeof o !== 'object' || o.isSidechain) continue;
    const msg = o.message ?? {};
    const at: string = o.timestamp ?? cur?.endedAt ?? '';

    if (o.type === 'user') {
      const p = promptText(msg.content);
      if (p !== null) {
        cur = { index: episodes.length, prompt: p, startedAt: at, endedAt: at, events: [] };
        episodes.push(cur);
        continue;
      }
      if (!cur || !Array.isArray(msg.content)) continue;
      cur.endedAt = at;
      const extra = typeof o.toolUseResult === 'object' && o.toolUseResult ? o.toolUseResult : {};
      for (const b of msg.content) {
        if (!b || b.type !== 'tool_result') continue;
        const call = calls.get(b.tool_use_id);
        if (!call) continue;
        const cwd: string = o.cwd ?? '';
        if (call.name === 'Write' || call.name === 'Edit' || call.name === 'MultiEdit') {
          const { added, removed, lines } = patchCounts(extra);
          const ev: FileEdit = {
            kind: call.name === 'Write' ? 'write' : 'edit',
            file: relative(extra.filePath ?? call.input.file_path ?? '?', cwd),
            added,
            removed,
            at,
          };
          if (ev.kind === 'write' && lines.length) ev.lines = lines;
          cur.events.push(ev);
        } else if (call.name === 'Bash') {
          const command: string = call.input.command ?? '';
          const output = `${extra.stdout ?? ''}\n${extra.stderr ?? ''}`;
          const commit = command.includes('git commit') ? COMMIT_RE.exec(output) : null;
          if (TEST_COMMAND_RE.test(command)) {
            cur.events.push({ kind: 'test', command, exitOk: !b.is_error, output, at });
          } else if (commit) {
            cur.events.push({ kind: 'commit', hash: commit[1], subject: commit[2].trim(), at });
          } else if (extra.bashEditDiff) {
            // A shell command that changed files (sed, heredoc, codegen): one event per file, same patch shape.
            const diffFiles: any[] = Array.isArray(extra.bashEditDiff?.files) ? extra.bashEditDiff.files : [];
            if (diffFiles.length === 0) cur.events.push({ kind: 'shell', file: '', added: 0, removed: 0, at });
            for (const df of diffFiles) {
              const { added, removed } = patchCounts({ structuredPatch: df.hunks });
              cur.events.push({ kind: 'shell', file: relative(df.filePath ?? '', cwd), added, removed, at });
            }
          }
        }
      }
    } else if (o.type === 'assistant' && cur) {
      cur.endedAt = at;
      for (const b of Array.isArray(msg.content) ? msg.content : [])
        if (b && b.type === 'tool_use') calls.set(b.id, { name: b.name, input: b.input ?? {} });
    }
  }
  return episodes;
}
