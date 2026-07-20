/**
 * The four WhatsApp "iron rules" + the safe-mode (allowlist) gate.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isInIntroReminderWindow,
  isReminderEligible,
  coachWelcomeApplies,
  throttlePassed,
} from "@/lib/whatsapp/rules";
import { modeAllows, getWhatsAppMode, getAllowlist } from "@/lib/whatsapp/campaign";

const MIN = 60 * 1000;
const now = 1_800_000_000_000; // fixed "now"

describe("intro reminder window (15–20 min remaining, half-open [15,20))", () => {
  it("17 min left → in window", () => {
    expect(isInIntroReminderWindow(now + 17 * MIN, now)).toBe(true);
  });
  it("exactly 15 min left → in window (inclusive lower bound)", () => {
    expect(isInIntroReminderWindow(now + 15 * MIN, now)).toBe(true);
  });
  it("exactly 20 min left → NOT (exclusive upper bound)", () => {
    expect(isInIntroReminderWindow(now + 20 * MIN, now)).toBe(false);
  });
  it("14 min left → NOT (below the strip)", () => {
    expect(isInIntroReminderWindow(now + 14 * MIN, now)).toBe(false);
  });
  it("25 min left → NOT (above the strip)", () => {
    expect(isInIntroReminderWindow(now + 25 * MIN, now)).toBe(false);
  });
  it("expiry already passed → NOT (window closed)", () => {
    expect(isInIntroReminderWindow(now - 1, now)).toBe(false);
  });
});

describe("Rule 1 + 3 — a purchaser NEVER gets the reminder (checked at send time)", () => {
  const base = { offerExpiresAtMs: now + 17 * MIN, nowMs: now };
  it("non-purchaser in window → eligible", () => {
    expect(isReminderEligible({ ...base, hasActiveJourney: false, hasAnySubscription: false })).toBe(true);
  });
  it("has active journey access (active/grace/trial) → excluded", () => {
    expect(isReminderEligible({ ...base, hasActiveJourney: true, hasAnySubscription: false })).toBe(false);
  });
  it("has ANY subscription row ever → excluded (rule 3: purchase stops it)", () => {
    expect(isReminderEligible({ ...base, hasActiveJourney: false, hasAnySubscription: true })).toBe(false);
  });
  it("out of window → excluded even for a non-purchaser", () => {
    expect(
      isReminderEligible({ offerExpiresAtMs: now + 30 * MIN, nowMs: now, hasActiveJourney: false, hasAnySubscription: false }),
    ).toBe(false);
  });
});

describe("Rule 2 — a non-purchaser NEVER gets the coach welcome (journey purchase only)", () => {
  it("journey purchase → coach applies", () => {
    expect(coachWelcomeApplies("journey")).toBe(true);
  });
  it("games / adults purchase → coach does NOT apply", () => {
    expect(coachWelcomeApplies("games")).toBe(false);
    expect(coachWelcomeApplies("adults")).toBe(false);
  });
});

describe("Rule 4 — at most one outbound WhatsApp per 7 days", () => {
  it("no prior message this week → passes", () => {
    expect(throttlePassed(0)).toBe(true);
  });
  it("one or more prior messages this week → blocked", () => {
    expect(throttlePassed(1)).toBe(false);
    expect(throttlePassed(3)).toBe(false);
  });
});

describe("Safe mode — WHATSAPP_MODE off / allowlist / live", () => {
  const OLD = { mode: process.env.WHATSAPP_MODE, list: process.env.WHATSAPP_ALLOWLIST };
  const IN = "972545215193";
  const OUT = "972500000000";
  beforeEach(() => {
    process.env.WHATSAPP_ALLOWLIST = "972545215193";
  });
  afterEach(() => {
    process.env.WHATSAPP_MODE = OLD.mode;
    process.env.WHATSAPP_ALLOWLIST = OLD.list;
  });

  it("off → nothing is allowed", () => {
    process.env.WHATSAPP_MODE = "off";
    expect(getWhatsAppMode()).toBe("off");
    expect(modeAllows(IN).allowed).toBe(false);
    expect(modeAllows(IN).reason).toBe("mode_off");
  });
  it("live → everyone is allowed", () => {
    process.env.WHATSAPP_MODE = "live";
    expect(modeAllows(OUT).allowed).toBe(true);
  });
  it("allowlist → only the listed number sends; others journal as would_send", () => {
    process.env.WHATSAPP_MODE = "allowlist";
    expect(getAllowlist().has(IN)).toBe(true);
    expect(modeAllows(IN).allowed).toBe(true);
    const other = modeAllows(OUT);
    expect(other.allowed).toBe(false);
    expect(other.reason).toBe("allowlist_skip");
  });
});
