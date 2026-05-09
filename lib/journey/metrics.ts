/**
 * lib/journey/metrics.ts
 *
 * Phase 3 — cross-system admin metrics. Powers
 * /dashboard/journey/metrics, the single screen where the admin sees
 * platform health in one view.
 *
 * Each metric is a discrete async function so the page can fan them
 * out with Promise.all. Data is intentionally light-weight — these
 * are admin-only KPIs, not user-facing analytics — so we err toward
 * simple SELECTs over aggregates.
 *
 * All counts are computed against the canonical journey_* tables.
 * Service-role admin client (RLS-bypassing).
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase-admin";

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

export interface JourneyKPIs {
  /** Active Journey assignments (couples + solo users with is_active=true). */
  activeAssignments:    number;
  /** Distinct active owners — couples + solo users with at least one
   *  active assignment. The "headcount" of the platform. */
  activeOwners:         number;
  /** Couples flagged 'silent' or 'drifting' in journey_drift_alerts. */
  driftingCouples:      number;
  /** Couples with state='active'. */
  activeCouples:        number;
  /** Items completed in the last 7 days (any owner). */
  completionsLast7d:    number;
  /** Items completed in the last 30 days. */
  completionsLast30d:   number;
  /** Distinct unlocked-and-not-completed scheduled rows over 30d. */
  unlockedItemsLast30d: number;
  /** Completion rate %  — completionsLast30d / unlockedItemsLast30d. */
  completionRate30d:    number;
  /** Average expert reply time in hours (per-item replies, last 30d). */
  avgReplyHours30d:     number | null;
  /** Total expert messages this week. */
  expertMessages7d:     number;
}

export interface CoachLoadRow {
  expertId:     string;
  name_he:      string;
  /** Active couples assigned via expert_couples. */
  activeCouples: number;
  /** Messages sent this month (per-item + channel + couple). */
  messages30d:  number;
  /** Open per-item threads where the latest message is from the user
   *  and the coach hasn't replied yet — the SLA queue. */
  openThreads:  number;
}

export interface CategoryHeatRow {
  /** assessment_priority_key ('communication' / 'intimacy' / etc.). */
  key:          string;
  name_he:      string;
  completions7d: number;
  completions30d: number;
  /** % change week-over-week. NaN when prev was 0. */
  woWPct:        number;
}

export interface StageFunnelRow {
  stage:           number;
  /** Items in the catalog at this stage. */
  itemsInCatalog:  number;
  /** Distinct owners who completed at least one item at this stage. */
  ownersReached:   number;
}

export interface AlertRow {
  kind:    "drift" | "coach_backlog" | "stale_item" | "negative_feedback";
  label:   string;
  detail:  string;
  href:    string | null;
}

export interface UrgentMessageRow {
  id:           string;
  surface:      "per_item" | "channel" | "couple";
  body_preview: string;
  sentiment:    "concerning" | "urgent";
  auto_tags:    string[];
  created_at:   string;
  /** Drill-in to the relevant client/couple workspace. */
  drill_href:   string;
  couple_label: string;
}

// ------------------------------------------------------------
// Top-level KPIs
// ------------------------------------------------------------

export async function getJourneyKPIs(): Promise<JourneyKPIs> {
  const admin = await createAdminClient();
  const now = Date.now();
  const sevenDaysAgo  = new Date(now - 7  * 86400_000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 86400_000).toISOString();

  // Active assignments (lightweight — single column, RLS-free admin).
  const { data: assignmentRows } = await admin
    .from("journey_assignments")
    .select("id, user_id, couple_id, is_active");

  const activeRows = ((assignmentRows ?? []) as Array<{
    id: string;
    user_id: string | null;
    couple_id: string | null;
    is_active: boolean;
  }>).filter((a) => a.is_active);

  const activeAssignments = activeRows.length;
  const activeOwners = new Set(
    activeRows.map((a) => a.couple_id ? `c:${a.couple_id}` : `u:${a.user_id}`),
  ).size;

  // Drift state distribution.
  const { data: driftRows } = await admin
    .from("journey_drift_alerts")
    .select("state, couple_id");
  let activeCouples   = 0;
  let driftingCouples = 0;
  for (const r of (driftRows ?? []) as Array<{ state: string }>) {
    if (r.state === "active")            activeCouples++;
    else if (r.state === "drifting" || r.state === "silent") driftingCouples++;
  }

  // Completions windows.
  const { data: comps7d } = await admin
    .from("journey_item_completions")
    .select("scheduled_item_id")
    .gte("completed_at", sevenDaysAgo);
  const completionsLast7d = (comps7d ?? []).length;

  const { data: comps30d } = await admin
    .from("journey_item_completions")
    .select("scheduled_item_id")
    .gte("completed_at", thirtyDaysAgo);
  const completionsLast30d = (comps30d ?? []).length;

  // Unlocked items in the last 30d (denominator for completion rate).
  const { data: unlocked30d } = await admin
    .from("journey_scheduled_items")
    .select("id")
    .gte("unlock_at", thirtyDaysAgo)
    .lte("unlock_at", new Date(now).toISOString());
  const unlockedItemsLast30d = (unlocked30d ?? []).length;

  const completionRate30d = unlockedItemsLast30d > 0
    ? Math.round((completionsLast30d / unlockedItemsLast30d) * 1000) / 10
    : 0;

  // Average reply time — find user posts with an expert reply in the
  // last 30 days, compute the mean delta. Two queries kept simple.
  const { data: userPosts } = await admin
    .from("journey_messages")
    .select("scheduled_item_id, created_at, author_kind")
    .eq("author_kind", "user")
    .not("scheduled_item_id", "is", null)
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: true });
  const { data: expertReplies } = await admin
    .from("journey_messages")
    .select("scheduled_item_id, created_at, author_kind")
    .eq("author_kind", "expert")
    .not("scheduled_item_id", "is", null)
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: true });

  // For each user post, find the next expert reply on the same
  // scheduled_item. Compute the time delta. Average the deltas.
  const expertByItem = new Map<string, string[]>();
  for (const r of (expertReplies ?? []) as Array<{
    scheduled_item_id: string;
    created_at: string;
  }>) {
    const list = expertByItem.get(r.scheduled_item_id) ?? [];
    list.push(r.created_at);
    expertByItem.set(r.scheduled_item_id, list);
  }
  const deltas: number[] = [];
  for (const u of (userPosts ?? []) as Array<{
    scheduled_item_id: string;
    created_at: string;
  }>) {
    const replies = expertByItem.get(u.scheduled_item_id) ?? [];
    const userT = new Date(u.created_at).getTime();
    const next = replies.find((r) => new Date(r).getTime() > userT);
    if (next) {
      const delta = (new Date(next).getTime() - userT) / 3600_000;
      // Cap at 7 days — anything past that is a stale signal, not SLA.
      if (delta < 168) deltas.push(delta);
    }
  }
  const avgReplyHours30d = deltas.length > 0
    ? Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10
    : null;

  // Expert messages this week (channel + per-item + couple).
  const { count: jmCount } = await admin
    .from("journey_messages")
    .select("id", { head: true, count: "exact" })
    .eq("author_kind", "expert")
    .gte("created_at", sevenDaysAgo);
  const { count: ccCount } = await admin
    .from("journey_couple_channel_messages")
    .select("id", { head: true, count: "exact" })
    .eq("author_kind", "expert")
    .gte("created_at", sevenDaysAgo);
  const expertMessages7d = (jmCount ?? 0) + (ccCount ?? 0);

  return {
    activeAssignments,
    activeOwners,
    driftingCouples,
    activeCouples,
    completionsLast7d,
    completionsLast30d,
    unlockedItemsLast30d,
    completionRate30d,
    avgReplyHours30d,
    expertMessages7d,
  };
}

// ------------------------------------------------------------
// Coach load — top 5 coaches by active couples + 30d message volume
// ------------------------------------------------------------

export async function getCoachLoad(): Promise<CoachLoadRow[]> {
  const admin = await createAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();

  // Active expert↔couple links.
  const { data: links } = await admin
    .from("expert_couples")
    .select("expert_id, couple_id, is_active")
    .eq("is_active", true);

  const couplesByExpert = new Map<string, Set<string>>();
  for (const l of (links ?? []) as Array<{
    expert_id: string;
    couple_id: string;
  }>) {
    const set = couplesByExpert.get(l.expert_id) ?? new Set();
    set.add(l.couple_id);
    couplesByExpert.set(l.expert_id, set);
  }

  // Messages 30d per expert.
  const [{ data: jm }, { data: cc }] = await Promise.all([
    admin
      .from("journey_messages")
      .select("expert_signed_by")
      .eq("author_kind", "expert")
      .gte("created_at", thirtyDaysAgo),
    admin
      .from("journey_couple_channel_messages")
      .select("expert_signed_by")
      .eq("author_kind", "expert")
      .gte("created_at", thirtyDaysAgo),
  ]);
  const messagesByExpert = new Map<string, number>();
  for (const r of (jm ?? []) as Array<{ expert_signed_by: string | null }>) {
    if (!r.expert_signed_by) continue;
    messagesByExpert.set(r.expert_signed_by, (messagesByExpert.get(r.expert_signed_by) ?? 0) + 1);
  }
  for (const r of (cc ?? []) as Array<{ expert_signed_by: string | null }>) {
    if (!r.expert_signed_by) continue;
    messagesByExpert.set(r.expert_signed_by, (messagesByExpert.get(r.expert_signed_by) ?? 0) + 1);
  }

  // Open threads per expert — per-item rows whose latest message is
  // from a user (not the coach yet). Approximation: for each
  // scheduled_item_id with at least one user message in the last 30d,
  // check if there's a NEWER expert message. If not, count as open.
  // We attribute the open thread to the expert linked to that couple.
  const { data: schedAssignments } = await admin
    .from("journey_scheduled_items")
    .select("id, assignment_id");
  const schedToAssignment = new Map<string, string>(
    ((schedAssignments ?? []) as Array<{ id: string; assignment_id: string }>).map(
      (r) => [r.id, r.assignment_id],
    ),
  );
  const { data: assignToCouple } = await admin
    .from("journey_assignments")
    .select("id, couple_id");
  const assignmentToCouple = new Map<string, string | null>(
    ((assignToCouple ?? []) as Array<{ id: string; couple_id: string | null }>).map(
      (r) => [r.id, r.couple_id],
    ),
  );
  const expertByCouple = new Map<string, string>();
  for (const l of (links ?? []) as Array<{
    expert_id: string;
    couple_id: string;
  }>) {
    if (!expertByCouple.has(l.couple_id)) {
      expertByCouple.set(l.couple_id, l.expert_id);
    }
  }

  const { data: latestUserMsgs } = await admin
    .from("journey_messages")
    .select("scheduled_item_id, author_kind, created_at")
    .not("scheduled_item_id", "is", null)
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false });

  // For each scheduled_item_id seen, collapse to the latest message.
  const latestByItem = new Map<string, string>();
  for (const m of (latestUserMsgs ?? []) as Array<{
    scheduled_item_id: string;
    author_kind: string;
    created_at: string;
  }>) {
    if (!latestByItem.has(m.scheduled_item_id)) {
      latestByItem.set(m.scheduled_item_id, m.author_kind);
    }
  }
  const openThreadsByExpert = new Map<string, number>();
  for (const [schedId, latestAuthor] of latestByItem) {
    if (latestAuthor !== "user") continue;
    const assignmentId = schedToAssignment.get(schedId);
    if (!assignmentId) continue;
    const coupleId = assignmentToCouple.get(assignmentId);
    if (!coupleId) continue;
    const expertId = expertByCouple.get(coupleId);
    if (!expertId) continue;
    openThreadsByExpert.set(expertId, (openThreadsByExpert.get(expertId) ?? 0) + 1);
  }

  // Pull names.
  const allExpertIds = Array.from(new Set([
    ...couplesByExpert.keys(),
    ...messagesByExpert.keys(),
    ...openThreadsByExpert.keys(),
  ]));
  const nameByExpert = new Map<string, string>();
  if (allExpertIds.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, coach_display_name_he, full_name, email")
      .in("id", allExpertIds);
    for (const p of (profs ?? []) as Array<{
      id: string;
      coach_display_name_he: string | null;
      full_name: string | null;
      email: string | null;
    }>) {
      nameByExpert.set(
        p.id,
        p.coach_display_name_he?.trim() ||
          p.full_name?.trim() ||
          p.email ||
          p.id.slice(0, 6),
      );
    }
  }

  const rows: CoachLoadRow[] = allExpertIds.map((id) => ({
    expertId:      id,
    name_he:       nameByExpert.get(id) ?? id.slice(0, 6),
    activeCouples: couplesByExpert.get(id)?.size ?? 0,
    messages30d:   messagesByExpert.get(id) ?? 0,
    openThreads:   openThreadsByExpert.get(id) ?? 0,
  }));

  rows.sort((a, b) =>
    (b.activeCouples + b.messages30d) - (a.activeCouples + a.messages30d),
  );
  return rows.slice(0, 10);
}

// ------------------------------------------------------------
// Category heat — completions in last 7 days vs prior 7 days
// ------------------------------------------------------------

export async function getCategoryHeat(): Promise<CategoryHeatRow[]> {
  const admin = await createAdminClient();
  const now = Date.now();
  const oneWeekAgo  = new Date(now - 7  * 86400_000).toISOString();
  const twoWeeksAgo = new Date(now - 14 * 86400_000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 86400_000).toISOString();

  const { data: cats } = await admin
    .from("journey_categories")
    .select("id, name_he, assessment_priority_key")
    .not("assessment_priority_key", "is", null);

  // Completions joined to items → category.
  const { data: completions } = await admin
    .from("journey_item_completions")
    .select("scheduled_item_id, completed_at")
    .gte("completed_at", thirtyDaysAgo);
  const schedIds = Array.from(new Set(
    ((completions ?? []) as Array<{ scheduled_item_id: string }>).map(
      (c) => c.scheduled_item_id,
    ),
  ));
  if (schedIds.length === 0 || (cats ?? []).length === 0) {
    return [];
  }
  const { data: scheduledRows } = await admin
    .from("journey_scheduled_items")
    .select("id, item_id")
    .in("id", schedIds);
  const itemBySched = new Map<string, string>(
    ((scheduledRows ?? []) as Array<{ id: string; item_id: string }>).map(
      (r) => [r.id, r.item_id],
    ),
  );
  const itemIds = Array.from(new Set(itemBySched.values()));
  const { data: itemRows } = itemIds.length > 0
    ? await admin
      .from("journey_items")
      .select("id, category_id")
      .in("id", itemIds)
    : { data: [] };
  const catByItem = new Map<string, string>(
    ((itemRows ?? []) as Array<{ id: string; category_id: string }>).map(
      (r) => [r.id, r.category_id],
    ),
  );

  const sevenAgoMs  = new Date(oneWeekAgo).getTime();
  const fourteenAgoMs = new Date(twoWeeksAgo).getTime();

  const counts7d  = new Map<string, number>();
  const counts14d_prev = new Map<string, number>();
  const counts30d = new Map<string, number>();

  for (const c of (completions ?? []) as Array<{
    scheduled_item_id: string;
    completed_at: string;
  }>) {
    const itemId = itemBySched.get(c.scheduled_item_id);
    if (!itemId) continue;
    const catId  = catByItem.get(itemId);
    if (!catId) continue;
    const ts = new Date(c.completed_at).getTime();
    counts30d.set(catId, (counts30d.get(catId) ?? 0) + 1);
    if (ts >= sevenAgoMs) {
      counts7d.set(catId, (counts7d.get(catId) ?? 0) + 1);
    } else if (ts >= fourteenAgoMs) {
      counts14d_prev.set(catId, (counts14d_prev.get(catId) ?? 0) + 1);
    }
  }

  return ((cats ?? []) as Array<{
    id: string;
    name_he: string;
    assessment_priority_key: string | null;
  }>)
    .map((c) => {
      const this7 = counts7d.get(c.id) ?? 0;
      const prev7 = counts14d_prev.get(c.id) ?? 0;
      const woWPct = prev7 > 0
        ? Math.round(((this7 - prev7) / prev7) * 100)
        : (this7 > 0 ? 100 : 0);
      return {
        key:            c.assessment_priority_key ?? "?",
        name_he:        c.name_he,
        completions7d:  this7,
        completions30d: counts30d.get(c.id) ?? 0,
        woWPct,
      };
    })
    .sort((a, b) => b.completions30d - a.completions30d);
}

// ------------------------------------------------------------
// Stage funnel — how many owners have reached each stage
// ------------------------------------------------------------

export async function getStageFunnel(): Promise<StageFunnelRow[]> {
  const admin = await createAdminClient();

  // Item count per stage.
  const { data: itemRows } = await admin
    .from("journey_items")
    .select("id, stage")
    .not("stage", "is", null);
  const itemsByStage = new Map<number, string[]>();
  for (const r of (itemRows ?? []) as Array<{ id: string; stage: number }>) {
    const arr = itemsByStage.get(r.stage) ?? [];
    arr.push(r.id);
    itemsByStage.set(r.stage, arr);
  }

  // Owners reached per stage — via completions joined to scheduled →
  // assignment → owner.
  const { data: comps } = await admin
    .from("journey_item_completions")
    .select("scheduled_item_id, completed_by");
  const schedIds = Array.from(new Set(
    ((comps ?? []) as Array<{ scheduled_item_id: string }>).map(
      (c) => c.scheduled_item_id,
    ),
  ));
  const ownersByStage = new Map<number, Set<string>>();
  if (schedIds.length > 0) {
    const { data: scheduled } = await admin
      .from("journey_scheduled_items")
      .select("id, item_id, assignment_id")
      .in("id", schedIds);
    const itemBySched      = new Map<string, string>();
    const assignmentBySched = new Map<string, string>();
    for (const r of (scheduled ?? []) as Array<{
      id: string;
      item_id: string;
      assignment_id: string;
    }>) {
      itemBySched.set(r.id, r.item_id);
      assignmentBySched.set(r.id, r.assignment_id);
    }
    const allItemIds = Array.from(new Set(itemBySched.values()));
    const stageByItem = new Map<string, number>();
    if (allItemIds.length > 0) {
      const { data: items2 } = await admin
        .from("journey_items")
        .select("id, stage")
        .in("id", allItemIds)
        .not("stage", "is", null);
      for (const r of (items2 ?? []) as Array<{ id: string; stage: number }>) {
        stageByItem.set(r.id, r.stage);
      }
    }
    const allAssignmentIds = Array.from(new Set(assignmentBySched.values()));
    const ownerByAssignment = new Map<string, string>();
    if (allAssignmentIds.length > 0) {
      const { data: as } = await admin
        .from("journey_assignments")
        .select("id, user_id, couple_id")
        .in("id", allAssignmentIds);
      for (const r of (as ?? []) as Array<{
        id: string;
        user_id: string | null;
        couple_id: string | null;
      }>) {
        ownerByAssignment.set(
          r.id,
          r.couple_id ? `c:${r.couple_id}` : `u:${r.user_id ?? r.id}`,
        );
      }
    }
    for (const c of (comps ?? []) as Array<{
      scheduled_item_id: string;
    }>) {
      const itemId = itemBySched.get(c.scheduled_item_id);
      const assignmentId = assignmentBySched.get(c.scheduled_item_id);
      if (!itemId || !assignmentId) continue;
      const stage = stageByItem.get(itemId);
      if (!stage) continue;
      const owner = ownerByAssignment.get(assignmentId);
      if (!owner) continue;
      const set = ownersByStage.get(stage) ?? new Set();
      set.add(owner);
      ownersByStage.set(stage, set);
    }
  }

  return [1, 2, 3, 4].map((stage) => ({
    stage,
    itemsInCatalog: itemsByStage.get(stage)?.length ?? 0,
    ownersReached:  ownersByStage.get(stage)?.size ?? 0,
  }));
}

// ------------------------------------------------------------
// Alerts list — admin attention items
// ------------------------------------------------------------

export async function getAdminAlerts(): Promise<AlertRow[]> {
  const admin = await createAdminClient();
  const alerts: AlertRow[] = [];

  // Drift cohort needing coach check-in (state != active AND coach
  // hasn't checked in yet).
  const { data: drift } = await admin
    .from("journey_drift_alerts")
    .select("couple_id, user_id, state, coach_checked_in_at")
    .neq("state", "active")
    .is("coach_checked_in_at", null)
    .limit(20);
  for (const d of (drift ?? []) as Array<{
    couple_id: string | null;
    user_id: string | null;
    state: string;
  }>) {
    const id = d.couple_id || d.user_id;
    if (!id) continue;
    alerts.push({
      kind:   "drift",
      label:  d.state === "silent" ? "Silent" : "Drifting",
      detail: "Needs coach check-in",
      href:   `/dashboard/my-clients/${id}`,
    });
  }

  // Items with poor feedback (>=3 'made_things_worse' or 'not_for_us').
  const { data: feedback } = await admin
    .from("journey_item_feedback")
    .select("scheduled_item_id, rating");
  const negByItem = new Map<string, number>();
  for (const f of (feedback ?? []) as Array<{
    scheduled_item_id: string;
    rating: string;
  }>) {
    if (f.rating === "made_things_worse" || f.rating === "not_for_us") {
      negByItem.set(f.scheduled_item_id, (negByItem.get(f.scheduled_item_id) ?? 0) + 1);
    }
  }
  for (const [, count] of Array.from(negByItem.entries())
    .filter(([, c]) => c >= 3)
    .slice(0, 5)) {
    alerts.push({
      kind:   "negative_feedback",
      label:  "Item underperforming",
      detail: `${count} negative ratings`,
      href:   "/dashboard/journey/feedback",
    });
  }

  return alerts.slice(0, 25);
}

// ------------------------------------------------------------
// Urgent / concerning user messages — Phase 4
// ------------------------------------------------------------

/**
 * Most recent urgent + concerning user-authored messages across the
 * three surfaces (per-item, channel, couple). The classifier (run as
 * fire-and-forget after every user message) populates `sentiment`;
 * this query reads it back. Messages with NULL sentiment are skipped
 * (never classified or classifier failed).
 *
 * Powers the "needs attention" panel on the metrics dashboard.
 */
export async function getUrgentUserMessages(
  limit = 15,
): Promise<UrgentMessageRow[]> {
  const admin = await createAdminClient();

  // Pull recent rows from both message tables where sentiment is
  // urgent or concerning. We deliberately only show user-authored
  // messages — coach messages aren't classified.
  const [{ data: jm }, { data: cc }] = await Promise.all([
    admin
      .from("journey_messages")
      .select(
        "id, scheduled_item_id, channel_user_id, body, sentiment, auto_tags, created_at",
      )
      .eq("author_kind", "user")
      .in("sentiment", ["urgent", "concerning"])
      .order("created_at", { ascending: false })
      .limit(limit),
    admin
      .from("journey_couple_channel_messages")
      .select(
        "id, couple_id, body, sentiment, auto_tags, created_at",
      )
      .eq("author_kind", "partner")
      .in("sentiment", ["urgent", "concerning"])
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  // Resolve scheduled → couple for per-item / channel rows.
  const jmRows = (jm ?? []) as Array<{
    id: string;
    scheduled_item_id: string | null;
    channel_user_id:   string | null;
    body:              string;
    sentiment:         "urgent" | "concerning";
    auto_tags:         string[] | null;
    created_at:        string;
  }>;
  const ccRows = (cc ?? []) as Array<{
    id:         string;
    couple_id:  string;
    body:       string;
    sentiment:  "urgent" | "concerning";
    auto_tags:  string[] | null;
    created_at: string;
  }>;

  const schedIds = Array.from(new Set(
    jmRows.map((r) => r.scheduled_item_id).filter((id): id is string => Boolean(id)),
  ));
  const schedToCouple = new Map<string, string | null>();
  if (schedIds.length > 0) {
    const { data: sched } = await admin
      .from("journey_scheduled_items")
      .select("id, assignment_id")
      .in("id", schedIds);
    const assignmentIds = Array.from(new Set(
      ((sched ?? []) as Array<{ id: string; assignment_id: string }>).map(
        (r) => r.assignment_id,
      ),
    ));
    let assignToCouple = new Map<string, string | null>();
    if (assignmentIds.length > 0) {
      const { data: as } = await admin
        .from("journey_assignments")
        .select("id, couple_id")
        .in("id", assignmentIds);
      assignToCouple = new Map(
        ((as ?? []) as Array<{ id: string; couple_id: string | null }>).map(
          (r) => [r.id, r.couple_id ?? null],
        ),
      );
    }
    for (const r of (sched ?? []) as Array<{
      id: string;
      assignment_id: string;
    }>) {
      schedToCouple.set(r.id, assignToCouple.get(r.assignment_id) ?? null);
    }
  }

  // Resolve couple labels (partner names).
  const allCoupleIds = Array.from(new Set([
    ...Array.from(schedToCouple.values()).filter((v): v is string => Boolean(v)),
    ...ccRows.map((r) => r.couple_id),
  ]));
  const coupleLabels = new Map<string, string>();
  if (allCoupleIds.length > 0) {
    const { data: members } = await admin
      .from("couple_members")
      .select("couple_id, user_id")
      .in("couple_id", allCoupleIds);
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

  const merged: UrgentMessageRow[] = [];
  const previewBody = (s: string) => {
    const t = s.trim().replace(/\s+/g, " ");
    return t.length > 140 ? `${t.slice(0, 140)}…` : t;
  };
  for (const r of jmRows) {
    const coupleId =
      (r.scheduled_item_id && schedToCouple.get(r.scheduled_item_id)) || null;
    merged.push({
      id:           r.id,
      surface:      r.scheduled_item_id ? "per_item" : "channel",
      body_preview: previewBody(r.body),
      sentiment:    r.sentiment,
      auto_tags:    Array.isArray(r.auto_tags) ? r.auto_tags : [],
      created_at:   r.created_at,
      drill_href:   coupleId
        ? `/dashboard/my-clients/${coupleId}`
        : r.channel_user_id
          ? `/dashboard/my-clients/${r.channel_user_id}`
          : "/dashboard/my-clients",
      couple_label: coupleId ? (coupleLabels.get(coupleId) ?? "(זוג לא מזוהה)") : "(ערוץ אישי)",
    });
  }
  for (const r of ccRows) {
    merged.push({
      id:           r.id,
      surface:      "couple",
      body_preview: previewBody(r.body),
      sentiment:    r.sentiment,
      auto_tags:    Array.isArray(r.auto_tags) ? r.auto_tags : [],
      created_at:   r.created_at,
      drill_href:   `/dashboard/my-clients/${r.couple_id}`,
      couple_label: coupleLabels.get(r.couple_id) ?? "(זוג לא מזוהה)",
    });
  }

  // Urgent first, then concerning. Within each, newest first.
  merged.sort((a, b) => {
    const sentRank = (s: string) => (s === "urgent" ? 0 : 1);
    const sa = sentRank(a.sentiment);
    const sb = sentRank(b.sentiment);
    if (sa !== sb) return sa - sb;
    return b.created_at.localeCompare(a.created_at);
  });

  return merged.slice(0, limit);
}
