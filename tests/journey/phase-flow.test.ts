/**
 * F3.2 — gate + flow-resolution unit tests (the pure core both client and
 * server share). Covers the auth/paywall boundary, the answer-driven active
 * set, the point-1 direct-subscriber edge, and the unseeded single-flow
 * fallback.
 */

import { describe, it, expect } from "vitest";
import { computeGate } from "@/lib/journey/gating";
import { resolveJourneyFlow } from "@/lib/journey/phase";
import { QUESTIONS as STATIC_QUESTIONS } from "@/lib/journey/questions";
import type { JourneyQuestionRow } from "@/lib/journey/questions-db";

// ── computeGate ──────────────────────────────────────────────────────────────
describe("computeGate — phase boundary (auth at completion, paywall at short→full)", () => {
  it("short, mid-flow → no gate", () => {
    expect(computeGate({ mode: "short", phaseTotal: 11, answeredInPhaseCount: 5, authenticated: false, subscriptionActive: false }))
      .toEqual({ phaseComplete: false, needsAuth: false, needsPaywall: false });
  });
  it("short complete + anon → needsAuth (register before report)", () => {
    expect(computeGate({ mode: "short", phaseTotal: 11, answeredInPhaseCount: 11, authenticated: false, subscriptionActive: false }))
      .toEqual({ phaseComplete: true, needsAuth: true, needsPaywall: false });
  });
  it("short complete + authed + unpaid → needsPaywall (auth precedence already cleared)", () => {
    expect(computeGate({ mode: "short", phaseTotal: 11, answeredInPhaseCount: 11, authenticated: true, subscriptionActive: false }))
      .toEqual({ phaseComplete: true, needsAuth: false, needsPaywall: true });
  });
  it("full complete + subscribed → done, no auth/paywall", () => {
    expect(computeGate({ mode: "full", phaseTotal: 28, answeredInPhaseCount: 28, authenticated: true, subscriptionActive: true }))
      .toEqual({ phaseComplete: true, needsAuth: false, needsPaywall: false });
  });
  it("single (unseeded) complete + authed + unpaid → paywall at end (today's behaviour)", () => {
    expect(computeGate({ mode: "single", phaseTotal: 28, answeredInPhaseCount: 28, authenticated: true, subscriptionActive: false }))
      .toEqual({ phaseComplete: true, needsAuth: false, needsPaywall: true });
  });
});

// ── resolveJourneyFlow ───────────────────────────────────────────────────────
// 4 seeded rows: positions 0(short) 1(full) 2(short) 3(full) — interleaved so
// the subscriber "remaining" must respect position order across phases.
const ROWS: JourneyQuestionRow[] = [0, 1, 2, 3].map((p) => ({
  slug: `s${p}`,
  position: p,
  phase: p % 2 === 0 ? "short" : "full",
  type: "likert5",
  domain: null,
  axes: [],
  reverse: false,
  he_text: `he${p}`,
  en_text: `en${p}`,
  options: null,
  meta: null,
  is_active: true,
}));
const SHORT_ROWS = ROWS.filter((r) => r.phase === "short");

function mockClient(allRows: JourneyQuestionRow[], shortRows: JourneyQuestionRow[]) {
  return {
    from() {
      const eqs: Array<[string, unknown]> = [];
      const b: Record<string, unknown> = {};
      Object.assign(b, {
        select: () => b,
        eq: (c: string, v: unknown) => { eqs.push([c, v]); return b; },
        order: () => b,
        then: (resolve: (v: { data: JourneyQuestionRow[]; error: null }) => void) => {
          const phaseEq = eqs.find(([c]) => c === "phase");
          const rows = phaseEq && phaseEq[1] === "short" ? shortRows : allRows;
          resolve({ data: rows, error: null });
        },
      });
      return b;
    },
  } as never;
}

describe("resolveJourneyFlow — answer-driven active set", () => {
  it("not subscribed, seeded → mode short, phaseSet = short only, remaining excludes answered", async () => {
    const flow = await resolveJourneyFlow({
      client: mockClient(ROWS, SHORT_ROWS),
      subscriptionActive: false,
      answeredSlugs: new Set(["s0"]),
    });
    expect(flow.mode).toBe("short");
    expect(flow.phaseTotal).toBe(2);
    expect(flow.remaining.map((q) => q.id)).toEqual(["s2"]); // s0 answered, s2 next
    expect(flow.answeredInPhaseCount).toBe(1);
  });

  it("subscriber who finished short → mode full, remaining = full delta only (point 1)", async () => {
    const flow = await resolveJourneyFlow({
      client: mockClient(ROWS, SHORT_ROWS),
      subscriptionActive: true,
      answeredSlugs: new Set(["s0", "s2"]), // both short answered
    });
    expect(flow.mode).toBe("full");
    expect(flow.phaseTotal).toBe(4); // short ∪ full
    expect(flow.remaining.map((q) => q.id)).toEqual(["s1", "s3"]); // only full, position order
    expect(flow.answeredInPhaseCount).toBe(2);
  });

  it("DIRECT subscriber who SKIPPED short → mode full, remaining = ALL diagnostic (point 1 edge)", async () => {
    const flow = await resolveJourneyFlow({
      client: mockClient(ROWS, SHORT_ROWS),
      subscriptionActive: true,
      answeredSlugs: new Set(), // bought without answering anything
    });
    expect(flow.mode).toBe("full");
    expect(flow.phaseTotal).toBe(4);
    expect(flow.remaining.map((q) => q.id)).toEqual(["s0", "s1", "s2", "s3"]); // all 4, no partial report
  });

  it("unseeded table → mode single (full questionnaire as one pass), even if subscribed", async () => {
    const flow = await resolveJourneyFlow({
      client: mockClient([], SHORT_ROWS), // empty DB → JSON fallback
      subscriptionActive: true,
      answeredSlugs: new Set(),
    });
    expect(flow.mode).toBe("single");
    expect(flow.source).toBe("json");
    expect(flow.phaseTotal).toBe(STATIC_QUESTIONS.length);
    expect(flow.remaining.length).toBe(STATIC_QUESTIONS.length);
  });
});
