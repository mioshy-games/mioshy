/**
 * lib/journey/feedback.ts — SERVER-ONLY.
 *
 * Read queries + admin-auth gate for the journey_feedback table.
 *
 * IMPORTANT: This file imports `next/headers` (via the server Supabase
 * client) and the service-role admin client. Both are server-only
 * dependencies. Importing this file from a client component WILL break
 * the Next.js build with a "You're importing a component that needs
 * next/headers" error.
 *
 * If a client component needs feedback types or severity labels, import
 * them from `./feedback-shared` instead — that file is dependency-free
 * and safe to ship to the browser.
 *
 * Two firm rules to keep in mind when working in this file:
 *
 *   1. journey_feedback is ADMIN-AUTHORED. Anything in here that
 *      reads or writes the table must be guarded by admin auth.
 *      RLS is the last line of defence — server-action code is the
 *      first.
 *
 *   2. journey_feedback ≠ journey_item_responses. The latter is
 *      user-authored reflections; never wrap a user response in
 *      a Feedback shape, even if the field names look similar.
 */

import { createServiceRoleClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Re-export everything client-safe so existing imports of this module
// keep working without an extra import line. New code SHOULD import
// types directly from "./feedback-shared" — but breaking back-compat
// across the whole codebase to enforce that is more churn than payoff.
export type {
  FeedbackSeverity,
  JourneyFeedbackRow,
  JourneyFeedbackHydrated,
  FeedbackFilter,
} from "./feedback-shared";
export {
  FEEDBACK_SEVERITIES,
  SEVERITY_LABEL_HE,
  SEVERITY_LABEL_EN,
  SEVERITY_TONE,
} from "./feedback-shared";

import type {
  FeedbackFilter,
  FeedbackSeverity,
  JourneyFeedbackHydrated,
} from "./feedback-shared";

// ─── Auth guard (server-only) ────────────────────────────────────────────────

/**
 * Throws if the calling context is not an authenticated admin.
 * RLS on journey_feedback is admin-only, but we still gate at the
 * server-action / query layer so we can return clean errors instead
 * of opaque "row not found" silences.
 */
export async function assertAdminCaller(): Promise<{ adminId: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    throw new Error("not_admin");
  }

  return { adminId: user.id };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Lists feedback rows matching the filter, with optional joins for
 * the human-readable labels admin UIs always want. Admin-gated.
 *
 * Returns rows ordered by created_at DESC (newest first).
 */
export async function listFeedback(
  filter: FeedbackFilter = {},
): Promise<{ rows: JourneyFeedbackHydrated[]; total: number }> {
  await assertAdminCaller();

  const admin = createServiceRoleClient();
  if (!admin) throw new Error("service_role_unavailable");

  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filter.pageSize ?? 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = admin
    .from("journey_feedback")
    .select(
      // Note: journey_categories uses name_he/name_en (different from
      // journey_items which uses title_he/title_en — schema asymmetry
      // we live with, see migration 035).
      `id, user_id, couple_id, category_id, item_id, question_id,
       short_summary, extended_text, severity, admin_author_id,
       created_at, updated_at,
       journey_categories ( name_he, name_en ),
       journey_items ( title_he, title_en )`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filter.coupleId) q = q.eq("couple_id", filter.coupleId);
  if (filter.userId) q = q.eq("user_id", filter.userId);
  if (filter.categoryId) q = q.eq("category_id", filter.categoryId);
  if (filter.itemId) q = q.eq("item_id", filter.itemId);
  if (filter.questionId) q = q.eq("question_id", filter.questionId);
  if (filter.severity) q = q.eq("severity", filter.severity);
  if (filter.q && filter.q.trim().length > 0) {
    const term = filter.q.trim().replace(/%/g, "");
    q = q.or(
      `short_summary.ilike.%${term}%,extended_text.ilike.%${term}%`,
    );
  }

  const { data, error, count } = await q;
  if (error) throw error;

  // Resolve author + subject names in a separate query.
  const authorIds = Array.from(
    new Set(
      (data ?? [])
        .map((r) => r.admin_author_id)
        .filter((v): v is string => !!v),
    ),
  );
  const subjectUserIds = Array.from(
    new Set(
      (data ?? []).map((r) => r.user_id).filter((v): v is string => !!v),
    ),
  );

  const profileLookup = new Map<
    string,
    { email: string | null; full_name: string | null }
  >();
  const allIds = Array.from(new Set([...authorIds, ...subjectUserIds]));
  if (allIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email, full_name")
      .in("id", allIds);
    for (const p of profiles ?? []) {
      profileLookup.set(p.id, { email: p.email, full_name: p.full_name });
    }
  }

  const rows: JourneyFeedbackHydrated[] = (data ?? []).map((r) => {
    const cat = Array.isArray(r.journey_categories)
      ? r.journey_categories[0]
      : r.journey_categories;
    const item = Array.isArray(r.journey_items)
      ? r.journey_items[0]
      : r.journey_items;

    const author = r.admin_author_id
      ? profileLookup.get(r.admin_author_id)
      : null;
    const subject = r.user_id ? profileLookup.get(r.user_id) : null;

    return {
      id: r.id,
      user_id: r.user_id,
      couple_id: r.couple_id,
      category_id: r.category_id,
      item_id: r.item_id,
      question_id: r.question_id,
      short_summary: r.short_summary,
      extended_text: r.extended_text,
      severity: r.severity as FeedbackSeverity,
      admin_author_id: r.admin_author_id,
      created_at: r.created_at,
      updated_at: r.updated_at,
      category_label: cat?.name_he ?? cat?.name_en ?? null,
      item_label: item?.title_he ?? item?.title_en ?? null,
      author_email: author?.email ?? null,
      subject_user_email: subject?.email ?? null,
      subject_user_display: subject?.full_name ?? subject?.email ?? null,
    };
  });

  return { rows, total: count ?? rows.length };
}

/** Convenience wrapper — admin gate is in listFeedback. */
export async function listFeedbackForCouple(coupleId: string) {
  return listFeedback({ coupleId, pageSize: 200 });
}

/** Per-question annotation lookup for the assessment overlay. */
export async function listFeedbackForQuestion(
  userId: string,
  questionId: string,
) {
  return listFeedback({ userId, questionId, pageSize: 50 });
}

/** Counts feedback grouped by category for a single couple. */
export async function countFeedbackByCategory(
  coupleId: string,
): Promise<Array<{ category_id: string | null; count: number }>> {
  await assertAdminCaller();
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("service_role_unavailable");

  const { data, error } = await admin
    .from("journey_feedback")
    .select("category_id")
    .eq("couple_id", coupleId);
  if (error) throw error;

  const counts = new Map<string | null, number>();
  for (const r of data ?? []) {
    counts.set(r.category_id, (counts.get(r.category_id) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([category_id, count]) => ({
    category_id,
    count,
  }));
}
