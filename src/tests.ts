export type TestSummary = { passed: number; failed: number; total: number; failingNames: string[] };

type Counts = { passed: number; failed: number; total?: number };

// One matcher per runner. Each returns every match so the LAST summary in an output wins
// (a wrapper like `npm test` can print a nested runner's summary first).
const FORMATS: { re: RegExp; pick: (m: RegExpExecArray) => Counts }[] = [
  // node --test, spec reporter. The `tests N` line is optional: outputs piped through grep often keep only pass/fail.
  { re: /(?:ℹ tests (\d+)\s*\n\s*(?:ℹ suites \d+\s*\n\s*)?)?ℹ pass (\d+)\s*\n\s*ℹ fail (\d+)/g,
    pick: (m) => ({ total: m[1] ? +m[1] : undefined, passed: +m[2], failed: +m[3] }) },
  // node --test, TAP reporter
  { re: /(?:# tests (\d+)\s*\n\s*(?:# suites \d+\s*\n\s*)?)?# pass (\d+)\s*\n\s*# fail (\d+)/g,
    pick: (m) => ({ total: m[1] ? +m[1] : undefined, passed: +m[2], failed: +m[3] }) },
  // jest: "Tests: 1 failed, 1 todo, 3 passed, 5 total" — groups in any order, any subset
  { re: /Tests:\s+((?:\d+ (?:failed|passed|skipped|todo|pending),? ?)+)(\d+) total/g,
    pick: (m) => ({ ...countsFrom(m[1]), total: +m[2] }) },
  // vitest: " Tests  1 failed | 5 passed (6)"
  { re: /Tests\s+((?:\d+ (?:failed|passed|skipped|todo)(?: \| )?)+)\s*\((\d+)\)/g,
    pick: (m) => ({ ...countsFrom(m[1]), total: +m[2] }) },
  // pytest: "==== 1 failed, 34 passed in 2.1s ===="
  { re: /=+ ((?:\d+ (?:failed|passed|skipped|error|errors|xfailed|xpassed|warnings?),? ?)+)in [\d.]+s/g,
    pick: (m) => countsFrom(m[1]) },
  // cargo: "test result: FAILED. 5 passed; 1 failed; 0 ignored"
  { re: /test result: \w+\. (\d+) passed; (\d+) failed/g,
    pick: (m) => ({ passed: +m[1], failed: +m[2] }) },
];

function countsFrom(groups: string): Counts {
  const passed = /(\d+) passed/.exec(groups);
  const failed = /(\d+) failed/.exec(groups);
  return { passed: passed ? +passed[1] : 0, failed: failed ? +failed[1] : 0 };
}

const FAILING_NAME_RE = /^\s*✖ (?!failing tests:)(.+?) \(\d[\d.]*m?s\)\s*$/gm;

export function parseTestOutput(output: string): TestSummary | null {
  let best: { index: number; summary: Counts } | null = null;
  for (const f of FORMATS) {
    f.re.lastIndex = 0;
    for (let m = f.re.exec(output); m; m = f.re.exec(output))
      if (!best || m.index > best.index) best = { index: m.index, summary: f.pick(m) };
  }
  if (!best) return null;
  const { passed, failed } = best.summary;
  const total = best.summary.total ?? passed + failed;
  // Failing names belong to the winning summary: only names printed after the previous summary count.
  const tail = output.slice(prevSummaryEnd(output, best.index));
  const failingNames = failed > 0 ? [...new Set([...tail.matchAll(FAILING_NAME_RE)].map((m) => m[1].trim()))] : [];
  return { passed, failed, total, failingNames };
}

function prevSummaryEnd(output: string, winnerIndex: number): number {
  let end = 0;
  for (const f of FORMATS) {
    f.re.lastIndex = 0;
    for (let m = f.re.exec(output); m; m = f.re.exec(output))
      if (m.index < winnerIndex) end = Math.max(end, m.index + m[0].length);
  }
  return end;
}
