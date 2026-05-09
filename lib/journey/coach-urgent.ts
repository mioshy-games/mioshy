/**
 * lib/journey/coach-urgent.ts
 *
 * Phase 7 — coach-scoped urgent message surface.
 *
 * Returns urgent + concerning user messages ONLY from couples this
 * specific coach is linked to via expert_couples. Distinct from the
 * admin-wide getUrgentUserMessages which doesn't filter by coach.
 *
 * Powers the "Needs your attention" panel at the top of
 * /dashboard/my-clients so a coach hits the dashboard and immediately
 * sees who's asking for their help — without scrolling through
 * client cards or relying on email alerts.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase-admin";

export interface CoachUrgentRow {
  id:           string;
  surface:      "per_item" | "channel" | "couple";
  body_preview: string;
  sentiment:    "concerning" | "urgent";
  auto_tags:    string[];
  created_at:   string;
  couple_id:    string;
  couple_label: string;
  drill_href:   string;
}

/**
 * Pull urgent + concerning user messages from couples this coach
 * is linked to. Sorts urgent first, then by recency.
 */
export async function getCoachUrgentMessages(args: {
  expertId: string;
  limit?:   number;
}): Promise<CoachUrgentRow[]> {
  const limit = args.limit ?? 20;
  const admin = await createAdminClient();

  // 1. The couples this coach is responsible for.
  const { data: links } = await admin
    .from("expert_couples")
    .select("couple_id")
    .eq("expert_id", args.expertId)
    .eq("is_active", true);
  const coupleIds = ((links ?? []) as Array<{ couple_id: string }>).map(
    (l) => l.couple_id,
  );
  if (coupleIds.length === 0) return [];

  // 2. Pull urgent rows from couple_channel (direct couple_id).
  const { data: cc } = await admin
    .from("journey_couple_channel_messages")
    .select(
      "id, couple_id, body, sentiment, auto_tags, created_at",
    )
    .eq("author_kind", "partner")
    .in("couple_id", coupleIds)
    .in("sentiment", ["urgent", "concerning"])
    .order("created_at", { ascending: false })
    .limit(limit);

  // 3. Pull urgent rows from per-item / channel — these need
  // resolution via scheduled_item → assignment → couple.
  // Strategy: pull the active couple-owned assignments first,
  // then their scheduled items, then filter messages by those ids.
  const { data: assignments } = await admin
    .from("journey_assignments")
    .select("id")
    .in("couple_id", coupleIds)
    .eq("is_active", true);
  const assignmentIds = ((assignments ?? []) as Array<{ id: string }>).map(
    (a) => a.id,
  );
  let jmRows: Array<{
    id:                string;
    scheduled_item_id: string | null;
    channel_user_id:   string | null;
    body:              string;
    sentiment:         "urgent" | "concerning";
    auto_tags:         string[] | null;
    created_at:        string;
  }> = [];
  const schedToCouple = new Map<string, string>();
  if (assignmentIds.length > 0) {
    const { data: scheduled } = await admin
      .from("journey_scheduled_items")
      .select("id, assignment_id")
      .in("assignment_id", assignmentIds);
    const assignmentToCouple = new Map<string, string>();
    // Re-pull with couple_id this time (the earlier query didn't include it).
    const { data: assignmentsFull } = await admin
      .from("journey_assignments")
      .select("id, couple_id")
      .in("id", assignmentIds);
    for (const a of (assignmentsFull ?? []) as Array<{
      id: string;
      couple_id: string | null;
    }>) {
      if (a.couple_id) assignmentToCouple.set(a.id, a.couple_id);
    }
    for (const r of (scheduled ?? []) as Array<{
      id:            string;
      assignment_id: string;
    }>) {
      const c = assignmentToCouple.get(r.assignment_id);
      if (c) schedToCouple.set(r.id, c);
    }
    const schedIds = Array.from(schedToCouple.keys());
    if (schedIds.length > 0) {
      const { data: jm } = await admin
        .from("journey_messages")
        .select(
          "id, scheduled_item_id, channel_user_id, body, sentiment, auto_tags, created_at",
        )
        .eq("author_kind", "user")
        .in("scheduled_item_id", schedIds)
        .in("sentiment", ["urgent", "concerning"])
        .order("created_at", { ascending: false })
        .limit(limit);
      jmRows = (jm ?? []) as typeof jmRows;
    }
  }

  // 4. Resolve couple labels.
  const allCouples = new Set<string>(coupleIds);
  const coupleLabels = new Map<string, string>();
  if (allCouples.size > 0) {
    const { data: members } = await admin
      .from("couple_members")
      .select("couple_id, user_id")
      .in("couple_id", Array.from(allCouples));
    const userIds = Array.from(new Set(
      ((members ?? []) as Array<{ user_id: string }>).map((m) => m.user_id),
    ));
    const nameById = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profs } = await admin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      for (const p of (profs ?? []) as Array<{
        id: string;
        full_name: string | null;
        email: string | null;
      }>) {
        nameById.set(p.id, p.full_name?.trim() || p.email || p.id.slice(0, 6));
      }
    }
    const grouped = new Map<string, string[]>();
    for (const m of (members ?? []) as Array<{
      couple_id: string;
      user_id: string;
    }>) {
      const list = grouped.get(m.couple_id) ?? [];
      list.push(nameById.get(m.user_id) ?? "?");
      grouped.set(m.couple_id, list);
    }
    for (const [cid, names] of grouped) {
      coupleLabels.set(cid, names.slice(0, 2).join(" & "));
    }
  }

  // 5. Merge.
  const merged: CoachUrgentRow[] = [];
  const previewBody = (s: string) => {
    const t = s.trim().replace(/\s+/g, " ");
    return t.length > 140 ? `${t.slice(0, 140)}…` : t;
  };

  for (const r of jmRows) {
    const coupleId =
      (r.scheduled_item_id && schedToCouple.get(r.scheduled_item_id)) || null;
    if (!coupleId) continue;
    merged.push({
      id:           r.id,
      surface:      r.scheduled_item_id ? "per_item" : "channel",
      body_preview: previewBody(r.body),
      sentiment:    r.sentiment,
      auto_tags:    Array.isArray(r.auto_tags) ? r.auto_tags : [],
      created_at:   r.created_at,
      couple_id:    coupleId,
      couple_label: coupleLabels.get(coupleId) ?? "(זוג לא מזוהה)",
      drill_href:   `/dashboard/my-clients/${coupleId}`,
    });
  }
  for (const r of (cc ?? []) as Array<{
    id:         string;
    couple_id:  string;
    body:       string;
    sentiment:  "urgent" | "concerning";
    auto_tags:  string[] | null;
    created_at: string;
  }>) {
    merged.push({
      id:           r.id,
      surface:      "couple",
      body_preview: previewBody(r.body),
      sentiment:    r.sentiment,
      auto_tags:    Array.isArray(r.auto_tags) ? r.auto_tags : [],
      created_at:   r.created_at,
      couple_id:    r.couple_id,
      couple_label: coupleLabels.get(r.couple_id) ?? "(זוג לא מזוהה)",
      drill_href:   `/dashboard/my-clients/${r.couple_id}`,
    });
  }

  // Urgent first, then by recency.
  merged.sort((a, b) => {
    const sa = a.sentiment === "urgent" ? 0 : 1;
    const sb = b.sentiment === "urgent" ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return b.created_at.localeCompare(a.created_at);
  });

  return merged.slice(0, limit);
}
