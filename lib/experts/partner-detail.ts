import "server-only";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import {
  listUserActivity,
  type ActivityEntry,
} from "@/lib/journey/activity";
import {
  isValidOrder,
  type PriorityKey,
} from "@/lib/journey/priorities";

/**
 * Per-partner pack returned by getPartnerDetailsForCouple — used by the
 * expert couple-detail page to render two side-by-side columns. Everything
 * surfaced here is derived from a single user_id; couple-level data lives
 * on the parent ExpertClientDetail.
 */
export type PartnerDetail = {
  userId: string;
  email: string | null;
  fullName: string | null;
  gender: "male" | "female" | "other" | null;
  /** Raw enum from couple_members.role. The audience filter is keyed on this. */
  coupleRole: "owner" | "partner";
  joinedAt: string;
  /** Demographic answers from the assessment (one entry per question_id we
   *  surface; null if the user hasn't answered it yet). */
  demographics: {
    relationship_status: string | null;
    relationship_years: string | null;
    kids_count: string | null;
    kids_age: string | null;
    household_employment: string | null;
    work_field: string | null;
  };
  analysis: {
    friendshipScore: number | null;
    conflictHealth: number | null;
    passionRisk: number | null;
    primaryLoveLanguage: string | null;
    topGap: string | null;
    fourHorsemenFlag: boolean | null;
    summary: string | null;
    computedAt: string | null;
  } | null;
  /** Items currently visible to THIS partner (audience='both' OR matches role). */
  scheduledTotal: number;
  scheduledCompleted: number;
  /** Last 8 activity events for this partner. */
  recentActivity: ActivityEntry[];
  /** Ordered priority list (highest at index 0); null if not yet ranked. */
  priorityRanking: PriorityKey[] | null;
  /** ISO timestamp of the latest q_priorities write — drives "ranked X ago"
   *  in the expert UI. Maintained by the trigger added in migration 045;
   *  null when the partner hasn't ranked yet. */
  priorityRankingUpdatedAt: string | null;
};

const DEMOGRAPHIC_QUESTION_IDS = [
  "q_relationship_status",
  "q_relationship_years",
  "q_kids_count",
  "q_kids_age",
  "q_household_employment",
  "q_work_field",
] as const;

/**
 * Fetch a per-partner detail pack for both members of a couple. Returns an
 * array (not a tuple) so callers can render a single "no members yet"
 * empty state without special-casing length.
 */
export async function getPartnerDetailsForCouple(
  coupleId: string,
): Promise<PartnerDetail[]> {
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("service role unavailable");

  const { data: memberRows } = await admin
    .from("couple_members")
    .select("user_id, role, joined_at")
    .eq("couple_id", coupleId)
    .order("joined_at", { ascending: true });

  const members = (memberRows ?? []) as Array<{
    user_id: string;
    role: "owner" | "partner";
    joined_at: string;
  }>;
  if (members.length === 0) return [];

  const userIds = members.map((m) => m.user_id);

  // Profiles + auth emails + analysis + assignments → one parallel batch.
  const [
    { data: profileRows },
    { data: emailRows },
    { data: journeyRows },
    { data: assignRows },
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, gender")
      .in("id", userIds),
    admin
      .from("admin_users_overview")
      .select("user_id, email")
      .in("user_id", userIds),
    admin
      .from("journeys")
      .select("id, user_id")
      .in("user_id", userIds),
    admin
      .from("journey_assignments")
      .select("id")
      .eq("couple_id", coupleId)
      .eq("is_active", true),
  ]);

  const profileById = new Map(
    ((profileRows ?? []) as Array<{
      id: string;
      full_name: string | null;
      gender: string | null;
    }>).map((p) => [p.id, p]),
  );
  const emailById = new Map(
    ((emailRows ?? []) as Array<{ user_id: string; email: string | null }>).map(
      (u) => [u.user_id, u.email],
    ),
  );

  // ── Per-user analysis (latest row from journey_analysis) ────────────────
  const journeyIdsByUser = new Map<string, string[]>();
  for (const j of (journeyRows ?? []) as Array<{ id: string; user_id: string }>) {
    const arr = journeyIdsByUser.get(j.user_id) ?? [];
    arr.push(j.id);
    journeyIdsByUser.set(j.user_id, arr);
  }
  const allJourneyIds = ((journeyRows ?? []) as Array<{ id: string }>).map(
    (j) => j.id,
  );
  const analysisByUser = new Map<string, PartnerDetail["analysis"]>();
  if (allJourneyIds.length > 0) {
    const { data: aRows } = await admin
      .from("journey_analysis")
      .select(
        "journey_id, user_id, friendship_score, conflict_health, passion_risk, primary_love_language, top_gap, four_horsemen_flag, summary, computed_at",
      )
      .in("journey_id", allJourneyIds)
      .order("computed_at", { ascending: false });
    // Take the most recent row per user_id
    for (const a of (aRows ?? []) as Array<{
      user_id: string | null;
      friendship_score: number | null;
      conflict_health: number | null;
      passion_risk: number | null;
      primary_love_language: string | null;
      top_gap: string | null;
      four_horsemen_flag: boolean | null;
      summary: string | null;
      computed_at: string;
    }>) {
      if (!a.user_id) continue;
      if (analysisByUser.has(a.user_id)) continue;
      analysisByUser.set(a.user_id, {
        friendshipScore: a.friendship_score,
        conflictHealth: a.conflict_health,
        passionRisk: a.passion_risk,
        primaryLoveLanguage: a.primary_love_language,
        topGap: a.top_gap,
        fourHorsemenFlag: a.four_horsemen_flag,
        summary: a.summary,
        computedAt: a.computed_at,
      });
    }
  }

  // ── Demographics + priority ranking — both fetched from journey_responses
  //    in a single query, partitioned by question_id at parse time. ───────
  const demographicsByUser = new Map<
    string,
    PartnerDetail["demographics"]
  >();
  const rankingByUser = new Map<
    string,
    { order: PriorityKey[]; updatedAt: string }
  >();
  for (const uid of userIds) {
    demographicsByUser.set(uid, {
      relationship_status: null,
      relationship_years: null,
      kids_count: null,
      kids_age: null,
      household_employment: null,
      work_field: null,
    });
  }
  if (allJourneyIds.length > 0) {
    const wantedQuestionIds = [
      ...(DEMOGRAPHIC_QUESTION_IDS as readonly string[]),
      "q_priorities",
    ];
    const { data: respRows } = await admin
      .from("journey_responses")
      .select("journey_id, question_id, answer, updated_at, created_at")
      .in("journey_id", allJourneyIds)
      .in("question_id", wantedQuestionIds);
    const journeyToUser = new Map<string, string>();
    for (const j of (journeyRows ?? []) as Array<{
      id: string;
      user_id: string;
    }>) {
      journeyToUser.set(j.id, j.user_id);
    }
    for (const r of (respRows ?? []) as Array<{
      journey_id: string;
      question_id: string;
      answer: { kind?: string; option?: string; order?: unknown };
      updated_at: string | null;
      created_at: string;
    }>) {
      const uid = journeyToUser.get(r.journey_id);
      if (!uid) continue;

      // Priority ranking is single-row per user — partition first.
      if (r.question_id === "q_priorities") {
        if (r.answer?.kind === "ranking" && isValidOrder(r.answer.order)) {
          // updated_at exists post-migration 045; fall back to created_at
          // for any row written before it.
          rankingByUser.set(uid, {
            order: r.answer.order,
            updatedAt: r.updated_at ?? r.created_at,
          });
        }
        continue;
      }

      // Demographic forced_choice answers.
      const slot = demographicsByUser.get(uid);
      if (!slot) continue;
      const opt = r.answer?.kind === "single" ? r.answer.option ?? null : null;
      const key = r.question_id.replace(/^q_/, "") as keyof typeof slot;
      if (key in slot && opt) {
        (slot as Record<string, string | null>)[key] = opt;
      }
    }
  }

  // ── Per-partner audience-aware scheduled-item counts ────────────────────
  const assignmentIds = ((assignRows ?? []) as Array<{ id: string }>).map(
    (a) => a.id,
  );
  const scheduledByRole = new Map<
    "owner" | "partner",
    { total: number; done: number }
  >();
  scheduledByRole.set("owner", { total: 0, done: 0 });
  scheduledByRole.set("partner", { total: 0, done: 0 });
  if (assignmentIds.length > 0) {
    const { data: schedRows } = await admin
      .from("journey_scheduled_items")
      .select("id, audience")
      .in("assignment_id", assignmentIds);
    const allSched = (schedRows ?? []) as Array<{
      id: string;
      audience: "both" | "owner" | "partner";
    }>;
    const schedIds = allSched.map((s) => s.id);
    let completedSet = new Set<string>();
    if (schedIds.length > 0) {
      const { data: doneRows } = await admin
        .from("journey_item_completions")
        .select("scheduled_item_id")
        .in("scheduled_item_id", schedIds);
      completedSet = new Set(
        ((doneRows ?? []) as Array<{ scheduled_item_id: string }>).map(
          (r) => r.scheduled_item_id,
        ),
      );
    }
    // For each scheduled item, tally toward each role that can see it.
    for (const role of ["owner", "partner"] as const) {
      const slot = scheduledByRole.get(role)!;
      for (const s of allSched) {
        if (s.audience === "both" || s.audience === role) {
          slot.total += 1;
          if (completedSet.has(s.id)) slot.done += 1;
        }
      }
    }
  }

  // ── Last 8 activity events per user ─────────────────────────────────────
  const activityByUser = new Map<string, ActivityEntry[]>();
  await Promise.all(
    userIds.map(async (uid) => {
      const events = await listUserActivity(uid, 8).catch(() => []);
      activityByUser.set(uid, events);
    }),
  );

  // ── Stitch ──────────────────────────────────────────────────────────────
  return members.map<PartnerDetail>((m) => {
    const profile = profileById.get(m.user_id);
    const sched = scheduledByRole.get(m.role) ?? { total: 0, done: 0 };
    const ranking = rankingByUser.get(m.user_id) ?? null;
    return {
      userId: m.user_id,
      email: emailById.get(m.user_id) ?? null,
      fullName: profile?.full_name ?? null,
      gender:
        (profile?.gender as PartnerDetail["gender"]) ?? null,
      coupleRole: m.role,
      joinedAt: m.joined_at,
      demographics: demographicsByUser.get(m.user_id) ?? {
        relationship_status: null,
        relationship_years: null,
        kids_count: null,
        kids_age: null,
        household_employment: null,
        work_field: null,
      },
      analysis: analysisByUser.get(m.user_id) ?? null,
      scheduledTotal: sched.total,
      scheduledCompleted: sched.done,
      recentActivity: activityByUser.get(m.user_id) ?? [],
      priorityRanking: ranking?.order ?? null,
      priorityRankingUpdatedAt: ranking?.updatedAt ?? null,
    };
  });
}

// ── Display helpers ────────────────────────────────────────────────────────

export const HE_LABELS: Record<string, Record<string, string>> = {
  relationship_status: {
    married: "נשואים",
    partnership: "ידועים בציבור",
    dating: "בזוגיות",
    engaged: "מאורסים",
  },
  relationship_years: {
    lt1: "פחות משנה",
    "1to3": "1-3 שנים",
    "4to7": "4-7 שנים",
    "8to15": "8-15 שנים",
    gt15: "15+ שנים",
  },
  kids_count: {
    "0": "ללא",
    "1": "ילד אחד",
    "2": "שני ילדים",
    "3": "שלושה",
    "4plus": "4+",
  },
  kids_age: {
    no_kids: "ללא",
    "0to2": "0-2",
    "3to5": "3-5",
    "6to12": "6-12",
    "13to17": "13-17",
    "18plus": "18+",
  },
  household_employment: {
    both_full: "שניהם מלאה",
    one_full_one_part: "מלאה + חלקית",
    one_works: "רק אחד עובד",
    both_flex: "שניהם פרילנס",
    both_home: "שניהם בבית",
  },
  work_field: {
    tech: "הייטק",
    health: "בריאות",
    education: "חינוך",
    business: "עסקים",
    arts: "אומנות",
    trades: "מקצועות עצמאיים",
    public: "ציבורי / צבא",
    other: "אחר",
  },
  gender: { male: "גבר", female: "אישה", other: "אחר" },
  coupleRole: { owner: "פותח/ת הזוגיות", partner: "בן/בת זוג" },
};
