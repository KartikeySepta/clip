import type { ScoredEpisode } from './score';
import { isRed } from './score';
import { isSensitiveLine, redact, redactDeep } from './redact';
import type { FileEdit, TestRun } from './transcript';

export type TestState = { clock: string; passed: number; failed: number; total: number; failingNames: string[]; isNew?: boolean };
export type ClipData = {
  repo: string;
  date: string;
  prompt: string;
  minutes: number;
  files: { file: string; kind: 'new' | 'changed'; added: number; removed: number; clock: string }[];
  codeLines: string[];
  tests: TestState[];
  moreRuns: number;
  commits: { hash: string; subject: string }[];
  redCount: number;
};

export const MAX_TEST_STATES = 8;
const MAX_FILES = 3;
const MAX_CODE_LINES = 4;
const MAX_CODE_CHARS = 90;

export function clockSince(start: string, at: string): string {
  const s = Math.max(0, Math.floor((Date.parse(at) - Date.parse(start)) / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m < 10 ? '0' : ''}${m}:${r < 10 ? '0' : ''}${r}`;
}

export function buildClipData(e: ScoredEpisode, meta: { repo: string; home: string; root: string }): ClipData {
  const edits = e.events.filter((ev): ev is FileEdit => ev.kind !== 'test' && ev.kind !== 'commit' && ev.file !== '');
  const runs = e.events.filter((ev): ev is TestRun => ev.kind === 'test');

  // Keep a file's first appearance; sum its lines across edits; keep the busiest MAX_FILES in first-seen order.
  const byFile = new Map<string, ClipData['files'][number]>();
  for (const ed of edits) {
    const cur = byFile.get(ed.file);
    if (cur) {
      cur.added += ed.added;
      cur.removed += ed.removed;
    } else {
      byFile.set(ed.file, { file: ed.file, kind: ed.kind === 'write' ? 'new' : 'changed', added: ed.added, removed: ed.removed, clock: clockSince(e.startedAt, ed.at) });
    }
  }
  const files = [...byFile.values()]
    .sort((a, b) => b.added + b.removed - (a.added + a.removed))
    .slice(0, MAX_FILES)
    .sort((a, b) => a.clock.localeCompare(b.clock));

  const seenFailing = new Set<string>();
  const states: TestState[] = [];
  let redCount = 0;
  for (let i = 0; i < runs.length; i++) {
    // A run whose output we cannot read is shown nowhere, so it must not count toward the headline either.
    const summary = e.tests[i];
    if (!summary) continue;
    if (isRed(runs[i], summary)) redCount++;
    // A failure is "new" only after the first run, and new names go first so the tag lands on one of them.
    const fresh = summary.failingNames.filter((n) => !seenFailing.has(n));
    const old = summary.failingNames.filter((n) => seenFailing.has(n));
    summary.failingNames.forEach((n) => seenFailing.add(n));
    const state: TestState = { clock: clockSince(e.startedAt, runs[i].at), ...summary, failingNames: [...fresh, ...old] };
    if (states.length > 0 && fresh.length > 0) state.isNew = true;
    states.push(state);
  }

  const commits = e.events.filter((ev) => ev.kind === 'commit').map((c) => ({ hash: c.hash, subject: c.subject }));
  // Code lines: redact each line first (so a key cut by truncation can't slip through), drop credential lines, then cut.
  const redactOpts = { home: meta.home, root: meta.root };
  const codeLines = (edits.find((ed) => ed.lines?.length)?.lines ?? [])
    .filter((l) => l.trim() && !isSensitiveLine(l))
    .map((l) => redact(l, redactOpts))
    .slice(0, MAX_CODE_LINES)
    .map((l) => l.slice(0, MAX_CODE_CHARS));
  // More than MAX states: keep the first MAX-1 and the final run, so the clip ends where the session did.
  const shown = states.length > MAX_TEST_STATES ? [...states.slice(0, MAX_TEST_STATES - 1), states[states.length - 1]] : states;
  const data: ClipData = {
    repo: meta.repo,
    date: e.startedAt.slice(0, 10),
    prompt: e.prompt.replace(/\s+/g, ' ').trim(),
    minutes: Math.round((Date.parse(e.endedAt) - Date.parse(e.startedAt)) / 60_000),
    files,
    codeLines,
    tests: shown,
    moreRuns: states.length - shown.length,
    commits,
    redCount,
  };
  return redactDeep(data, redactOpts);
}
