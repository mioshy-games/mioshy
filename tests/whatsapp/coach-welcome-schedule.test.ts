/**
 * coach_welcome scheduling — "next day 10:00 Israel", cutoff 20:00, DST-aware,
 * with the Shabbat rule (no WhatsApp on Saturday).
 *
 * Base: joined <20:00 on D → D+1 10:00; joined ≥20:00 on D → D+2 10:00,
 * implemented as the 10:00 run sending joins in [today−2 20:00, today−1 20:00) IL.
 * Shabbat: the Saturday run sends nothing; the Sunday run widens back to Thursday
 * 20:00 so a Saturday slot is delivered Sunday 10:00 instead.
 *
 * Summer week used below: 2026-07-09 Thu, 07-10 Fri, 07-11 Sat, 07-12 Sun,
 * 07-13 Mon (and 07-06 Mon, 07-07 Tue, 07-08 Wed for the non-Shabbat cutoff).
 * IDT (summer) = UTC+3 → 10:00=07:00Z, 20:00=17:00Z. IST (winter) = UTC+2 →
 * 10:00=08:00Z, 20:00=18:00Z.
 */
import { describe, it, expect } from "vitest";
import {
  israelHour,
  israelWeekday,
  coachWelcomeWindow,
  isDueForCoachWelcome,
} from "@/lib/whatsapp/coach-welcome-schedule";

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

describe("israelWeekday (0=Sun … 6=Sat)", () => {
  it("maps the summer week correctly at 10:00 IL", () => {
    expect(israelWeekday(D("2026-07-09T07:00:00Z"))).toBe(4); // Thu
    expect(israelWeekday(D("2026-07-10T07:00:00Z"))).toBe(5); // Fri
    expect(israelWeekday(D("2026-07-11T07:00:00Z"))).toBe(6); // Sat
    expect(israelWeekday(D("2026-07-12T07:00:00Z"))).toBe(0); // Sun
    expect(israelWeekday(D("2026-07-13T07:00:00Z"))).toBe(1); // Mon
  });
});

describe("coachWelcomeWindow bounds (DST-aware 20:00 cutoff)", () => {
  it("summer Friday run 2026-07-10 10:00 IL → [07-08 17:00Z, 07-09 17:00Z)", () => {
    const w = coachWelcomeWindow(D("2026-07-10T07:00:00Z"));
    expect(new Date(w.lowerMs).toISOString()).toBe("2026-07-08T17:00:00.000Z");
    expect(new Date(w.upperMs).toISOString()).toBe("2026-07-09T17:00:00.000Z");
  });
  it("winter Thursday run 2026-01-08 10:00 IL → [01-06 18:00Z, 01-07 18:00Z) (offset shifts)", () => {
    const w = coachWelcomeWindow(D("2026-01-08T08:00:00Z"));
    expect(new Date(w.lowerMs).toISOString()).toBe("2026-01-06T18:00:00.000Z");
    expect(new Date(w.upperMs).toISOString()).toBe("2026-01-07T18:00:00.000Z");
  });
  it("SHABBAT: Saturday run 2026-07-11 → empty window (lower == upper, sends nothing)", () => {
    const w = coachWelcomeWindow(D("2026-07-11T07:00:00Z"));
    expect(w.lowerMs).toBe(w.upperMs);
  });
  it("SHABBAT: Sunday run 2026-07-12 → widened [Thu 07-09 17:00Z, Sat 07-11 17:00Z)", () => {
    const w = coachWelcomeWindow(D("2026-07-12T07:00:00Z"));
    expect(new Date(w.lowerMs).toISOString()).toBe("2026-07-09T17:00:00.000Z");
    expect(new Date(w.upperMs).toISOString()).toBe("2026-07-11T17:00:00.000Z");
  });
});

describe("cutoff 20:00 — before vs at vs after (non-Shabbat mid-week, summer)", () => {
  // Join on Monday 07-06; D+1 = Tue 07-07, D+2 = Wed 07-08 (neither is Shabbat).
  const runD1 = D("2026-07-07T07:00:00Z"); // Tue 10:00 IL
  const runD2 = D("2026-07-08T07:00:00Z"); // Wed 10:00 IL

  it("join 07-06 19:59 IL → due D+1 (Tue), not D+2", () => {
    const j = D("2026-07-06T16:59:00Z");
    expect(isDueForCoachWelcome(j, runD1)).toBe(true);
    expect(isDueForCoachWelcome(j, runD2)).toBe(false);
  });
  it("join 07-06 20:00 IL (exactly cutoff) → due D+2 (Wed), not D+1", () => {
    const j = D("2026-07-06T17:00:00Z");
    expect(isDueForCoachWelcome(j, runD1)).toBe(false); // exclusive upper
    expect(isDueForCoachWelcome(j, runD2)).toBe(true); // inclusive lower
  });
  it("join 07-06 20:01 IL → due D+2, not D+1", () => {
    const j = D("2026-07-06T17:01:00Z");
    expect(isDueForCoachWelcome(j, runD1)).toBe(false);
    expect(isDueForCoachWelcome(j, runD2)).toBe(true);
  });
  it("join 07-06 09:00 IL (well before cutoff) → due D+1", () => {
    expect(isDueForCoachWelcome(D("2026-07-06T06:00:00Z"), runD1)).toBe(true);
  });
});

describe("cutoff 20:00 — winter (DST offset preserved, non-Shabbat)", () => {
  // Join Tue 01-06; D+1 = Wed 01-07, D+2 = Thu 01-08.
  const runD1 = D("2026-01-07T08:00:00Z"); // Wed 10:00 IL
  const runD2 = D("2026-01-08T08:00:00Z"); // Thu 10:00 IL
  it("join 01-06 19:59 IL → due D+1; join 01-06 20:00 IL → D+2 not D+1", () => {
    expect(isDueForCoachWelcome(D("2026-01-06T17:59:00Z"), runD1)).toBe(true); // 19:59 IL
    expect(isDueForCoachWelcome(D("2026-01-06T18:00:00Z"), runD1)).toBe(false); // 20:00 IL
    expect(isDueForCoachWelcome(D("2026-01-06T18:00:00Z"), runD2)).toBe(true); // → D+2
  });
});

describe("SHABBAT rule — the six join→send mappings (summer week)", () => {
  const runFri = D("2026-07-10T07:00:00Z");
  const runSat = D("2026-07-11T07:00:00Z"); // sends nothing
  const runSun = D("2026-07-12T07:00:00Z"); // absorbs the Saturday group
  const runMon = D("2026-07-13T07:00:00Z");

  it("Thu <20:00 → Fri 10:00 (unchanged)", () => {
    const j = D("2026-07-09T15:00:00Z"); // Thu 18:00 IL
    expect(isDueForCoachWelcome(j, runFri)).toBe(true);
    expect(isDueForCoachWelcome(j, runSat)).toBe(false);
    expect(isDueForCoachWelcome(j, runSun)).toBe(false);
  });
  it("Thu ≥20:00 → would be Sat → deferred to Sun 10:00", () => {
    const j = D("2026-07-09T17:30:00Z"); // Thu 20:30 IL
    expect(isDueForCoachWelcome(j, runFri)).toBe(false);
    expect(isDueForCoachWelcome(j, runSat)).toBe(false); // Shabbat: no send
    expect(isDueForCoachWelcome(j, runSun)).toBe(true);
  });
  it("Fri <20:00 → would be Sat → deferred to Sun 10:00", () => {
    const j = D("2026-07-10T15:00:00Z"); // Fri 18:00 IL
    expect(isDueForCoachWelcome(j, runSat)).toBe(false); // Shabbat: no send
    expect(isDueForCoachWelcome(j, runSun)).toBe(true);
  });
  it("Fri ≥20:00 → Sun 10:00 (unchanged)", () => {
    const j = D("2026-07-10T17:30:00Z"); // Fri 20:30 IL
    expect(isDueForCoachWelcome(j, runSun)).toBe(true);
    expect(isDueForCoachWelcome(j, runMon)).toBe(false);
  });
  it("Sat <20:00 → Sun 10:00 (unchanged)", () => {
    const j = D("2026-07-11T15:00:00Z"); // Sat 18:00 IL
    expect(isDueForCoachWelcome(j, runSun)).toBe(true);
    expect(isDueForCoachWelcome(j, runMon)).toBe(false);
  });
  it("Sat ≥20:00 → Mon 10:00 (unchanged)", () => {
    const j = D("2026-07-11T17:30:00Z"); // Sat 20:30 IL
    expect(isDueForCoachWelcome(j, runSun)).toBe(false);
    expect(isDueForCoachWelcome(j, runMon)).toBe(true);
  });
  it("Saturday run sends nothing for ANY join in the Fri/Sat window", () => {
    expect(isDueForCoachWelcome(D("2026-07-09T17:30:00Z"), runSat)).toBe(false);
    expect(isDueForCoachWelcome(D("2026-07-10T15:00:00Z"), runSat)).toBe(false);
    expect(isDueForCoachWelcome(D("2026-07-10T17:30:00Z"), runSat)).toBe(false);
  });
});
