// ============================================================
// lib/journey-content/resolve-priorities.ts
//
// Lazy-resolve `journey_user_priorities` for a user on the
// /my/journey page-load gate.
//
// Returns a ResolveResult that tells the caller what to do next:
//   - 'ready'             → Steps A or B succeeded; render dashboard.
//   - 'needs_assessment'  → No q_priorities answer for this user;
//                           caller should redirect to
//                           /journey/assessment/intro.
//   - 'no_program'        → Silent edge case (no active journey
//                           program, or transient DB error). Caller
//                           falls through to dashboard — user may
//                           see an empty state but no error page.
//
// Two-step cascade (silent, idempotent, never throws to the caller):
//
//   A. A row already exists in `journey_user_priorities` with
//      `ranking.length >= 1`.
//      Hotfix (2026-05-24): before returning 'ready', check that the
//      user has at least one unlocked scheduled item. If not (e.g.
//      the priorities row came from a backfill migration that
//      bypassed the materialize step), call materializeNextItemForUser
//      so the dashboard isn't empty.
//      → return { kind: 'ready' }.
//
//   B. The user has a `q_priorities` answer in `journey_responses`
//      (joined via `journeys.user_id`). Resolve the slugs to UUIDs
//      from `journey_categories` (active program only) → UPSERT with
//      source='assessment' → materialize a day-1 item.
//      → return { kind: 'ready' }.
//
//   Otherwise: no priorities row, no resolvable q_priorities answer.
//   → return { kind: 'needs_assessment' }. The caller redirects to
//   the assessment intro page; default-ranking fallback removed
//   (product decision 2026-05-24).
//
// Product decisions (uniform rule, applies to all users):
//   - NO console.log / console.error / admin alerts.
//   - ACTIVE program id is resolved DYNAMICALLY each call from
//     `journey_programs` (`product_slug='journey' AND
//     is_active=true`). No hardcoded UUID.
//   - DEFAULT_WEIGHTS are hardcoded; design constants.
//   - UPSERT uses ON CONFLICT DO UPDATE so stale/invalid rows get
//     repaired in place.
//   - materializeNextItemForUser is called in BOTH Step A (when
//     priorities exist but no item) and Step B (after the UPSERT)
//     so freshly-resolved users see content immediately.
// ============================================================

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { materializeNextItemForUser, type MaterializeResult } from "./cadence-engine";

/**
 * Default category weights matching `journey_settings.default_priority_weights`
 * from migration 055. Sliced to `ranking.length` before INSERT so the CHECK
 * constraint `array_length(ranking) = array_length(weights)` holds.
 */
const DEFAULT_WEIGHTS = [0.5, 0.25, 0.15, 0.07, 0.03] as const;

/** Product slug of the active journey program. */
const PRODUCT_SLUG = "journey";

/**
 * Outcome returned to the caller. Determines whether to redirect.
 */
export type ResolveResult =
  | { kind: "ready" }
  | { kind: "needs_assessment" }
  | { kind: "no_program" };

/**
 * Public entry point — called from /my/journey/page.tsx after the
 * cadence-assignment self-heal block, before the firstSession check.
 *
 * Idempotent. Silent. Never throws.
 *
 * @param admin  service-role Supabase client (the caller already has one)
 * @param userId effective user id (impersonation resolution upstream)
 */
export async function resolvePrioritiesForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<ResolveResult> {
  try {
    // ─── Step A: existing valid row? ─────────────────────────────────
    const { data: existing } = await admin
      .from("journey_user_priorities")
      .select("user_id, ranking")
      .eq("user_id", userId)
      .maybeSingle();

    const existingRanking = (existing as { ranking?: string[] } | null)
      ?.ranking;
    if (Array.isArray(existingRanking) && existingRanking.length >= 1) {
      // Hotfix: priorities row exists but no scheduled item yet
      // (e.g. backfilled rows from migration without natural materialize,
      // OR — the bug Itzik hit 2026-05-28 — the day-1 materialize fired
      // during /api/journey/answer raced the Cardcom webhook and
      // returned `no_journey_subscription`).
      //
      // We always RETRY here on page load. The cadence engine is
      // idempotent (journey_user_delivered_items dedup) so a re-fire
      // can only ever add a missing item, never duplicate one.
      const hasItem = await userHasUnlockedItem(admin, userId);
      if (!hasItem) {
        await materializeDay1Item(userId, "stepA");
      }
      return { kind: "ready" };
    }

    // ─── Resolve the active program (needed for Step B slug → UUID) ─
    const programId = await resolveActiveProgramId(admin);
    if (!programId) {
      // No active journey program at all — silent edge case.
      return { kind: "no_program" };
    }

    // ─── Step B: try resolving from q_priorities response ───────────
    const slugs = await loadLatestPrioritySlugs(admin, userId);
    if (slugs && slugs.length >= 1) {
      const ranking = await resolveSlugsToCategoryIds(
        admin,
        programId,
        slugs,
      );
      if (ranking.length >= 1) {
        const ok = await upsertPriorities(
          admin,
          userId,
          ranking,
          "assessment",
        );
        if (ok) {
          await materializeDay1Item(userId, "stepB");
        }
        return { kind: "ready" };
      }
      // Slugs all failed to resolve to active categories. This is a
      // data anomaly (e.g. the assessment shipped with slugs that no
      // longer match any active category). Treat as needs_assessment
      // so the user can re-answer with up-to-date options.
    }

    // ─── No usable q_priorities → assessment required ───────────────
    return { kind: "needs_assessment" };
  } catch {
    // Silent. On error, fall through (no redirect). Better to show
    // an empty dashboard than to redirect a healthy user to assessment
    // because of a transient DB error.
    return { kind: "no_program" };
  }
}

// ─────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────

/**
 * Look up the currently-active journey program's id. NULL when
 * the row hasn't been seeded yet OR has been retired without a
 * replacement.
 */
async function resolveActiveProgramId(
  admin: SupabaseClient,
): Promise<string | null> {
  const { data, error } = await admin
    .from("journey_programs")
    .select("id")
    .eq("product_slug", PRODUCT_SLUG)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

/**
 * Pull the user's LATEST q_priorities answer across every journey
 * row they own (anonymous-then-claimed flows can leave multiple).
 * Returns the priority-slug array when the answer JSON is shaped
 * correctly; null otherwise.
 */
async function loadLatestPrioritySlugs(
  admin: SupabaseClient,
  userId: string,
): Promise<string[] | null> {
  const { data, error } = await admin
    .from("journey_responses")
    .select("answer, journeys!inner(user_id)")
    .eq("journeys.user_id", userId)
    .eq("question_id", "q_priorities")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return extractValidSlugArray((data as { answer?: unknown }).answer);
}

/**
 * Validate the answer JSON shape. Expected:
 *   { "kind": "ranking", "order": ["intimacy", "communication", ...] }
 * Returns the slug array on success, null on any shape mismatch.
 */
function extractValidSlugArray(answer: unknown): string[] | null {
  if (!answer || typeof answer !== "object") return null;
  const a = answer as { kind?: unknown; order?: unknown };
  if (a.kind !== "ranking") return null;
  if (!Array.isArray(a.order)) return null;
  const slugs = a.order.filter((k): k is string => typeof k === "string");
  return slugs.length >= 1 ? slugs : null;
}

/**
 * Map priority slugs → category UUIDs, preserving slug order. Slugs
 * with no matching active category in the program are dropped
 * silently; the returned array can be shorter than the input.
 */
async function resolveSlugsToCategoryIds(
  admin: SupabaseClient,
  programId: string,
  slugs: string[],
): Promise<string[]> {
  const { data, error } = await admin
    .from("journey_categories")
    .select("id, assessment_priority_key")
    .eq("is_active", true)
    .eq("program_id", programId)
    .in("assessment_priority_key", slugs);
  if (error || !data) return [];
  const slugToId = new Map<string, string>();
  for (const row of data as Array<{
    id: string;
    assessment_priority_key: string;
  }>) {
    slugToId.set(row.assessment_priority_key, row.id);
  }
  return slugs
    .map((s) => slugToId.get(s))
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

/**
 * UPSERT a priorities row with the given ranking and source. Weights
 * are sliced from DEFAULT_WEIGHTS to match ranking length so the
 * `array_length(ranking) = array_length(weights)` CHECK passes.
 *
 * Returns true on success, false on any DB error.
 */
async function upsertPriorities(
  admin: SupabaseClient,
  userId: string,
  ranking: string[],
  source: "assessment" | "admin_override",
): Promise<boolean> {
  const weights = DEFAULT_WEIGHTS.slice(0, ranking.length);
  const { error } = await admin
    .from("journey_user_priorities")
    .upsert(
      { user_id: userId, ranking, weights, source },
      { onConflict: "user_id" },
    );
  return !error;
}

/**
 * Does the user have at least one scheduled item that's already
 * unlocked (unlock_at <= now) on an ACTIVE assignment? Used by Step
 * A's hotfix to detect users with a priorities row but no items
 * (e.g. backfilled via SQL migration without going through the
 * natural materialize path).
 *
 * On query error: return true (assume yes) to avoid double-
 * materializing under transient failures.
 */
async function userHasUnlockedItem(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("journey_scheduled_items")
    .select("id, journey_assignments!inner(user_id, is_active)")
    .eq("journey_assignments.user_id", userId)
    .eq("journey_assignments.is_active", true)
    .lte("unlock_at", new Date().toISOString())
    .limit(1);
  if (error) return true; // Defensive: don't double-materialize on error
  return (data?.length ?? 0) > 0;
}

/**
 * Materialize the user's day-1 cadence item with `unlock_at=now`.
 * Delegates entirely to the cadence engine — it handles
 * eligibility checks (subscription, grace), dedup, and the
 * `journey_user_delivered_items` lock.
 *
 * 2026-05-28 — was `Promise<void>` with a silent `catch {}`. That
 * masked the exact failure mode Itzik hit (paid + assessment-
 * complete user with zero scheduled_items, no signal in logs).
 * Now returns the `MaterializeResult` so callers can act on
 * `ok=false`, and logs both throws AND structured `reason`/`error`
 * returns. The error is still NOT rethrown to the caller — better
 * to render an empty dashboard than a 500 — but it's no longer
 * invisible.
 */
async function materializeDay1Item(
  userId: string,
  context: "stepA" | "stepB",
): Promise<MaterializeResult> {
  try {
    const result = await materializeNextItemForUser(userId, {
      unlockAt: new Date(),
      source: "cadence",
      skipSweep: true,
    });
    if (!result.ok) {
      console.warn(
        "[resolve-priorities] day-1 materialize returned !ok",
        `user_id=${userId}`,
        `context=${context}`,
        `reason=${result.reason ?? "(unspecified)"}`,
        `error=${result.error ?? "(none)"}`,
      );
    } else {
      console.log(
        "[resolve-priorities] day-1 materialize OK",
        `user_id=${userId}`,
        `context=${context}`,
        `scheduledItemId=${result.scheduledItemId ?? "(none)"}`,
        `itemId=${result.itemId ?? "(none)"}`,
      );
    }
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      "[resolve-priorities] day-1 materialize THREW",
      `user_id=${userId}`,
      `context=${context}`,
      `error=${msg}`,
    );
    return { ok: false, reason: "db_error", error: msg };
  }
}
