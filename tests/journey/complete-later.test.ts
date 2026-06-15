/**
 * F3.2 — "complete later" derived state + report_phase set-points.
 */

import { describe, it, expect } from "vitest";
import { deriveFullAssessmentPending } from "@/lib/journey/full-assessment-pending";
import { reportPhaseForMode } from "@/lib/journey/gating";

describe("deriveFullAssessmentPending — /my 'complete later' card", () => {
  it("subscriber with a SHORT report and incomplete journey → pending (card shows)", () => {
    expect(deriveFullAssessmentPending({ subscriptionActive: true, latestReportPhase: "short", latestJourneyStatus: "paywall" })).toBe(true);
  });
  it("subscriber whose latest report is FULL → not pending (card hides)", () => {
    expect(deriveFullAssessmentPending({ subscriptionActive: true, latestReportPhase: "full", latestJourneyStatus: "complete" })).toBe(false);
  });
  it("not subscribed → never pending", () => {
    expect(deriveFullAssessmentPending({ subscriptionActive: false, latestReportPhase: "short", latestJourneyStatus: "paywall" })).toBe(false);
  });
  it("no analysis yet → not pending", () => {
    expect(deriveFullAssessmentPending({ subscriptionActive: true, latestReportPhase: null, latestJourneyStatus: "in_progress" })).toBe(false);
  });
  it("journey already complete → not pending (guard)", () => {
    expect(deriveFullAssessmentPending({ subscriptionActive: true, latestReportPhase: "short", latestJourneyStatus: "complete" })).toBe(false);
  });
});

describe("reportPhaseForMode — set-points", () => {
  it("short mode → 'short' report at short-complete", () => {
    expect(reportPhaseForMode("short")).toBe("short");
  });
  it("full mode → 'full' report at full-complete", () => {
    expect(reportPhaseForMode("full")).toBe("full");
  });
  it("single (unseeded) mode → 'full' report (today's behaviour)", () => {
    expect(reportPhaseForMode("single")).toBe("full");
  });
});
