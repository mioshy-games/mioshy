/**
 * lib/poll/percent.ts
 *
 * Live poll percentage — the Bayesian cold-start formula from the spec (§8):
 *
 *   pct_a = (prior_a + count_a) / (prior_a + prior_b + count_a + count_b) × 100
 *
 * prior_a/prior_b are the admin's cold-start estimates (pseudo-counts).
 * count_a/count_b are REAL votes (never invented, §13). The reveal shows only
 * these numbers — no graph/bar (§8). We round pct_a and set pct_b = 100 − pct_a
 * so the two always sum to exactly 100.
 */

export interface PollTallyInput {
  priorA: number;
  priorB: number;
  countA: number;
  countB: number;
}

export interface PollPercent {
  /** Integer percent for option A (0–100). */
  pctA: number;
  /** Integer percent for option B; pctA + pctB === 100. */
  pctB: number;
  /** REAL total votes cast on this question (count_a + count_b). */
  totalVotes: number;
}

export function computePollPercent({
  priorA,
  priorB,
  countA,
  countB,
}: PollTallyInput): PollPercent {
  const a = Math.max(0, priorA) + Math.max(0, countA);
  const b = Math.max(0, priorB) + Math.max(0, countB);
  const denom = a + b;
  const pctA = denom > 0 ? Math.round((a / denom) * 100) : 50;
  return { pctA, pctB: 100 - pctA, totalVotes: countA + countB };
}
