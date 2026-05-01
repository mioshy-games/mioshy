"use server";

/**
 * lib/journey-content/clinician-responses.ts
 *
 * Server-side helpers for the clinician/expert view of user responses
 * to journey items. Phase 2C — read-only.
 *
 * Why service-role: partners only have SELECT on their own rows under
 * RLS (migration 035). The clinician dashboard has a legitimate need
 * to read both partners' responses; that authorization is enforced at
 * the page boundary by `requireExpert()` already.
 *
 * What this is NOT yet:
 *   - No reply mutation. Clinicians can SEE responses; the reply
 *     workflow ships in Phase 2D.
 *   - No "concerning" tagging UI. The migration 049 column is in
 *     place; we just don't write to it yet.
 */

import { createServiceRoleClient } from "@/lib/supabase-admin";
import type {
  JourneyAssessmentPayload,
  JourneyItemKind,
} from "@/lib/journey-content/types";

export type ClinicianResponseStatus = "open" | "resolved" | "concerning" | null;

export interface ClinicianResponseRow {
  id: string;
  scheduledItemId: string;
  userId: string;
  userEmail: string | null;
  itemTitle: string;
  categoryName: string | null;
  responseText: string;
  isPrivate: boolean;
  createdAt: string;
  clinicianStatus: ClinicianResponseStatus;
  clinicianReplyText: string | null;
  clinicianRepliedAt: string | null;
  /** Phase 3 step 4. When the underlying journey_item is an
   *  assessment / reflection, the clinician sees the structured
   *  answer paired with the question prompts. */
  itemKind: JourneyItemKind;
  assessmentPayload: JourneyAssessmentPayload | null;
  structuredAnswer: Record<string, unknown> | null;
}

/**
 * Pulls recent responses for a list of user_ids, ordered newest first.
 * Bounded — we don't paginate this view yet; the clinician should
 * triage current rows and the inbox should stay short by virtue of
 * their workflow.
 */
export async function listClinicianResponsesForUsers(args: {
  userIds: string[];
  limit?: number;
  isHe: boolean;
}): Promise<ClinicianResponseRow[]> {
  const { userIds, isHe } = args;
  const limit = Math.max(1, Math.min(args.limit ?? 50, 200));

  if (userIds.length === 0) return [];

  const admin = createServiceRoleClient();
  if (!admin) {
    console.error("[clinician-responses] no service-role client");
    return [];
  }

  // 1. Pull responses for these users.
  const { data: responses, error: rErr } = await admin
    .from("journey_item_responses")
    .select(
      "id, scheduled_item_id, user_id, response_text, is_private, created_at, clinician_status, clinician_reply_text, clinician_replied_at, structured_answer",
    )
    .in("user_id", userIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (rErr) {
    console.error("[clinician-responses] response fetch failed", rErr.message);
    return [];
  }
  if (!responses || responses.length === 0) return [];

  const scheduledIds = Array.from(
    new Set(responses.map((r) => String(r.scheduled_item_id))),
  );

  // 2. Hydrate scheduled items + items + categories in parallel
  const [scheduledRes, usersRes] = await Promise.all([
    admin
      .from("journey_scheduled_items")
      .select("id, item_id")
      .in("id", scheduledIds),
    admin
      .from("auth.users" as never)
      .select("id, email")
      .in("id", userIds)
      .returns<Array<{ id: string; email: string | null }>>(),
  ]);

  // The auth.users table isn't directly accessible via PostgREST in
  // most Supabase configurations. Fall back to looking up emails
  // through profiles or just leaving them null.
  const userEmailsById = new Map<string, string | null>();
  if (!usersRes.error && usersRes.data) {
    for (const u of usersRes.data) userEmailsById.set(u.id, u.email);
  }

  if (scheduledRes.error || !scheduledRes.data) {
    console.error("[clinician-responses] scheduled fetch failed", scheduledRes.error?.message);
    return [];
  }
  const itemIdByScheduledId = new Map<string, string>();
  for (const s of scheduledRes.data) {
    itemIdByScheduledId.set(String(s.id), String(s.item_id));
  }
  const itemIds = Array.from(new Set(itemIdByScheduledId.values()));

  const { data: items, error: iErr } = await admin
    .from("journey_items")
    .select("id, title_he, title_en, category_id, kind, assessment_payload")
    .in("id", itemIds);
  if (iErr || !items) {
    console.error("[clinician-responses] item fetch failed", iErr?.message);
    return [];
  }
  const itemById = new Map(items.map((i) => [String(i.id), i]));

  const categoryIds = Array.from(
    new Set(items.map((i) => String(i.category_id))),
  );
  const { data: cats } = await admin
    .from("journey_categories")
    .select("id, name_he, name_en")
    .in("id", categoryIds);
  const catById = new Map((cats ?? []).map((c) => [String(c.id), c]));

  // 3. Compose rows
  return responses.map((r) => {
    const scheduledId = String(r.scheduled_item_id);
    const itemId = itemIdByScheduledId.get(scheduledId);
    const item = itemId ? itemById.get(itemId) : null;
    const cat = item?.category_id ? catById.get(String(item.category_id)) : null;

    const itemTitle = item
      ? isHe
        ? item.title_he
        : (item.title_en as string | null) || item.title_he
      : "—";
    const categoryName = cat
      ? isHe
        ? cat.name_he
        : (cat.name_en as string | null) || cat.name_he
      : null;

    return {
      id: String(r.id),
      scheduledItemId: scheduledId,
      userId: String(r.user_id),
      userEmail: userEmailsById.get(String(r.user_id)) ?? null,
      itemTitle: itemTitle ?? "—",
      categoryName,
      responseText: String(r.response_text),
      isPrivate: !!r.is_private,
      createdAt: String(r.created_at),
      clinicianStatus: (r.clinician_status as ClinicianResponseStatus) ?? null,
      clinicianReplyText: (r.clinician_reply_text as string | null) ?? null,
      clinicianRepliedAt: (r.clinician_replied_at as string | null) ?? null,
      itemKind: ((item as { kind?: JourneyItemKind } | null)?.kind ?? "content") as JourneyItemKind,
      assessmentPayload:
        ((item as { assessment_payload?: JourneyAssessmentPayload | null } | null)
          ?.assessment_payload as JourneyAssessmentPayload | null) ?? null,
      structuredAnswer:
        (r.structured_answer as Record<string, unknown> | null) ?? null,
    };
  });
}
