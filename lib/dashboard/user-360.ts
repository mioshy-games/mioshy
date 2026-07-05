import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPriorityCategories } from "@/lib/journey-content/priority-categories";

/**
 * lib/dashboard/user-360.ts — the extra "360" data for the admin user card
 * (docs/admin-user-360-spec.md). DISPLAY-ONLY: every field is read from data
 * that already exists (no data-model changes). Call with a service-role client
 * (the route is admin-gated) so partner/couple/cross-user reads bypass RLS.
 *
 * Sections: identity(gender) · partner(couple) · payment(coaching/trial) ·
 * assessment(results + domain order) · engagement(per-chapter) · communication
 * (a single-user expert timeline with pending-reply + wait duration).
 */

const GENDER_HE: Record<string, string> = { male: "גבר", female: "אישה", other: "אחר" };

export interface User360 {
  identity: { fullName: string | null; email: string | null; phone: string | null; genderHe: string | null };
  partner: {
    coupleId: string | null;
    role: "owner" | "partner" | null;
    ownerOnly: boolean; // couple exists with only the owner → "עדיין אין פרטנר"
    partner: { userId: string; name: string | null; email: string | null; didAssessment: boolean } | null;
  };
  payment: {
    hasSub: boolean;
    plan: string | null;
    status: string | null;
    coaching: boolean;
    trialing: boolean;
    trialEndsAt: string | null;
    introAmount: number | null;
    planAmount: number | null;
    currency: string | null;
    viaOwner: boolean; // partner with no direct sub → access via the owner
  };
  assessment: {
    shortDone: boolean;
    fullDone: boolean;
    friendship: number | null;
    conflict: number | null;
    passionRisk: number | null;
    topGap: string | null;
    narrative: string | null;
    domains: Array<{ label: string; score: number }>; // ranked order + weight
  };
  engagement: Array<{
    title: string | null;
    deliveredAt: string | null;
    opened: boolean;
    openedAt: string | null;
    responded: boolean;
    respondedAt: string | null;
  }>;
  communication: {
    timeline: Array<{
      id: string;
      authorKind: "user" | "expert";
      body: string;
      createdAt: string;
      context: string; // chapter title or "צ'אט כללי"
    }>;
    pending: Array<{ context: string; waitHours: number; lastBody: string; lastAt: string }>;
  };
}

type DB = SupabaseClient;

async function loadIdentity(admin: DB, userId: string): Promise<User360["identity"]> {
  const { data } = await admin
    .from("profiles")
    .select("full_name, email, mobile, gender")
    .eq("id", userId)
    .maybeSingle<{ full_name: string | null; email: string | null; mobile: string | null; gender: string | null }>();
  return {
    fullName: data?.full_name ?? null,
    email: data?.email ?? null,
    phone: data?.mobile ?? null,
    genderHe: data?.gender ? (GENDER_HE[data.gender] ?? data.gender) : null,
  };
}

async function didAssessment(admin: DB, userId: string): Promise<boolean> {
  const { data } = await admin
    .from("journeys")
    .select("status")
    .eq("user_id", userId)
    .in("status", ["paywall", "complete", "completed"])
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function loadPartner(admin: DB, userId: string): Promise<User360["partner"]> {
  const { data: mine } = await admin
    .from("couple_members")
    .select("couple_id, role")
    .eq("user_id", userId)
    .maybeSingle<{ couple_id: string; role: "owner" | "partner" }>();
  if (!mine?.couple_id) return { coupleId: null, role: null, ownerOnly: false, partner: null };

  const { data: members } = await admin
    .from("couple_members")
    .select("user_id, role")
    .eq("couple_id", mine.couple_id);
  const others = (members ?? []).filter((m) => m.user_id !== userId) as Array<{ user_id: string; role: "owner" | "partner" }>;

  if (others.length === 0) {
    // Only this user in the couple → no partner registered yet (decision ב).
    return { coupleId: mine.couple_id, role: mine.role, ownerOnly: true, partner: null };
  }

  const other = others[0];
  const { data: prof } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", other.user_id)
    .maybeSingle<{ full_name: string | null; email: string | null }>();
  return {
    coupleId: mine.couple_id,
    role: mine.role,
    ownerOnly: false,
    partner: {
      userId: other.user_id,
      name: prof?.full_name ?? null,
      email: prof?.email ?? null,
      didAssessment: await didAssessment(admin, other.user_id),
    },
  };
}

async function loadPayment(admin: DB, userId: string, partner: User360["partner"]): Promise<User360["payment"]> {
  const pick = async (uid: string) =>
    (
      await admin
        .from("subscriptions")
        .select("plan, status, coaching, trial_ends_at, intro_amount, plan_amount, currency")
        .eq("user_id", uid)
        .in("status", ["active", "trialing", "grace", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ).data as
      | { plan: string | null; status: string | null; coaching: boolean | null; trial_ends_at: string | null; intro_amount: number | null; plan_amount: number | null; currency: string | null }
      | null;

  let sub = await pick(userId);
  let viaOwner = false;
  // A partner with no direct sub inherits the owner's — surface it.
  if (!sub && partner.role === "partner" && partner.partner) {
    // partner.partner is the OTHER member; the owner is that other member when
    // this user is the partner. Try the owner's subscription.
    sub = await pick(partner.partner.userId);
    viaOwner = !!sub;
  }
  return {
    hasSub: !!sub,
    plan: sub?.plan ?? null,
    status: sub?.status ?? null,
    coaching: sub?.coaching === true,
    trialing: sub?.status === "trialing",
    trialEndsAt: sub?.trial_ends_at ?? null,
    introAmount: sub?.intro_amount ?? null,
    planAmount: sub?.plan_amount ?? null,
    currency: sub?.currency ?? null,
    viaOwner,
  };
}

async function loadAssessment(admin: DB, userId: string): Promise<User360["assessment"]> {
  const [{ data: analysis }, { data: prio }, { data: shortJourney }] = await Promise.all([
    admin.from("journey_analysis").select("friendship_score, conflict_health, passion_risk, top_gap, summary, report_phase").eq("user_id", userId).order("computed_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("journey_user_priorities").select("ranking, weights").eq("user_id", userId).maybeSingle<{ ranking: string[]; weights: number[] }>(),
    admin.from("journeys").select("status").eq("user_id", userId).in("status", ["paywall", "complete", "completed"]).limit(1).maybeSingle(),
  ]);

  // Map ranked category ids → labels, paired with their weights (the assessment
  // domain scores). journey_user_priorities.ranking is the personalized order.
  const domains: Array<{ label: string; score: number }> = [];
  if (prio?.ranking?.length) {
    const cats = await getPriorityCategories().catch(() => []);
    const labelById = new Map((cats as Array<{ id: string; name_he: string }>).map((c) => [c.id, c.name_he]));
    prio.ranking.forEach((id, i) => {
      const w = prio.weights?.[i];
      domains.push({ label: labelById.get(id) ?? id, score: typeof w === "number" ? Math.round(w * 100) : 0 });
    });
  }

  const a = analysis as { friendship_score: number | null; conflict_health: number | null; passion_risk: number | null; top_gap: string | null; summary: { narrative_he?: string; narrative_en?: string } | null; report_phase: string | null } | null;
  return {
    shortDone: !!shortJourney,
    fullDone: a?.report_phase === "full",
    friendship: a?.friendship_score ?? null,
    conflict: a?.conflict_health ?? null,
    passionRisk: a?.passion_risk ?? null,
    topGap: a?.top_gap ?? null,
    narrative: a?.summary?.narrative_he ?? a?.summary?.narrative_en ?? null,
    domains,
  };
}

async function loadEngagement(admin: DB, userId: string): Promise<User360["engagement"]> {
  // Per-chapter: delivered + opened (seen_at) + responded (responded_at).
  // Scheduled items link to the user via journey_assignments.user_id (there is
  // no owner_user_id on the item itself) — same nesting the reminders cron uses.
  type Sched = { unlock_at: string | null; seen_at: string | null; responded_at: string | null; journey_items: { title_he: string | null } | { title_he: string | null }[] | null };
  const { data } = await admin
    .from("journey_assignments")
    .select("journey_scheduled_items(unlock_at, seen_at, responded_at, journey_items(title_he))")
    .eq("user_id", userId);

  const rows: Sched[] = [];
  for (const asg of (data ?? []) as Array<{ journey_scheduled_items: Sched | Sched[] | null }>) {
    const items = asg.journey_scheduled_items;
    if (!items) continue;
    for (const s of Array.isArray(items) ? items : [items]) rows.push(s);
  }
  rows.sort((a, b) => (b.unlock_at ?? "").localeCompare(a.unlock_at ?? ""));

  return rows.slice(0, 40).map((r) => {
    const item = Array.isArray(r.journey_items) ? r.journey_items[0] : r.journey_items;
    return {
      title: item?.title_he ?? null,
      deliveredAt: r.unlock_at,
      opened: !!r.seen_at,
      openedAt: r.seen_at,
      responded: !!r.responded_at,
      respondedAt: r.responded_at,
    };
  });
}

async function loadCommunication(admin: DB, userId: string): Promise<User360["communication"]> {
  // 1) General channel — every message (both sides) is keyed by channel_user_id.
  const { data: general } = await admin
    .from("journey_messages")
    .select("id, author_kind, body, created_at, scheduled_item_id")
    .eq("channel_user_id", userId)
    .order("created_at", { ascending: true });

  // 2) Per-item — find the scheduled items where this user wrote, then pull the
  //    FULL threads (so expert replies are included too).
  const { data: mine } = await admin
    .from("journey_messages")
    .select("scheduled_item_id")
    .eq("author_user_id", userId)
    .not("scheduled_item_id", "is", null);
  const itemIds = Array.from(new Set((mine ?? []).map((r) => r.scheduled_item_id as string)));

  let perItem: Array<{ id: string; author_kind: "user" | "expert"; body: string | null; created_at: string; scheduled_item_id: string | null }> = [];
  const titleByItem = new Map<string, string>();
  if (itemIds.length) {
    const { data: threads } = await admin
      .from("journey_messages")
      .select("id, author_kind, body, created_at, scheduled_item_id")
      .in("scheduled_item_id", itemIds)
      .order("created_at", { ascending: true });
    perItem = (threads ?? []) as typeof perItem;
    // Resolve chapter titles for context.
    const { data: sched } = await admin
      .from("journey_scheduled_items")
      .select("id, journey_items(title_he)")
      .in("id", itemIds);
    for (const s of (sched ?? []) as Array<{ id: string; journey_items: { title_he: string | null } | { title_he: string | null }[] | null }>) {
      const item = Array.isArray(s.journey_items) ? s.journey_items[0] : s.journey_items;
      if (item?.title_he) titleByItem.set(s.id, item.title_he);
    }
  }

  const generalRows = (general ?? []) as Array<{ id: string; author_kind: "user" | "expert"; body: string | null; created_at: string; scheduled_item_id: string | null }>;

  const ctxFor = (r: { scheduled_item_id: string | null }): string =>
    r.scheduled_item_id ? (titleByItem.get(r.scheduled_item_id) ?? "פרק") : "צ'אט כללי";

  // Merged, time-ordered timeline.
  const all = [...generalRows.map((r) => ({ ...r, general: true })), ...perItem.map((r) => ({ ...r, general: false }))]
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const timeline = all.map((r) => ({
    id: r.id,
    authorKind: r.author_kind,
    body: r.body ?? "",
    createdAt: r.created_at,
    context: r.general ? "צ'אט כללי" : ctxFor(r),
  }));

  // Pending: per thread, last message from the user → awaiting reply.
  type Slot = { latest: { author_kind: "user" | "expert"; body: string | null; created_at: string }; context: string };
  const slots = new Map<string, Slot>();
  for (const r of generalRows) {
    slots.set("general", { latest: r, context: "צ'אט כללי" }); // ordered asc → last wins
  }
  const perItemByThread = new Map<string, typeof perItem>();
  for (const r of perItem) {
    const k = r.scheduled_item_id ?? "?";
    const arr = perItemByThread.get(k) ?? [];
    arr.push(r);
    perItemByThread.set(k, arr);
  }
  for (const [k, arr] of perItemByThread) {
    const latest = arr[arr.length - 1];
    slots.set(`item:${k}`, { latest, context: titleByItem.get(k) ?? "פרק" });
  }

  const now = Date.now();
  const pending = [...slots.values()]
    .filter((s) => s.latest.author_kind === "user")
    .map((s) => ({
      context: s.context,
      waitHours: Math.max(0, Math.round((now - new Date(s.latest.created_at).getTime()) / 3_600_000)),
      lastBody: s.latest.body ?? "",
      lastAt: s.latest.created_at,
    }))
    .sort((a, b) => b.waitHours - a.waitHours);

  return { timeline, pending };
}

export async function loadUser360(admin: DB, userId: string): Promise<User360> {
  const [identity, partner] = await Promise.all([loadIdentity(admin, userId), loadPartner(admin, userId)]);
  const [payment, assessment, engagement, communication] = await Promise.all([
    loadPayment(admin, userId, partner),
    loadAssessment(admin, userId),
    loadEngagement(admin, userId),
    loadCommunication(admin, userId),
  ]);
  return { identity, partner, payment, assessment, engagement, communication };
}
