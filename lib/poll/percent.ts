/**
 * lib/poll/percent.ts
 *
 * Live poll percentage — REAL votes only:
 *
 *   pct_a = count_a / (count_a + count_b) × 100
 *
 * The cold-start Bayesian priors were removed (Itzik, 2026-07-27): the number
 * on screen and the percentage next to it must tell the same story, so nothing
 * is padded. A question with no votes yet has no percentage at all
 * (`hasVotes: false`) — the UI says the visitor is the first to answer instead
 * of showing a meaningless 100% / 50%.
 *
 * We round pct_a and set pct_b = 100 − pct_a so the two always sum to exactly 100.
 */

export interface PollTallyInput {
  countA: number;
  countB: number;
}

export interface PollPercent {
  /** Integer percent for option A (0–100); 0 when there are no votes yet. */
  pctA: number;
  /** Integer percent for option B; pctA + pctB === 100 when hasVotes. */
  pctB: number;
  /** REAL total votes cast on this question (count_a + count_b). */
  totalVotes: number;
  /** False when the question has no votes at all — percentages are meaningless. */
  hasVotes: boolean;
}

export function computePollPercent({ countA, countB }: PollTallyInput): PollPercent {
  const a = Math.max(0, countA);
  const b = Math.max(0, countB);
  const denom = a + b;
  if (denom === 0) return { pctA: 0, pctB: 0, totalVotes: 0, hasVotes: false };
  const pctA = Math.round((a / denom) * 100);
  return { pctA, pctB: 100 - pctA, totalVotes: denom, hasVotes: true };
}
