/**
 * lib/dashboard/overview.ts
 *
 * Server data layer for the admin dashboard overview block (2026-06-19).
 *
 * Four range-scoped COUNT metrics (current window + the previous window of the
 * same length, for a %-change), plus the inquiries list. Everything reuses
 * existing infrastructure:
 *   - signups        → public.profiles.created_at (1:1 mirror of auth.users,
 *                      created by the handle_new_user signup trigger).
 *   - games subs     → public.subscriptions where product='games'.
 *   - mioshy-sex buy → public.checkout_sessions where purchase_type='one_time'
 *                      and status='paid' (the paid one-times that grant a
 *                      couple_entitlements row).
 *   - chat inquiries → public.journey_messages where author_kind='user'.
 *   - inquiries list + "awaiting reply" → getPendingExpertMessages() — the
 *                      single source of truth already used by the replies page,
 *                      the pending-messages card and the sidebar badge.
 *
 * All metric queries use `count:'exact', head:true` (no rows pulled). Assessment
 * status is resolved in ONE batched journeys query (no N+1).
 */

import { createServiceRoleClient } from "@/lib/supabase-admin";
import {
  getRecentExpertConversations,
  type RecentConversationRow,
} from "@/lib/journey/pending-messages";

export type RangeKey = "24h" | "7d" | "30d" | "custom";

export interface ResolvedRange {
  key: RangeKey;
  start: Date;
  end: Date;
  /** start of the previous window of equal length, for the %-change. */
  prevStart: Date;
  fromInput: string | null; // YYYY-MM-DD (custom only)
  toInput: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function resolveRange(
  sp: { range?: string; from?: string; to?: string } | undefined,
): ResolvedRange {
  const now = new Date();
  const wantsCustom =
    sp?.range === "custom" || (!sp?.range && (!!sp?.from || !!sp?.to));

  if (wantsCustom && (sp?.from || sp?.to)) {
    const start = sp?.from ? new Date(sp.from + "T00:00:00") : new Date(now.getTime() - DAY_MS);
    const end = sp?.to ? new Date(sp.to + "T23:59:59.999") : now;
    const span = Math.max(end.getTime() - start.getTime(), DAY_MS);
    return {
      key: "custom",
      start,
      end,
      prevStart: new Date(start.getTime() - span),
      fromInput: sp?.from ?? null,
      toInput: sp?.to ?? null,
    };
  }

  const days = sp?.range === "7d" ? 7 : sp?.range === "30d" ? 30 : 1;
  const span = days * DAY_MS;
  const end = now;
  const start = new Date(now.getTime() - span);
  const key: RangeKey = sp?.range === "7d" ? "7d" : sp?.range === "30d" ? "30d" : "24h";
  return { key, start, end, prevStart: new Date(start.getTime() - span), fromInput: null, toInput: null };
}

export interface MetricDelta {
  current: number;
  previous: number;
  /** rounded %-change vs the previous window; null when previous was 0. */
  pct: number | null;
}

function delta(current: number, previous: number): MetricDelta {
  const pct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
  return { current, previous, pct };
}

export type InquiryRow = RecentConversationRow & { assessmentDone: boolean };

export interface OverviewData {
  signups: MetricDelta;
  gamesSubs: MetricDelta;
  /** journey subs created in-window WITH the coaching add-on (coaching=true). */
  journeyCoachSubs: MetricDelta;
  /** journey subs created in-window WITHOUT coaching (coaching=false). */
  journeyNoCoachSubs: MetricDelta;
  sexPurchases: MetricDelta;
  chatInquiries: MetricDelta;
  awaitingReply: number;
  inquiries: InquiryRow[];
  degraded: boolean;
}

const EMPTY: MetricDelta = { current: 0, previous: 0, pct: null };

export async function getOverviewData(
  r: ResolvedRange,
  inquiryLimit = 10,
): Promise<OverviewData> {
  const admin = createServiceRoleClient();
  if (!admin) {
    return {
      signups: EMPTY,
      gamesSubs: EMPTY,
      journeyCoachSubs: EMPTY,
      journeyNoCoachSubs: EMPTY,
      sexPurchases: EMPTY,
      chatInquiries: EMPTY,
      awaitingReply: 0,
      inquiries: [],
      degraded: true,
    };
  }

  const sIso = r.start.toISOString();
  const eIso = r.end.toISOString();
  const pIso = r.prevStart.toISOString();

  // Efficient head-only counters (no rows pulled).
  const signupCount = async (from: string, to: string) => {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", from)
      .lt("created_at", to);
    return count ?? 0;
  };
  const gamesSubCount = async (from: string, to: string) => {
    const { count } = await admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("product", "games")
      .gte("created_at", from)
      .lt("created_at", to);
    return count ?? 0;
  };
  // Journey subs split by the coaching add-on. Same shape as gamesSubCount
  // (count on created_at, no status filter), just product='journey' + coaching.
  const journeySubCount = async (from: string, to: string, coaching: boolean) => {
    const { count } = await admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("product", "journey")
      .eq("coaching", coaching)
      .gte("created_at", from)
      .lt("created_at", to);
    return count ?? 0;
  };
  const sexBuyCount = async (from: string, to: string) => {
    const { count } = await admin
      .from("checkout_sessions")
      .select("id", { count: "exact", head: true })
      .eq("purchase_type", "one_time")
      .eq("status", "paid")
      .gte("created_at", from)
      .lt("created_at", to);
    return count ?? 0;
  };
  const chatCount = async (from: string, to: string) => {
    const { count } = await admin
      .from("journey_messages")
      .select("id", { count: "exact", head: true })
      .eq("author_kind", "user")
      .gte("created_at", from)
      .lt("created_at", to);
    return count ?? 0;
  };

  const [
    suCur, suPrev,
    gsCur, gsPrev,
    jcCur, jcPrev,
    jnCur, jnPrev,
    sxCur, sxPrev,
    chCur, chPrev,
    recent,
  ] = await Promise.all([
    signupCount(sIso, eIso), signupCount(pIso, sIso),
    gamesSubCount(sIso, eIso), gamesSubCount(pIso, sIso),
    journeySubCount(sIso, eIso, true), journeySubCount(pIso, sIso, true),
    journeySubCount(sIso, eIso, false), journeySubCount(pIso, sIso, false),
    sexBuyCount(sIso, eIso), sexBuyCount(pIso, sIso),
    chatCount(sIso, eIso), chatCount(pIso, sIso),
    // Latest N conversations, INCLUDING answered ones, so the list never drops
    // a conversation the moment it's replied to. pendingCount is the true
    // (uncapped) awaiting-reply number for the metric tile.
    getRecentExpertConversations({ limit: inquiryLimit }),
  ]);

  // Assessment status for the listed inquiries — ONE batched query (no N+1).
  const userIds = recent.rows.map((row) => row.userId);
  const doneByUser = new Map<string, boolean>();
  if (userIds.length) {
    const { data: jrows } = await admin
      .from("journeys")
      .select("user_id, status")
      .in("user_id", userIds);
    for (const j of (jrows ?? []) as Array<{ user_id: string; status: string | null }>) {
      const done = j.status === "complete" || j.status === "completed";
      // "done" wins if the user has any completed journey row.
      if (done || !doneByUser.has(j.user_id)) doneByUser.set(j.user_id, done);
    }
  }

  const inquiries: InquiryRow[] = recent.rows.map((row) => ({
    ...row,
    assessmentDone: doneByUser.get(row.userId) ?? false,
  }));

  return {
    signups: delta(suCur, suPrev),
    gamesSubs: delta(gsCur, gsPrev),
    journeyCoachSubs: delta(jcCur, jcPrev),
    journeyNoCoachSubs: delta(jnCur, jnPrev),
    sexPurchases: delta(sxCur, sxPrev),
    chatInquiries: delta(chCur, chPrev),
    awaitingReply: recent.pendingCount,
    inquiries,
    degraded: !recent.ok,
  };
}
