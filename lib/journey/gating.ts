/**
 * lib/journey/gating.ts (F3.2)
 *
 * ONE shared, pure gate function imported by BOTH the client (JourneyClient)
 * and the server (app/api/journey/answer/route.ts), so the auth/paywall
 * boundary can never drift between them. Replaces the old index-arithmetic
 * (auth_after_index / paywall_after_index).
 *
 * Flow modes:
 *   - 'short'  : pre-purchase. Active set = the SHORT questions. At phase
 *                completion → register (if anon) → short report → paywall CTA.
 *   - 'full'   : subscriber. Active set = ALL unanswered diagnostic questions
 *                (short ∪ full, answer-driven). No paywall (already paid).
 *   - 'single' : DB unseeded (loader JSON fallback). Active set = the full
 *                questionnaire as one pass — behaves exactly like today.
 *
 * Auth fires at PHASE COMPLETION (matches today's end-of-flow registration —
 * the F8 fix removed the mid-flow gate), NOT at an early threshold.
 */

export type JourneyFlowMode = "short" | "full" | "single";

export interface GateInput {
  mode: JourneyFlowMode;
  /** # of questions in the active phase set. */
  phaseTotal: number;
  /** # of those phase questions already answered. */
  answeredInPhaseCount: number;
  authenticated: boolean;
  subscriptionActive: boolean;
}

export interface GateResult {
  /** All active-phase questions answered. */
  phaseComplete: boolean;
  /** Must register before the report (anon finished the phase). */
  needsAuth: boolean;
  /** Must purchase to unlock the next phase (short/single complete, authed, unpaid). */
  needsPaywall: boolean;
}

export function computeGate(input: GateInput): GateResult {
  const phaseComplete =
    input.phaseTotal > 0 && input.answeredInPhaseCount >= input.phaseTotal;

  // Auth at completion, exactly as today's flow registers before the report.
  const needsAuth = phaseComplete && !input.authenticated;

  // Paywall is the short→full transition; never inside the short set, never in
  // 'full' mode (already subscribed). Auth takes precedence (register first).
  const needsPaywall =
    phaseComplete &&
    input.authenticated &&
    !input.subscriptionActive &&
    (input.mode === "short" || input.mode === "single");

  return { phaseComplete, needsAuth, needsPaywall };
}

/** report_phase set-point for a completed flow. */
export function reportPhaseForMode(mode: JourneyFlowMode): "short" | "full" {
  return mode === "short" ? "short" : "full";
}
