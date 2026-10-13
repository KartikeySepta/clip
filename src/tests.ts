export type TestSummary = { passed: number; failed: number; total: number; failingNames: string[] };

// One matcher per runner. Each returns every match so the LAST summary in an output wins
// (a wrapper like `npm test` can print a nested runner's summary first).
const FORMATS: { re: RegExp; pick: (m: RegExpExecArray) => { passed: number; failed: number; total?: number } }[] = [
  // node --test, spec reporter
  { re: /ℹ tests (\d+)\s*\n\s*ℹ (?:suites \d+\s*\n\s*)?pass (\d+)\s*\n\s*ℹ fail (\d+)/g,
    pick: (m) => ({ total: +m[1], passed: +m[2], failed: +m[3] }) },
  // node --test, TAP reporter
  { re: /# tests (\d+)\s*\n\s*(?:# suites \d+\s*\n\s*)?# pass (\d+)\s*\n\s*# fail (\d+)/g,
    pick: (m) => ({ total: +m[1], passed: +m[2], failed: +m[3] }) },
  // jest / vitest
  { re: /Tests:\s+(?:(\d+) failed, )?(?:(\d+) skipped, )?(\d+) passed, (\d+) total/g,
    pick: (m) => ({ failed: +(m[1] ?? 0), passed: +m[3], total: +m[4] }) },
  // pytest
  { re: /=+ (?:(\d+) failed, )?(\d+) passed[^=\n]* in [\d.]+s/g,
    pick: (m) => ({ failed: +(m[1] ?? 0), passed: +m[2] }) },
];

const FAILING_NAME_RE = /^\s*✖ (?!failing tests:)(.+?) \(\d[\d.]*m?s\)\s*$/gm;

export function parseTestOutput(output: string): TestSummary | null {
  let best: { index: number; summary: { passed: number; failed: number; total?: number } } | null = null;
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
