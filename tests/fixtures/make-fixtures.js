// Generates the synthetic transcript fixtures. Run: node tests/fixtures/make-fixtures.js
// Same line shape as real Claude Code transcripts; all content invented.
const fs = require('node:fs');
const path = require('node:path');

const CWD = '/home/dev/proj';
const T0 = Date.parse('2026-10-04T04:00:00.000Z');
let n = 0;
const ts = (min) => new Date(T0 + min * 60_000).toISOString();
const base = (min, extra) => ({ cwd: CWD, isSidechain: false, sessionId: 's1', timestamp: ts(min), uuid: `u${n++}`, ...extra });
const prompt = (min, text) => base(min, { type: 'user', message: { role: 'user', content: text } });
const toolUse = (min, id, name, input) =>
  base(min, { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] } });
const toolResult = (min, id, isError, text, extra) =>
  base(min, {
    type: 'user',
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, is_error: isError, content: text }] },
    toolUseResult: extra,
  });
const bashResult = (min, id, isError, stdout) =>
  toolResult(min, id, isError, stdout, { stdout, stderr: '', interrupted: false, isImage: false });

const redGreen = [
  prompt(0, 'say hello'),
  base(0.1, { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'hello' }] } }),
  prompt(1, 'Make the snapshot engine faster and keep the tests green'),
  toolUse(2, 't1', 'Write', { file_path: `${CWD}/src/clone.ts`, content: 'a\nb\n' }),
  toolResult(2.1, 't1', false, 'ok', { type: 'create', filePath: `${CWD}/src/clone.ts`, structuredPatch: [{ lines: ['+a', '+b'] }] }),
  { ...base(2.5, { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'subagent noise' }] } }), isSidechain: true },
  toolUse(3, 't2', 'Edit', { file_path: `${CWD}/src/snapshot.ts`, old_string: 'x', new_string: 'y' }),
  toolResult(3.1, 't2', false, 'ok', { type: 'update', filePath: `${CWD}/src/snapshot.ts`, structuredPatch: [{ lines: ['-x', '+y', '+y2', '+y3'] }] }),
  toolUse(5, 't3', 'Bash', { command: 'node --test tests/' }),
  bashResult(5.2, 't3', true, 'ℹ tests 9\nℹ pass 8\nℹ fail 1\n✖ failing tests:\n✖ copy fallback honours the size guard (1.2ms)\n'),
  toolUse(7, 't4', 'Bash', { command: 'npm test' }),
  bashResult(7.3, 't4', false, 'ℹ tests 9\nℹ pass 9\nℹ fail 0\n'),
  toolUse(8.5, 't5', 'Bash', { command: "git commit -m 'feat: thing'" }),
  bashResult(9, 't5', false, '[main abc1234] feat: thing\n 2 files changed\n'),
];

const noTests = [
  prompt(0, 'tidy the README'),
  toolUse(1, 'a1', 'Edit', { file_path: `${CWD}/README.md` }),
  toolResult(1.1, 'a1', false, 'ok', { filePath: `${CWD}/README.md`, structuredPatch: [{ lines: ['+hi'] }] }),
  toolUse(2, 'a2', 'Edit', { file_path: `${CWD}/README.md` }),
  toolResult(2.1, 'a2', false, 'ok', { filePath: `${CWD}/README.md`, structuredPatch: [{ lines: ['-hi', '+hello'] }] }),
];

const broken = [...redGreen];
broken.splice(6, 0, '{"type":"assist', toolResult(2.6, 'never-seen', false, 'orphan', { stdout: 'x' }));

const write = (name, lines) =>
  fs.writeFileSync(path.join(__dirname, name), lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n') + '\n');
write('red-green.jsonl', redGreen);
write('no-tests.jsonl', noTests);
write('broken-lines.jsonl', broken);
