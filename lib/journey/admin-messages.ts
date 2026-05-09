/**
 * lib/journey/admin-messages.ts
 *
 * Layer-3 admin tracker — read helpers for the unified expert-message
 * view at /dashboard/journey/expert-messages.
 *
 * Pulls expert-authored rows from BOTH messaging surfaces and merges
 * them into a single chronological feed:
 *   - journey_messages (per-item threads + per-user general channel)
 *   - journey_couple_channel_messages (couple-shared channel)
 *
 * Both tables carry a `topic_tags TEXT[]` column (migration 075) that
 * the action layer stamps from the source library row when a coach
 * inserts from their saved replies. Rows without a library origin
 * have `topic_tags = '{}'` and surface as "untagged" in the UI.
 *
 * Filters: coach (expert_signed_by), couple, date range, topic tag.
 * Top stats: this week / this month counts + per-coach top-5.
 *
 * Server-only — uses the service-role admin client to bypass RLS.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase-admin";

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

export type AdminMessageSurface = "per_item" | "channel" | "couple";
export type AdminMessageSentiment =
  | "positive"
  | "neutral"
  | "concerning"
  | "urgent"
  | null;

export interface AdminExpertMessageRow {
  id:                 string;
  surface:            AdminMessageSurface;
  body:               string;
  topic_tags:         string[];
  /** Phase 4 — LLM-predicted topic tags. Distinct from topic_tags. */
  auto_tags:          string[];
  /** Phase 4 — LLM-predicted sentiment. NULL when not yet classified
   *  or when classification failed. */
  sentiment:          AdminMessageSentiment;
  created_at:         string;
  /** Couple this message belongs to (resolved from scheduled_item_id
   *  → assignment.couple_id, or directly on couple_channel rows).
   *  May be null for general-channel messages where the user is solo. */
  couple_id:          string | null;
  /** When the surface is the per-user general channel, the channel owner. */
  channel_user_id:    string | null;
  /** The coach who wrote it (expert_signed_by). Null for legacy rows. */
  expert_id:          string | null;
  /** Coach display name HE — empty string if persona not set. */
  expert_name_he:     string;
  /** Resolved couple label — partner names joined, or "(solo)" when
   *  no couple, or "(unknown couple)" when the lookup misses. */
  couple_label:       string;
  /** href into the relevant client/couple workspace for drill-in. */
  drill_href:         string;
}

export interface AdminMessageFilters {
  expertId?:    string | null;
  coupleId?:    string | null;
  /** ISO date strings — inclusive both ends. */
  fromDate?:    string | null;
  toDate?:      string | null;
  /** Single tag match (rows tagged with this value). Use null for
   *  "untagged" filter (rows with empty array). */
  tag?:         string | null;
  /** "untagged" sentinel — rows with empty topic_tags. */
  untaggedOnly?: boolean;
  /** Phase 4 — sentiment filter. Null = any. */
  sentiment?:   "positive" | "neutral" | "concerning" | "urgent" | null;
  /** Cap the result. Default 200. */
  limit?:       number;
}

export interface AdminMessageStats {
  totalAllTime:     number;
  totalThisWeek:    number;
  totalThisMonth:   number;
  /** Top 5 coaches by message count this month. */
  topCoachesMonth:  Array<{
    expertId:    string;
    name_he:     string;
    count:       number;
  }>;
  /** Top 10 tags across the entire result set (by frequency). */
  topTags:          Array<{ tag: string; count: number }>;
  /** All distinct coaches who have ever sent a message — for the
   *  filter dropdown. */
  allCoaches:       Array<{ expertId: string; name_he: string }>;
  /** All distinct tags ever stamped — for the filter dropdown. */
  allTags:          string[];
}

// ------------------------------------------------------------
// Query helpers
// ------------------------------------------------------------

interface RawJourneyMessage {
  id:                 string;
  scheduled_item_id:  string | null;
  channel_user_id:    string | null;
  body:               string;
  topic_tags:         string[] | null;
  auto_tags:          string[] | null;
  sentiment:          string | null;
  expert_signed_by:   string | null;
  created_at:         string;
}

interface RawCoupleChannelMessage {
  id:                 string;
  couple_id:          string;
  body:               string;
  topic_tags:         string[] | null;
  auto_tags:          string[] | null;
  sentiment:          string | null;
  expert_signed_by:   string | null;
  author_user_id:     string | null;
  created_at:         string;
}

interface ProfileRow {
  id:                    string;
  coach_display_name_he: string | null;
  full_name:             string | null;
  email:                 string | null;
}

/**
 * Main read — returns a merged, sorted (newest first), filtered list
 * of expert messages from both surfaces.
 *
 * Strategy:
 *   1. Two parallel selects, each filtered server-side by the obvious
 *      predicates (date, expert, tag).
 *   2. Resolve scheduled_item_id → assignment.couple_id in one batch
 *      lookup so per-item rows can be coupled.
 *   3. Resolve all distinct expert_ids → coach name in one batch.
 *   4. Resolve all distinct couple_ids → "Partner A & Partner B" in
 *      one batch.
 *   5. Merge, sort by created_at DESC, slice to limit.
 */
export async function listAdminExpertMessages(
  filters: AdminMessageFilters = {},
): Promise<AdminExpertMessageRow[]> {
  const limit = filters.limit ?? 200;
  const admin = await createAdminClient();

  // --- Build queries --------------------------------------------------

  let jmQuery = admin
    .from("journey_messages")
    .select(
      "id, scheduled_item_id, channel_user_id, body, topic_tags, auto_tags, sentiment, expert_signed_by, created_at",
    )
    .eq("author_kind", "expert")
    .order("created_at", { ascending: false })
    .limit(limit);

  let ccQuery = admin
    .from("journey_couple_channel_messages")
    .select(
      "id, couple_id, body, topic_tags, auto_tags, sentiment, expert_signed_by, author_user_id, created_at",
    )
    .eq("author_kind", "expert")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.expertId) {
    jmQuery = jmQuery.eq("expert_signed_by", filters.expertId);
    ccQuery = ccQuery.eq("expert_signed_by", filters.expertId);
  }
  if (filters.fromDate) {
    jmQuery = jmQuery.gte("created_at", filters.fromDate);
    ccQuery = ccQuery.gte("created_at", filters.fromDate);
  }
  if (filters.toDate) {
    jmQuery = jmQuery.lte("created_at", filters.toDate);
    ccQuery = ccQuery.lte("created_at", filters.toDate);
  }
  if (filters.tag && !filters.untaggedOnly) {
    jmQuery = jmQuery.contains("topic_tags", [filters.tag]);
    ccQuery = ccQuery.contains("topic_tags", [filters.tag]);
  }
  if (filters.sentiment) {
    jmQuery = jmQuery.eq("sentiment", filters.sentiment);
    ccQuery = ccQuery.eq("sentiment", filters.sentiment);
  }

  const [{ data: jmRaw, error: jmErr }, { data: ccRaw, error: ccErr }] =
    await Promise.all([jmQuery, ccQuery]);

  if (jmErr) console.error("[admin-messages.listAdminExpertMessages] jm", jmErr);
  if (ccErr) console.error("[admin-messages.listAdminExpertMessages] cc", ccErr);

  const jmRows = (jmRaw ?? []) as RawJourneyMessage[];
  const ccRows = (ccRaw ?? []) as RawCoupleChannelMessage[];

  // --- Couple-id resolution for per-item rows -------------------------
  // For per-item: scheduled_item_id → assignment.id → assignment.couple_id
  const scheduledIds = Array.from(
    new Set(
      jmRows
        .map((r) => r.scheduled_item_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const scheduledToCouple = new Map<string, string | null>();
  if (scheduledIds.length > 0) {
    const { data: schedRows } = await admin
      .from("journey_scheduled_items")
      .select("id, assignment_id")
      .in("id", scheduledIds);
    const assignmentIds = Array.from(
      new Set(
        ((schedRows ?? []) as Array<{ id: string; assignment_id: string }>).map(
          (r) => r.assignment_id,
        ),
      ),
    );
    let assignToCouple = new Map<string, string | null>();
    if (assignmentIds.length > 0) {
      const { data: assignRows } = await admin
        .from("journey_assignments")
        .select("id, couple_id")
        .in("id", assignmentIds);
      assignToCouple = new Map(
        ((assignRows ?? []) as Array<{ id: string; couple_id: string | null }>).map(
          (r) => [r.id, r.couple_id ?? null],
        ),
      );
    }
    for (const r of (schedRows ?? []) as Array<{
      id: string;
      assignment_id: string;
    }>) {
      scheduledToCouple.set(r.id, assignToCouple.get(r.assignment_id) ?? null);
    }
  }

  // For channel messages on journey_messages we don't always have a
  // couple — the channel owner may be solo. We resolve via couple_members
  // lookup when present.
  const channelUserIds = Array.from(
    new Set(
      jmRows
        .map((r) => r.channel_user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const channelUserToCouple = new Map<string, string | null>();
  if (channelUserIds.length > 0) {
    const { data: memRows } = await admin
      .from("couple_members")
      .select("user_id, couple_id")
      .in("user_id", channelUserIds);
    for (const m of (memRows ?? []) as Array<{
      user_id: string;
      couple_id: string;
    }>) {
      // First match wins — couples are typically 1:1 here.
      if (!channelUserToCouple.has(m.user_id)) {
        channelUserToCouple.set(m.user_id, m.couple_id);
      }
    }
  }

  // --- Couple labels --------------------------------------------------
  const allCoupleIds = Array.from(
    new Set(
      [
        ...Array.from(scheduledToCouple.values()),
        ...Array.from(channelUserToCouple.values()),
        ...ccRows.map((r) => r.couple_id),
      ].filter((id): id is string => Boolean(id)),
    ),
  );
  const coupleLabels = new Map<string, string>();
  if (allCoupleIds.length > 0) {
    const { data: members } = await admin
      .from("couple_members")
      .select("couple_id, user_id")
      .in("couple_id", allCoupleIds);
    const userIdsForCouples = Array.from(
      new Set(
        ((members ?? []) as Array<{ couple_id: string; user_id: string }>).map(
          (m) => m.user_id,
        ),
      ),
    );
    const nameById = new Map<string, string>();
    if (userIdsForCouples.length > 0) {
      const { data: profs } = await admin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIdsForCouples);
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

  // --- Coach (expert) names -------------------------------------------
  const allExpertIds = Array.from(
    new Set(
      [
        ...jmRows.map((r) => r.expert_signed_by),
        ...ccRows.map((r) => r.expert_signed_by),
      ].filter((id): id is string => Boolean(id)),
    ),
  );
  const expertNames = new Map<string, string>();
  if (allExpertIds.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, coach_display_name_he, full_name, email")
      .in("id", allExpertIds);
    for (const p of (profs ?? []) as ProfileRow[]) {
      expertNames.set(
        p.id,
        p.coach_display_name_he?.trim() ||
          p.full_name?.trim() ||
          p.email ||
          p.id.slice(0, 6),
      );
    }
  }

  // --- Merge into the unified shape -----------------------------------
  const merged: AdminExpertMessageRow[] = [];

  for (const r of jmRows) {
    const coupleId =
      (r.scheduled_item_id && scheduledToCouple.get(r.scheduled_item_id)) ||
      (r.channel_user_id && channelUserToCouple.get(r.channel_user_id)) ||
      null;
    const expertName = r.expert_signed_by
      ? expertNames.get(r.expert_signed_by) ?? "(לא משויך)"
      : "(לא משויך)";
    const coupleLabel = coupleId
      ? coupleLabels.get(coupleId) ?? "(זוג לא מזוהה)"
      : r.channel_user_id
        ? "(ערוץ אישי)"
        : "(לא משויך)";

    merged.push({
      id:              r.id,
      surface:         r.scheduled_item_id ? "per_item" : "channel",
      body:            r.body,
      topic_tags:      Array.isArray(r.topic_tags) ? r.topic_tags : [],
      auto_tags:       Array.isArray(r.auto_tags) ? r.auto_tags : [],
      sentiment:       (r.sentiment as AdminMessageSentiment) ?? null,
      created_at:      r.created_at,
      couple_id:       coupleId,
      channel_user_id: r.channel_user_id,
      expert_id:       r.expert_signed_by,
      expert_name_he:  expertName,
      couple_label:    coupleLabel,
      drill_href:      coupleId
        ? `/dashboard/my-clients/${coupleId}`
        : r.channel_user_id
          ? `/dashboard/my-clients/${r.channel_user_id}`
          : "/dashboard/my-clients",
    });
  }

  for (const r of ccRows) {
    const expertName = r.expert_signed_by
      ? expertNames.get(r.expert_signed_by) ?? "(לא משויך)"
      : "(לא משויך)";
    const coupleLabel = coupleLabels.get(r.couple_id) ?? "(זוג לא מזוהה)";

    merged.push({
      id:              r.id,
      surface:         "couple",
      body:            r.body,
      topic_tags:      Array.isArray(r.topic_tags) ? r.topic_tags : [],
      auto_tags:       Array.isArray(r.auto_tags) ? r.auto_tags : [],
      sentiment:       (r.sentiment as AdminMessageSentiment) ?? null,
      created_at:      r.created_at,
      couple_id:       r.couple_id,
      channel_user_id: null,
      expert_id:       r.expert_signed_by,
      expert_name_he:  expertName,
      couple_label:    coupleLabel,
      drill_href:      `/dashboard/my-clients/${r.couple_id}`,
    });
  }

  // Apply post-merge filters that can't be pushed to PostgREST:
  // couple filter (because per-item rows resolve couple after the
  // initial query), and untagged-only sentinel.
  let out = merged;
  if (filters.coupleId) {
    out = out.filter((m) => m.couple_id === filters.coupleId);
  }
  if (filters.untaggedOnly) {
    out = out.filter((m) => m.topic_tags.length === 0);
  }

  out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return out.slice(0, limit);
}

/**
 * Aggregate stats for the dashboard header. Counts every expert
 * message ever sent (no filter), then this-week and this-month
 * subtotals, plus a per-coach top-5 over the last 30 days.
 *
 * Also returns the distinct coach + tag dropdown data so the page
 * doesn't need a second round-trip.
 */
export async function getAdminExpertMessageStats(): Promise<AdminMessageStats> {
  const admin = await createAdminClient();

  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

  // Pull a slim slice from both tables — just what we need to aggregate.
  const [jmRes, ccRes] = await Promise.all([
    admin
      .from("journey_messages")
      .select("expert_signed_by, topic_tags, created_at")
      .eq("author_kind", "expert"),
    admin
      .from("journey_couple_channel_messages")
      .select("expert_signed_by, topic_tags, created_at")
      .eq("author_kind", "expert"),
  ]);

  type Slim = {
    expert_signed_by: string | null;
    topic_tags:       string[] | null;
    created_at:       string;
  };

  const all: Slim[] = [
    ...((jmRes.data ?? []) as Slim[]),
    ...((ccRes.data ?? []) as Slim[]),
  ];

  let totalThisWeek = 0;
  let totalThisMonth = 0;
  const monthlyByCoach = new Map<string, number>();
  const tagFreq = new Map<string, number>();
  const allCoachIds = new Set<string>();
  const allTagsSet = new Set<string>();

  for (const r of all) {
    const ts = new Date(r.created_at).getTime();
    if (ts >= oneWeekAgo.getTime()) totalThisWeek++;
    if (ts >= oneMonthAgo.getTime()) {
      totalThisMonth++;
      if (r.expert_signed_by) {
        monthlyByCoach.set(
          r.expert_signed_by,
          (monthlyByCoach.get(r.expert_signed_by) ?? 0) + 1,
        );
      }
    }
    if (r.expert_signed_by) allCoachIds.add(r.expert_signed_by);
    for (const t of r.topic_tags ?? []) {
      tagFreq.set(t, (tagFreq.get(t) ?? 0) + 1);
      allTagsSet.add(t);
    }
  }

  // Resolve coach ids → display names in one batch.
  const coachIdList = Array.from(allCoachIds);
  const coachNameById = new Map<string, string>();
  if (coachIdList.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, coach_display_name_he, full_name, email")
      .in("id", coachIdList);
    for (const p of (profs ?? []) as ProfileRow[]) {
      coachNameById.set(
        p.id,
        p.coach_display_name_he?.trim() ||
          p.full_name?.trim() ||
          p.email ||
          p.id.slice(0, 6),
      );
    }
  }

  const topCoachesMonth = Array.from(monthlyByCoach.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({
      expertId: id,
      name_he:  coachNameById.get(id) ?? id.slice(0, 6),
      count,
    }));

  const topTags = Array.from(tagFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  const allCoaches = coachIdList
    .map((id) => ({
      expertId: id,
      name_he:  coachNameById.get(id) ?? id.slice(0, 6),
    }))
    .sort((a, b) => a.name_he.localeCompare(b.name_he, "he"));

  return {
    totalAllTime:    all.length,
    totalThisWeek,
    totalThisMonth,
    topCoachesMonth,
    topTags,
    allCoaches,
    allTags: Array.from(allTagsSet).sort((a, b) => a.localeCompare(b, "he")),
  };
}
