import type { Episode, TestRun } from './transcript';
import { parseTestOutput, type TestSummary } from './tests';

export type ScoredEpisode = Episode & { score: number; redToGreen: boolean; tests: (TestSummary | null)[] };

const minutesBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 60_000;

/** A run is red when the parsed summary has failures, or nothing parsed and the command failed. */
export function isRed(run: TestRun, summary: TestSummary | null): boolean {
  return summary ? summary.failed > 0 : !run.exitOk;
}

export function scoreEpisode(e: Episode): ScoredEpisode {
  const runs = e.events.filter((ev): ev is TestRun => ev.kind === 'test');
  const tests = runs.map((r) => parseTestOutput(r.output));
  const colors = runs.map((r, i) => isRed(r, tests[i]));
  const redToGreen = colors.some((red, i) => red && colors.slice(i + 1).includes(false));
  const edits = e.events.filter((ev) => ev.kind === 'write' || ev.kind === 'edit' || ev.kind === 'shell').length;
  const minutes = minutesBetween(e.startedAt, e.endedAt);

  let score = 0;
  if (redToGreen) score += 3;
  score += Math.min(edits, 20) / 5;
  if (minutes >= 3 && minutes <= 90) score += 2;
  if (e.prompt.length > 0 && e.prompt.length <= 400) score += 2;
  return { ...e, score, redToGreen, tests };
}

/** Highest-scoring episode that has at least one edit and one test run; null when none qualifies. */
export function pickEpisode(episodes: Episode[]): ScoredEpisode | null {
  const eligible = episodes
    .filter((e) => e.events.some((ev) => ev.kind === 'test') && e.events.some((ev) => ev.kind !== 'test' && ev.kind !== 'commit'))
    .map(scoreEpisode)
    .sort((a, b) => b.score - a.score);
  return eligible[0] ?? null;
}
