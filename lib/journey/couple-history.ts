/**
 * lib/journey/couple-history.ts
 *
 * Phase 13 — chronological history of everything that happened with
 * a couple, grouped by day. Used by the per-couple page to give the
 * coach a one-glance view of the entire relationship with the system.
 *
 * Pulls from 4 sources and merges:
 *   - journey_messages (per-item + general channel)
 *   - journey_couple_channel_messages (couple shared channel)
 *   - journey_item_completions (items finished)
 *   - journey_scheduled_items (items pushed/scheduled)
 *
 * Items are sorted newest-first then grouped by day.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase-admin";

export type HistoryEventKind =
  | "user_message"      // user sent a message
  | "coach_message"     // coach replied
  | "couple_message"    // partner posted in couple channel
  | "couple_coach_msg"  // coach posted in couple channel
  | "item_pushed"       // item scheduled for the couple
  | "item_completed";   // item completed by either partner

export interface HistoryEvent {
  id:           string;
  kind:         HistoryEventKind;
  at:           string;            // ISO timestamp
  /** Human-readable preview line. */
  preview:      string;
  /** Optional second line — sentiment / item title / feedback rating. */
  meta?:        string | null;
  /** When clickable, where to drill in. */
  href?:        string | null;
}

export interface HistoryByDay {
  date:    string;        // YYYY-MM-DD (Israel time)
  events:  HistoryEvent[];
}

const PREVIEW_MAX = 110;

function preview(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > PREVIEW_MAX ? `${t.slice(0, PREVIEW_MAX)}…` : t;
}

function dayKey(iso: string): string {
  // Group by Israel-day so the coach sees consistent day buckets.
  const d = new Date(iso);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}

/**
 * Pull the last N days of history for a couple. Returns groups,
 * newest day first.
 */
export async function getCoupleHistory(args: {
  coupleId: string;
  days?:    number;
}): Promise<HistoryByDay[]> {
  const days = args.days ?? 60;
  const admin = await createAdminClient();
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  // ── Resolve assignments + scheduled items for this couple ────
  const { data: assignments } = await admin
    .from("journey_assignments")
    .select("id")
    .eq("couple_id", args.coupleId);
  const assignmentIds = ((assignments ?? []) as Array<{ id: string }>).map(
    (a) => a.id,
  );
  const schedToItem = new Map<string, string>();
  const schedIds: string[] = [];
  if (assignmentIds.length > 0) {
    const { data: scheduled } = await admin
      .from("journey_scheduled_items")
      .select("id, item_id, unlock_at, source")
      .in("assignment_id", assignmentIds);
    for (const r of (scheduled ?? []) as Array<{
      id: string;
      item_id: string;
    }>) {
      schedToItem.set(r.id, r.item_id);
      schedIds.push(r.id);
    }
  }

  // Resolve item titles for every scheduled item we'll reference.
  const itemIds = Array.from(new Set(schedToItem.values()));
  const titleByItem = new Map<string, string>();
  if (itemIds.length > 0) {
    const { data: items } = await admin
      .from("journey_items")
      .select("id, title_he, title_en")
      .in("id", itemIds);
    for (const r of (items ?? []) as Array<{
      id: string;
      title_he: string | null;
      title_en: string | null;
    }>) {
      titleByItem.set(r.id, r.title_he?.trim() || r.title_en?.trim() || "פריט");
    }
  }

  const events: HistoryEvent[] = [];

  // ── Per-item + channel messages ──────────────────────────────
  if (schedIds.length > 0) {
    const { data: jmRows } = await admin
      .from("journey_messages")
      .select(
        "id, scheduled_item_id, body, author_kind, sentiment, created_at",
      )
      .in("scheduled_item_id", schedIds)
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    for (const r of (jmRows ?? []) as Array<{
      id: string;
      scheduled_item_id: string;
      body: string;
      author_kind: string;
      sentiment: string | null;
      created_at: string;
    }>) {
      const itemId = schedToItem.get(r.scheduled_item_id);
      const itemTitle = itemId ? titleByItem.get(itemId) : null;
      events.push({
        id: r.id,
        kind: r.author_kind === "expert" ? "coach_message" : "user_message",
        at: r.created_at,
        preview: preview(r.body),
        meta: [itemTitle, r.sentiment].filter(Boolean).join(" · ") || null,
        href: `/dashboard/my-clients/${args.coupleId}`,
      });
    }
  }

  // ── Couple-channel messages ──────────────────────────────────
  const { data: ccRows } = await admin
    .from("journey_couple_channel_messages")
    .select("id, body, author_kind, sentiment, created_at")
    .eq("couple_id", args.coupleId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  for (const r of (ccRows ?? []) as Array<{
    id: string;
    body: string;
    author_kind: string;
    sentiment: string | null;
    created_at: string;
  }>) {
    events.push({
      id: r.id,
      kind: r.author_kind === "expert" ? "couple_coach_msg" : "couple_message",
      at: r.created_at,
      preview: preview(r.body),
      meta: r.sentiment ?? null,
      href: `/dashboard/my-clients/${args.coupleId}`,
    });
  }

  // ── Item completions ─────────────────────────────────────────
  if (schedIds.length > 0) {
    const { data: comps } = await admin
      .from("journey_item_completions")
      .select("scheduled_item_id, completed_at, completed_by")
      .in("scheduled_item_id", schedIds)
      .gte("completed_at", since)
      .order("completed_at", { ascending: false });
    for (const r of (comps ?? []) as Array<{
      scheduled_item_id: string;
      completed_at: string;
      completed_by: string | null;
    }>) {
      const itemId = schedToItem.get(r.scheduled_item_id);
      const title = itemId ? titleByItem.get(itemId) : null;
      events.push({
        id: `comp-${r.scheduled_item_id}-${r.completed_at}`,
        kind: "item_completed",
        at: r.completed_at,
        preview: title ?? "פריט הושלם",
        meta: "השלמה",
        href: null,
      });
    }
  }

  // ── Item pushes (when scheduled) ─────────────────────────────
  if (assignmentIds.length > 0) {
    const { data: pushes } = await admin
      .from("journey_scheduled_items")
      .select("id, item_id, unlock_at, source, created_at")
      .in("assignment_id", assignmentIds)
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    for (const r of (pushes ?? []) as Array<{
      id: string;
      item_id: string;
      unlock_at: string;
      source: string | null;
      created_at: string;
    }>) {
      const title = titleByItem.get(r.item_id);
      events.push({
        id: `push-${r.id}`,
        kind: "item_pushed",
        at: r.created_at,
        preview: title ?? "פריט הוצמד",
        meta: r.source === "admin_manual"
          ? "דחיפה ידנית"
          : r.source === "expert_push"
            ? "דחיפת מאמן"
            : "auto-cadence",
        href: null,
      });
    }
  }

  // ── Sort + group by day ──────────────────────────────────────
  events.sort((a, b) => b.at.localeCompare(a.at));

  const groups = new Map<string, HistoryEvent[]>();
  for (const e of events) {
    const key = dayKey(e.at);
    const arr = groups.get(key) ?? [];
    arr.push(e);
    groups.set(key, arr);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, eventsList]) => ({ date, events: eventsList }));
}
