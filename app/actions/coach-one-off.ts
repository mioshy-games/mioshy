"use server";

/**
 * app/actions/coach-one-off.ts
 *
 * Phase 13 — server action for creating an AD-HOC one-off lesson for a
 * single couple. Distinct from /dashboard/journey/items because:
 *
 *   1. The coach writes content INSIDE the per-couple workspace, with
 *      that couple's context already on screen.
 *   2. The new item is flagged is_one_off=true so it's hidden from the
 *      main catalog browser AND from auto-suggestions for other couples.
 *   3. We immediately schedule it for the couple — anchor=now, unlock=now —
 *      so the couple sees it on /my/journey within seconds, not whenever
 *      the next cadence cron fires.
 *   4. The coach can create a brand-new category inline (one of the
 *      Phase 13 spec asks).
 *
 * The lesson body uses the full 9-block schema from migration 077, but
 * everything except title + body is optional. The coach can ship a
 * minimal "title + body" item or fill out the full lesson — same path.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";

// ─── Auth: admin OR linked expert ─────────────────────────────────────

async function requireCoachForCouple(coupleId: string): Promise<string> {
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

  if (profile?.role === "admin") return user.id;

  // Expert path — must be linked to this couple via expert_couples.
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("service_role_unavailable");
  const { data: link } = await admin
    .from("expert_couples")
    .select("id")
    .eq("expert_id", user.id)
    .eq("couple_id", coupleId)
    .eq("is_active", true)
    .maybeSingle();
  if (!link) throw new Error("not_linked_to_couple");
  return user.id;
}

// ─── Validation ───────────────────────────────────────────────────────

const TargetEnum = z.enum(["both", "a", "b"]);

const Schema = z.object({
  coupleId: z.string().uuid(),
  target:   TargetEnum,
  // Category — one of these two is required.
  categoryId:      z.string().uuid().optional(),
  newCategoryName: z.string().trim().min(2).max(80).optional(),
  // Required content.
  title: z.string().trim().min(2).max(200),
  body:  z.string().trim().min(10).max(8000),
  // Optional lesson blocks (all Hebrew — coach writes in the language
  // of the couple, English is auto-mirrored to satisfy the user UI).
  task:             z.string().trim().max(2000).optional(),
  expertInsight:    z.string().trim().max(3000).optional(),
  commonMistakes:   z.string().trim().max(2000).optional(),
  metaphor:         z.string().trim().max(2000).optional(),
  measurement:      z.string().trim().max(2000).optional(),
  doThisWeek:       z.string().trim().max(2000).optional(),
  dontThisWeek:     z.string().trim().max(2000).optional(),
  progressMarker:   z.string().trim().max(1000).optional(),
}).refine(
  (v) => !!v.categoryId || !!v.newCategoryName,
  { message: "must_pick_or_create_category", path: ["categoryId"] },
);

export type CoachOneOffInput = z.input<typeof Schema>;

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ─── Helpers ──────────────────────────────────────────────────────────

function slugify(s: string): string {
  // Hebrew-friendly slug: keep alphanumerics + hebrew block, hyphenate
  // the rest. We're not building SEO URLs here — this only needs to be
  // unique within the (category_id, slug) constraint.
  const base = s
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .toLowerCase();
  const stamp = Date.now().toString(36).slice(-5);
  return `${base || "one-off"}-${stamp}`;
}

async function resolvePartnerUserIds(
  coupleId: string,
  target: "both" | "a" | "b",
): Promise<string[]> {
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("service_role_unavailable");
  const { data: members } = await admin
    .from("couple_members")
    .select("user_id, role, joined_at")
    .eq("couple_id", coupleId)
    .order("joined_at", { ascending: true });
  if (!members || members.length === 0) {
    throw new Error("couple_has_no_members");
  }
  const owner = members.find((m) => m.role === "owner");
  const partner = members.find((m) => m.role !== "owner");
  const aId = owner?.user_id ?? members[0].user_id;
  const bId = partner?.user_id ?? members[1]?.user_id ?? null;
  if (target === "a") return [aId];
  if (target === "b") {
    if (!bId) throw new Error("partner_b_not_present");
    return [bId];
  }
  return [aId, ...(bId ? [bId] : [])];
}

// ─── Main entrypoint ──────────────────────────────────────────────────

export async function createOneOffItemForCouple(
  raw: CoachOneOffInput,
): Promise<ActionResult<{ itemId: string; assignments: number }>> {
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "validation_failed",
    };
  }
  const v = parsed.data;

  let coachId: string;
  try {
    coachId = await requireCoachForCouple(v.coupleId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, error: "service_role_unavailable" };

  // 1. Resolve / create category.
  let categoryId = v.categoryId ?? "";
  if (!categoryId && v.newCategoryName) {
    const catSlug = slugify(v.newCategoryName);
    const { data: catRow, error: catErr } = await admin
      .from("journey_categories")
      .insert({
        program_id: null,
        slug:       catSlug,
        name_he:    v.newCategoryName,
        name_en:    v.newCategoryName,
        is_active:  true,
      })
      .select("id")
      .single();
    if (catErr || !catRow) {
      return {
        ok: false,
        error: `category_create_failed: ${catErr?.message ?? "no row"}`,
      };
    }
    categoryId = catRow.id;
  }

  // 2. Create the journey_item with is_one_off=true.
  const itemSlug = slugify(v.title);
  const { data: itemRow, error: itemErr } = await admin
    .from("journey_items")
    .insert({
      category_id:        categoryId,
      slug:               itemSlug,
      title_he:           v.title,
      title_en:           v.title,
      body_he:            v.body,
      body_en:            v.body,
      task_he:            v.task ?? null,
      task_en:            v.task ?? null,
      expert_insight_he:  v.expertInsight ?? null,
      expert_insight_en:  v.expertInsight ?? null,
      common_mistakes_he: v.commonMistakes ?? null,
      common_mistakes_en: v.commonMistakes ?? null,
      metaphor_he:        v.metaphor ?? null,
      metaphor_en:        v.metaphor ?? null,
      measurement_he:     v.measurement ?? null,
      measurement_en:     v.measurement ?? null,
      do_this_week_he:    v.doThisWeek ?? null,
      do_this_week_en:    v.doThisWeek ?? null,
      dont_this_week_he:  v.dontThisWeek ?? null,
      dont_this_week_en:  v.dontThisWeek ?? null,
      progress_marker_he: v.progressMarker ?? null,
      progress_marker_en: v.progressMarker ?? null,
      sort_order:         0,
      default_offset_days: 0,
      is_active:          true,
      is_one_off:         true,
      created_by:         coachId,
    })
    .select("id")
    .single();
  if (itemErr || !itemRow) {
    return {
      ok: false,
      error: `item_create_failed: ${itemErr?.message ?? "no row"}`,
    };
  }
  const itemId = itemRow.id as string;

  // 3. Resolve partners + create per-user assignments. We mirror the
  // pattern used by sendIntervention for item_assignment: one row per
  // partner with user_id set, couple_id=null. anchor_date = now so the
  // item unlocks immediately when the cadence engine materialises it.
  let userIds: string[];
  try {
    userIds = await resolvePartnerUserIds(v.coupleId, v.target);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const nowIso = new Date().toISOString();
  const assignmentRows = userIds.map((uid) => ({
    user_id:     uid,
    couple_id:   null,
    source_kind: "item" as const,
    source_id:   itemId,
    anchor_kind: "assignment" as const,
    anchor_date: nowIso,
    origin:      "admin_manual" as const,
    assigned_by: coachId,
    notes:       "Phase 13 — ad-hoc one-off item",
    is_active:   true,
  }));
  const { data: assignedRows, error: aErr } = await admin
    .from("journey_assignments")
    .insert(assignmentRows)
    .select("id, user_id");
  if (aErr || !assignedRows) {
    return {
      ok: false,
      error: `assignment_create_failed: ${aErr?.message ?? "no rows"}`,
    };
  }

  // 4. Pre-materialize the scheduled_items rows so the couple sees the
  // lesson on /my/journey immediately rather than waiting for the
  // cadence cron. Best-effort: if the dedup table errors (e.g. unique
  // violation) we still consider the action successful — the engine
  // will pick it up on the next tick.
  for (const row of assignedRows as Array<{ id: string; user_id: string }>) {
    const { data: schedRow, error: sErr } = await admin
      .from("journey_scheduled_items")
      .insert({
        assignment_id:        row.id,
        item_id:              itemId,
        unlock_at:            nowIso,
        sort_order:           0,
        has_unlock_override:  true,
        source:               "expert_push",
        audience:             "both",
      })
      .select("id")
      .single();
    if (sErr || !schedRow) {
      console.error("[coach-one-off] schedule failed", sErr);
      continue;
    }
    // Mark dedup row so the cadence engine won't re-queue this item.
    await admin
      .from("journey_user_delivered_items")
      .insert({
        user_id:           row.user_id,
        item_id:           itemId,
        source:            "expert_push",
        scheduled_item_id: schedRow.id,
      });
  }

  // 5. Tell the recommendations log that this item was delivered, so
  // the 24h cooldown machinery treats it like any other suggestion the
  // coach acted on.
  await admin
    .from("journey_couple_recommendations")
    .upsert(
      {
        couple_id:         v.coupleId,
        item_id:           itemId,
        rationale:         "Coach hand-crafted a one-off lesson for this couple",
        score:             null,
        last_suggested_at: nowIso,
        acted_at:          nowIso,
        created_by:        coachId,
      },
      { onConflict: "couple_id,item_id" },
    );

  revalidatePath(`/dashboard/my-clients/${v.coupleId}`);
  for (const uid of userIds) revalidatePath(`/dashboard/users/${uid}`);

  return { ok: true, data: { itemId, assignments: userIds.length } };
}
