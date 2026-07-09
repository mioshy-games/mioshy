/**
 * coach_welcome scheduling — "next day 10:00 Israel", cutoff 20:00, DST-aware.
 * Rule: joined <20:00 on D → D+1 10:00; joined ≥20:00 on D → D+2 10:00.
 * Implemented as: the 10:00 run sends joins in [today−2 20:00, today−1 20:00) IL.
 */
import { describe, it, expect } from "vitest";
import {
  israelHour,
  coachWelcomeWindow,
  isDueForCoachWelcome,
} from "@/lib/whatsapp/coach-welcome-schedule";

// Israel local ↔ UTC: summer (IDT) = UTC+3 → 10:00=07:00Z, 20:00=17:00Z;
//                     winter (IST) = UTC+2 → 10:00=08:00Z, 20:00=18:00Z.
const D = (iso: string) => new Date(iso);

describe("israelHour (DST-aware, drives the two-cron 10:00 gate)", () => {
  it("summer: 07:00Z = 10:00 IL (runs); 08:00Z = 11:00 IL (skips)", () => {
    expect(israelHour(D("2026-07-10T07:00:00Z"))).toBe(10);
    expect(israelHour(D("2026-07-10T08:00:00Z"))).toBe(11);
  });
  it("winter: 08:00Z = 10:00 IL (runs); 07:00Z = 09:00 IL (skips)", () => {
    expect(israelHour(D("2026-01-10T08:00:00Z"))).toBe(10);
    expect(israelHour(D("2026-01-10T07:00:00Z"))).toBe(9);
  });
});

describe("coachWelcomeWindow bounds (DST-aware 20:00 cutoff)", () => {
  it("summer run 2026-07-10 10:00 IL → [07-08 17:00Z, 07-09 17:00Z)", () => {
    const w = coachWelcomeWindow(D("2026-07-10T07:00:00Z"));
    expect(new Date(w.lowerMs).toISOString()).toBe("2026-07-08T17:00:00.000Z");
    expect(new Date(w.upperMs).toISOString()).toBe("2026-07-09T17:00:00.000Z");
  });
  it("winter run 2026-01-10 10:00 IL → [01-08 18:00Z, 01-09 18:00Z) (offset shifts)", () => {
    const w = coachWelcomeWindow(D("2026-01-10T08:00:00Z"));
    expect(new Date(w.lowerMs).toISOString()).toBe("2026-01-08T18:00:00.000Z");
    expect(new Date(w.upperMs).toISOString()).toBe("2026-01-09T18:00:00.000Z");
  });
});

describe("cutoff 20:00 — join before vs at vs after (summer)", () => {
  const runD1 = D("2026-07-10T07:00:00Z"); // 07-10 10:00 IL (would send D+1 joins from 07-09)
  const runD2 = D("2026-07-11T07:00:00Z"); // 07-11 10:00 IL (would send D+2 joins from 07-09)

  it("join 07-09 19:59 IL → due on D+1 (07-10), not D+2", () => {
    const j = D("2026-07-09T16:59:00Z"); // 19:59 IL
    expect(isDueForCoachWelcome(j, runD1)).toBe(true);
    expect(isDueForCoachWelcome(j, runD2)).toBe(false);
  });
  it("join 07-09 20:00 IL (exactly cutoff) → due on D+2 (07-11), not D+1", () => {
    const j = D("2026-07-09T17:00:00Z"); // 20:00 IL
    expect(isDueForCoachWelcome(j, runD1)).toBe(false); // exclusive upper bound
    expect(isDueForCoachWelcome(j, runD2)).toBe(true); // inclusive lower bound
  });
  it("join 07-09 20:01 IL → due on D+2, not D+1", () => {
    const j = D("2026-07-09T17:01:00Z"); // 20:01 IL
    expect(isDueForCoachWelcome(j, runD1)).toBe(false);
    expect(isDueForCoachWelcome(j, runD2)).toBe(true);
  });
  it("join 07-09 23:00 IL (past midnight bucket) → due on D+2, not D+1", () => {
    const j = D("2026-07-09T20:00:00Z"); // 23:00 IL
    expect(isDueForCoachWelcome(j, runD1)).toBe(false);
    expect(isDueForCoachWelcome(j, runD2)).toBe(true);
  });
  it("join 07-09 09:00 IL (well before cutoff) → due on D+1", () => {
    const j = D("2026-07-09T06:00:00Z"); // 09:00 IL
    expect(isDueForCoachWelcome(j, runD1)).toBe(true);
  });
});

describe("cutoff 20:00 — winter (DST offset preserved)", () => {
  const runD1 = D("2026-01-10T08:00:00Z"); // 01-10 10:00 IL
  it("join 01-09 19:59 IL → due D+1; join 01-09 20:00 IL → not D+1", () => {
    expect(isDueForCoachWelcome(D("2026-01-09T17:59:00Z"), runD1)).toBe(true); // 19:59 IL
    expect(isDueForCoachWelcome(D("2026-01-09T18:00:00Z"), runD1)).toBe(false); // 20:00 IL
  });
});

describe("Itzik's examples (join → expected send day, summer)", () => {
  const run10 = D("2026-07-10T07:00:00Z");
  const run11 = D("2026-07-11T07:00:00Z");
  it("09.7 09:00 → 10.7", () => {
    expect(isDueForCoachWelcome(D("2026-07-09T06:00:00Z"), run10)).toBe(true);
  });
  it("09.7 17:00 → 10.7", () => {
    expect(isDueForCoachWelcome(D("2026-07-09T14:00:00Z"), run10)).toBe(true);
  });
  it("09.7 20:00 → 11.7", () => {
    expect(isDueForCoachWelcome(D("2026-07-09T17:00:00Z"), run10)).toBe(false);
    expect(isDueForCoachWelcome(D("2026-07-09T17:00:00Z"), run11)).toBe(true);
  });
  it("09.7 23:00 → 11.7", () => {
    expect(isDueForCoachWelcome(D("2026-07-09T20:00:00Z"), run10)).toBe(false);
    expect(isDueForCoachWelcome(D("2026-07-09T20:00:00Z"), run11)).toBe(true);
  });
});
