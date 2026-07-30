// ============================================================
// lib/journey-content/ensure-priorities.ts
//
// Spec §2א(א) — "a paying customer never sits with no content".
//
// The ranking used to be written only when the assessment finished
// (cadence-trigger.onPriorityRankingSubmitted), and every delivery path
// rejects a user who has no journey_user_priorities row. Both paying journey
// subscribers therefore received ZERO items from the day they bought:
//
//   itzikbab@gmail.com  bought 2026-07-15, assessment stuck at step 13 → 0 items
//   t6102622@gmail.com  bought 2026-06-30, assessment stuck at step 12 → 0 items
//
// From now on the purchase itself is enough. If the assessment already
// produced a ranking we keep it; if not we seed the canonical order and mark
// it source='default' so the UI can invite the user to refine it.
//
// A default row is NOT sticky: cadence-trigger upserts on user_id, so
// finishing the assessment later overwrites it with source='assessment'.
//
// (A default fallback was deliberately removed on 2026-05-24 — see the header
// of resolve-priorities.ts. Spec §2א reverses that decision.)
// ============================================================

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { CATEGORY_DISPLAY_ORDER } from "@/lib/journey/categories";

/** Matches journey_settings.default_priority_weights (migration 055). */
const DEFAULT_WEIGHTS = [0.5, 0.25, 0.15, 0.07, 0.03] as const;

const PRODUCT_SLUG = "journey";

export type EnsurePrioritiesStatus =
  | "existing" // a ranking was already there — untouched
  | "seeded_default" // no ranking; the canonical order was written
  | "no_program" // no active journey program (nothing we can seed against)
  | "failed";

export interface EnsurePrioritiesResult {
  status: EnsurePrioritiesStatus;
  /** Category UUIDs, most-important first. Present on existing/seeded. */
  ranking?: string[];
  source?: "assessment" | "user_edit" | "admin_override" | "default";
  error?: string;
}

/**
 * Guarantee this user has a usable priority ranking. Idempotent, never throws.
 *
 * Call it on the purchase path — it is the gate that decides whether the user
 * gets content at all.
 */
export async function ensureJourneyPriorities(
  userId: string,
): Promise<EnsurePrioritiesResult> {
  const admin = createServiceRoleClient();
  if (!admin) return { status: "failed", error: "no_admin_client" };

  try {
    // ── Already ranked? Leave it alone. ──────────────────────────────────
    const { data: existing, error: readErr } = await admin
      .from("journey_user_priorities")
      .select("ranking, source")
      .eq("user_id", userId)
      .maybeSingle();
    if (readErr) return { status: "failed", error: readErr.message };

    const row = existing as { ranking?: string[]; source?: string } | null;
    if (Array.isArray(row?.ranking) && row.ranking.length >= 1) {
      return {
        status: "existing",
        ranking: row.ranking,
        source: (row.source as EnsurePrioritiesResult["source"]) ?? "assessment",
      };
    }

    // ── Seed the canonical order ─────────────────────────────────────────
    const { data: program, error: progErr } = await admin
      .from("journey_programs")
      .select("id")
      .eq("product_slug", PRODUCT_SLUG)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (progErr) return { status: "failed", error: progErr.message };
    if (!program) return { status: "no_program" };

    const ranking = await defaultRankingForProgram(
      admin,
      (program as { id: string }).id,
    );
    if (!ranking.length) return { status: "no_program" };

    const { error: writeErr } = await admin
      .from("journey_user_priorities")
      .upsert(
        {
          user_id: userId,
          ranking,
          weights: DEFAULT_WEIGHTS.slice(0, ranking.length),
          source: "default",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (writeErr) return { status: "failed", error: writeErr.message };

    console.log("[ensure-priorities] seeded default ranking", {
      user_id8: userId.slice(0, 8),
      categories: ranking.length,
    });
    return { status: "seeded_default", ranking, source: "default" };
  } catch (err) {
    return { status: "failed", error: String(err) };
  }
}

/**
 * The canonical category order (lib/journey/categories.ts is the single source
 * of truth for keys and order) resolved to this program's category UUIDs via
 * assessment_priority_key.
 *
 * Any category the program does not define is skipped rather than faked, so a
 * partially-seeded program yields a shorter but valid ranking.
 */
async function defaultRankingForProgram(
  admin: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  programId: string,
): Promise<string[]> {
  const { data, error } = await admin
    .from("journey_categories")
    .select("id, assessment_priority_key")
    .eq("program_id", programId)
    .eq("is_active", true);
  if (error || !data) return [];

  const byKey = new Map<string, string>();
  for (const c of data as Array<{ id: string; assessment_priority_key: string | null }>) {
    if (c.assessment_priority_key) byKey.set(c.assessment_priority_key, c.id);
  }
  return CATEGORY_DISPLAY_ORDER.map((k) => byKey.get(k)).filter(
    (id): id is string => Boolean(id),
  );
}
