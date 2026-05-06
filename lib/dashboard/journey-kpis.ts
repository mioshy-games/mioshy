import "server-only";

/**
 * lib/dashboard/journey-kpis.ts
 *
 * Phase 4 - product analytics rollup. Pure DB reads, no calculations
 * over external services. The page renders these into a small KPI
 * dashboard for admins.
 *
 * Funnel we care about:
 *   total entitled users
 *     → assessment started
 *     → assessment completed
 *     → at least one item assigned (clinician acted)
 *     → at least one item available
 *     → at least one item completed
 *     → at least one response submitted
 *     → at least one clinician reply received
 *
 * We deliberately don't compute everything - just the conversion
 * markers that tell us where the funnel collapses.
 */

import { createServiceRoleClient } from "@/lib/supabase-admin";

export interface JourneyKPIs {
  generatedAt: string;
  windowDays: number; // looked at journeys updated in the last N days
  entitledUsers: number; // Journey subscribers (active)
  assessmentStarted: number;
  assessmentCompleted: number;
  itemsScheduled: number; // total scheduled items in the window
  itemsAvailable: number; // unlocked + not completed
  itemsCompleted: number;
  responsesSubmitted: number;
  responsesShort: number; // tagged 'short'
  responsesCrisis: number; // tagged 'crisis_keyword'
  clinicianReplies: number; // responses with clinician_reply_text
  averageReplyLatencyHours: number | null;
  messagesSent: number; // journey_user_messages
  messagesUnread: number; // clinician_status null
  // Drop-off computed in UI as ratios over entitledUsers / assessmentCompleted
}

const DEFAULT_WINDOW_DAYS = 30;

export async function getJourneyKPIs(
  windowDays: number = DEFAULT_WINDOW_DAYS,
): Promise<JourneyKPIs | null> {
  const admin = createServiceRoleClient();
  if (!admin) return null;

  const sinceIso = new Date(
    Date.now() - windowDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  // ── Entitled users - active Journey subscriptions ────────────────
  const { count: entitledUsers } = await admin
    .from("subscriptions")
    .select("user_id", { head: true, count: "exact" })
    .eq("plan_type", "journey")
    .eq("status", "active");

  // ── Assessment funnel ────────────────────────────────────────────
  // We treat: any journey row → started; any journey_responses row → at
  // least one answered; full set → completed. The exact "completed"
  // signal lives in lib/journey-content/owner-status.ts but for KPI
  // purposes we approximate with: at least one ranking response,
  // matching what /my/journey already uses for redirect logic.
  const { count: assessmentStarted } = await admin
    .from("journeys")
    .select("id", { head: true, count: "exact" });

  // Completed: count of journeys with at least one ranking-kind response.
  // Cheap approximation using the responses table.
  const { count: assessmentCompletedRaw } = await admin
    .from("journey_responses")
    .select("journey_id", { head: true, count: "exact" })
    .like("answer", '%"kind":"ranking"%');
  const assessmentCompleted = assessmentCompletedRaw ?? 0;

  // ── Scheduled items in window ────────────────────────────────────
  const { count: itemsScheduled } = await admin
    .from("journey_scheduled_items")
    .select("id", { head: true, count: "exact" })
    .gte("created_at", sinceIso);

  const nowIso = new Date().toISOString();
  const { count: itemsAvailable } = await admin
    .from("journey_scheduled_items")
    .select("id", { head: true, count: "exact" })
    .lte("unlock_at", nowIso)
    .gte("created_at", sinceIso);

  const { count: itemsCompleted } = await admin
    .from("journey_item_completions")
    .select("scheduled_item_id", { head: true, count: "exact" })
    .gte("completed_at", sinceIso);

  // ── Responses ────────────────────────────────────────────────────
  const { count: responsesSubmitted } = await admin
    .from("journey_item_responses")
    .select("id", { head: true, count: "exact" })
    .gte("created_at", sinceIso);

  const { count: responsesShort } = await admin
    .from("journey_item_responses")
    .select("id", { head: true, count: "exact" })
    .gte("created_at", sinceIso)
    .contains("tags", ["short"]);

  const { count: responsesCrisis } = await admin
    .from("journey_item_responses")
    .select("id", { head: true, count: "exact" })
    .gte("created_at", sinceIso)
    .contains("tags", ["crisis_keyword"]);

  // ── Clinician replies ────────────────────────────────────────────
  const { count: clinicianReplies } = await admin
    .from("journey_item_responses")
    .select("id", { head: true, count: "exact" })
    .gte("created_at", sinceIso)
    .not("clinician_replied_at", "is", null);

  // Average reply latency: fetch the (created_at, replied_at) pairs
  // for the window and compute in JS. Not many rows expected here.
  const { data: latencyRows } = await admin
    .from("journey_item_responses")
    .select("created_at, clinician_replied_at")
    .gte("created_at", sinceIso)
    .not("clinician_replied_at", "is", null)
    .limit(1000);
  let averageReplyLatencyHours: number | null = null;
  if ((latencyRows ?? []).length > 0) {
    const sums = (latencyRows ?? []).reduce<{ total: number; count: number }>(
      (acc, r) => {
        const a = Date.parse(String(r.created_at));
        const b = Date.parse(String(r.clinician_replied_at));
        if (!Number.isFinite(a) || !Number.isFinite(b)) return acc;
        const hours = (b - a) / (60 * 60 * 1000);
        if (hours < 0 || hours > 24 * 60) return acc; // sanity bound: 60 days
        return { total: acc.total + hours, count: acc.count + 1 };
      },
      { total: 0, count: 0 },
    );
    averageReplyLatencyHours =
      sums.count > 0 ? Math.round((sums.total / sums.count) * 10) / 10 : null;
  }

  // ── Messages ─────────────────────────────────────────────────────
  const { count: messagesSent } = await admin
    .from("journey_user_messages")
    .select("id", { head: true, count: "exact" })
    .gte("created_at", sinceIso);
  const { count: messagesUnread } = await admin
    .from("journey_user_messages")
    .select("id", { head: true, count: "exact" })
    .gte("created_at", sinceIso)
    .is("clinician_status", null);

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    entitledUsers: entitledUsers ?? 0,
    assessmentStarted: assessmentStarted ?? 0,
    assessmentCompleted,
    itemsScheduled: itemsScheduled ?? 0,
    itemsAvailable: itemsAvailable ?? 0,
    itemsCompleted: itemsCompleted ?? 0,
    responsesSubmitted: responsesSubmitted ?? 0,
    responsesShort: responsesShort ?? 0,
    responsesCrisis: responsesCrisis ?? 0,
    clinicianReplies: clinicianReplies ?? 0,
    averageReplyLatencyHours,
    messagesSent: messagesSent ?? 0,
    messagesUnread: messagesUnread ?? 0,
  };
}
