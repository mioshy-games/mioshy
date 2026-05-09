// ============================================================
// Auto-assignment of Journey programs on purchase.
//
// When the Cardcom indicator (webhook) confirms a paid subscription, we
// want the user to land on /journey/timeline with content already queued
// - no "go to dashboard and click Assign" middle-step.
//
// This module resolves:
//   1. Which program corresponds to the purchased product pillar
//      (migration 036 added journey_programs.product_slug).
//   2. Who the owner is - prefer the user's couple when paired, so both
//      partners see the same timeline immediately.
//   3. Whether an auto-assignment already exists (idempotent on the
//      origin_ref so webhook replays don't duplicate rows).
//   4. Whether the owner already has an active manual/auto assignment
//      for the same source program - if so we leave it alone. This is
//      the "no overwrites without intent" rule from the Phase 6 brief.
//
// The Cardcom indicator is fire-and-forget from the user's perspective,
// so this helper NEVER throws - failures are logged and returned as a
// result object. A later admin retry can call createJourneyAssignment
// directly without ceremony.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase-admin";
import { materializeAssignment } from "./materialize";
import { resolveRuleId } from "./match-rules";
import { resolveAnchorDate } from "./schedule";
import type {
  JourneyAssignment,
  JourneyProductSlug,
  JourneyProgram,
} from "./types";

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------

export interface AssignJourneyOnPurchaseArgs {
  /** Buyer from the checkout session - always required. */
  userId: string;
  /** Product pillar they subscribed to. */
  product: JourneyProductSlug;
  /** When the payment cleared - becomes the assignment's anchor. */
  purchasedAt: Date;
  /**
   * Stable idempotency key from the upstream payment system (Cardcom
   * checkout session id is the canonical value today). Used as
   * origin_ref so webhook replays are free.
   */
  checkoutSessionId: string;
  /**
   * Optional pre-computed admin client. The Cardcom indicator already
   * has one, so threading it through avoids a second SSR setup.
   */
  supabase?: SupabaseClient;
}

export type AssignJourneyOnPurchaseResult =
  | {
      ok: true;
      outcome: "created";
      assignmentId: string;
      inserted: number;
      programId: string;
    }
  | {
      ok: true;
      outcome: "already_assigned";
      /** Row the webhook would have created had this been a first run. */
      assignmentId: string;
    }
  | {
      ok: true;
      outcome: "existing_owner_assignment";
      /** The pre-existing assignment we deferred to. */
      assignmentId: string;
      programId: string;
    }
  | {
      ok: true;
      outcome: "no_program_configured";
      product: JourneyProductSlug;
    }
  | { ok: false; reason: string };

/**
 * Main entry point - idempotent, non-throwing, safe to call from a webhook.
 *
 * Contract:
 *   • Always resolves to an `ok: true` result when the business state is
 *     consistent (including "nothing to do" shapes).
 *   • Returns `ok: false` only for infra/DB errors worth alerting on.
 */
export async function assignJourneyOnPurchase(
  args: AssignJourneyOnPurchaseArgs,
): Promise<AssignJourneyOnPurchaseResult> {
  const supabase = args.supabase ?? (await createAdminClient());
  const originRef = buildOriginRef(args.checkoutSessionId);

  try {
    // 1. Idempotency - has this specific checkout already assigned?
    const existingForCheckout = await findAssignmentByOriginRef(
      supabase,
      originRef,
    );
    if (existingForCheckout) {
      return {
        ok: true,
        outcome: "already_assigned",
        assignmentId: existingForCheckout.id,
      };
    }

    // 2. Program lookup by product_slug (exactly one active row per slug).
    const program = await findActiveProgramForProduct(supabase, args.product);
    if (!program) {
      // Not configured yet - webhook should not fail; admin can wire this
      // up in the program editor when ready.
      return {
        ok: true,
        outcome: "no_program_configured",
        product: args.product,
      };
    }

    // 3. Resolve the preferred owner - couple wins when the user has one.
    const owner = await resolveOwnerForUser(supabase, args.userId);

    // 4. Respect any pre-existing active assignment for this owner+program.
    //    That prevents an admin's manual curation from being stomped by
    //    the auto-assign hook, and also prevents a second subscription
    //    purchase within the same period from duplicating scheduled rows.
    const existingOwnerAssignment = await findActiveAssignmentForOwnerProgram(
      supabase,
      owner,
      program.id,
    );
    if (existingOwnerAssignment) {
      return {
        ok: true,
        outcome: "existing_owner_assignment",
        assignmentId: existingOwnerAssignment.id,
        programId: program.id,
      };
    }

    // 5. Create the assignment with the purchase date as anchor, then
    //    materialize its scheduled items. Anchor is normalized to
    //    start-of-UTC-day by resolveAnchorDate so per-day offsets behave
    //    predictably across DST.
    const anchorIso = resolveAnchorDate({
      anchorKind: "purchase",
      purchaseAt: args.purchasedAt,
    });

    const insertRow = {
      user_id: owner.kind === "user" ? owner.userId : null,
      couple_id: owner.kind === "couple" ? owner.coupleId : null,
      source_kind: "program" as const,
      source_id: program.id,
      anchor_kind: "purchase" as const,
      anchor_date: anchorIso,
      origin: "purchase" as const,
      origin_ref: originRef,
      notes: `Auto-assigned on purchase (${args.product}).`,
      is_active: true,
    };

    const { data: assignment, error: insErr } = await supabase
      .from("journey_assignments")
      .insert(insertRow)
      .select("*")
      .single();

    if (insErr || !assignment) {
      return {
        ok: false,
        reason: insErr?.message ?? "failed to insert assignment",
      };
    }

    const { inserted } = await materializeAssignment({
      assignment: assignment as JourneyAssignment,
      supabase,
      // Every row inherits the default-program rule until the day-1
      // override below promotes the first row to 'day_one_kickoff'.
      defaultRuleSlug: "default_program_kickoff",
    });

    // ──────────────────────────────────────────────────────────────────
    // Day-1 override (Itzik 2026-05-07).
    //
    // Items in a program normally schedule via `default_offset_days`
    // (the cadence engine drips one per Monday from the anchor date).
    // For a freshly-purchased Journey, the user expects to see SOMETHING
    // unlocked immediately — anything else feels broken even if it's
    // technically "working as designed".
    //
    // We force the EARLIEST scheduled item (lowest sort_order) to
    // unlock right now, and mark `has_unlock_override=true` so the
    // expert dashboard can see it was a system-driven shift, not a
    // mistake. Best-effort: failure here doesn't fail the assignment.
    if (inserted > 0) {
      try {
        // `materializeAssignment` returns the count, not the rows, so we
        // requery to find the first scheduled item by sort_order.
        const { data: firstItem } = await supabase
          .from("journey_scheduled_items")
          .select("id, sort_order")
          .eq("assignment_id", (assignment as JourneyAssignment).id)
          .order("sort_order", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (firstItem?.id) {
          const nowIso = new Date().toISOString();
          // Promote the first item's rule attribution to day_one_kickoff
          // so the user sees "First step of your journey" rather than
          // the default "part of your starting program" line.
          const dayOneRuleId = await resolveRuleId("day_one_kickoff");
          await supabase
            .from("journey_scheduled_items")
            .update({
              unlock_at: nowIso,
              has_unlock_override: true,
              ...(dayOneRuleId ? { matched_by_rule_id: dayOneRuleId } : {}),
            })
            .eq("id", firstItem.id as string);
        }
      } catch (overrideErr) {
        console.warn(
          "[assignJourneyOnPurchase] day-1 unlock override failed (non-fatal)",
          overrideErr,
        );
      }
    }

    // Layer-5 — stamp couples.started_journey_at on first purchase
    // so the anniversary milestones (30 / 90 / 365 days) anchor to
    // the moment the couple actually started, not to couple creation.
    // Best-effort: failure here doesn't fail the assignment.
    if (owner.kind === "couple") {
      try {
        await supabase
          .from("couples")
          .update({ started_journey_at: anchorIso })
          .eq("id", owner.coupleId)
          .is("started_journey_at", null);
      } catch (err) {
        console.warn(
          "[assignJourneyOnPurchase] started_journey_at stamp failed (non-fatal)",
          err,
        );
      }
    }

    return {
      ok: true,
      outcome: "created",
      assignmentId: (assignment as JourneyAssignment).id,
      inserted,
      programId: program.id,
    };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

// ------------------------------------------------------------
// Internals
// ------------------------------------------------------------

/**
 * Canonical origin_ref shape: `cardcom:<checkout_session_id>`. The prefix
 * leaves room for other payment providers later without forcing a schema
 * migration.
 */
export function buildOriginRef(checkoutSessionId: string): string {
  return `cardcom:${checkoutSessionId}`;
}

async function findAssignmentByOriginRef(
  supabase: SupabaseClient,
  originRef: string,
): Promise<JourneyAssignment | null> {
  const { data, error } = await supabase
    .from("journey_assignments")
    .select("*")
    .eq("origin", "purchase")
    .eq("origin_ref", originRef)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as JourneyAssignment | null) ?? null;
}

async function findActiveProgramForProduct(
  supabase: SupabaseClient,
  product: JourneyProductSlug,
): Promise<JourneyProgram | null> {
  const { data, error } = await supabase
    .from("journey_programs")
    .select("*")
    .eq("product_slug", product)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as JourneyProgram | null) ?? null;
}

type OwnerRef =
  | { kind: "user"; userId: string }
  | { kind: "couple"; coupleId: string };

async function resolveOwnerForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<OwnerRef> {
  // Admin client bypasses RLS so we can see the user's couple regardless
  // of invocation context. If the user isn't paired this returns the
  // solo user owner shape.
  const { data, error } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.couple_id) {
    return { kind: "couple", coupleId: data.couple_id as string };
  }
  return { kind: "user", userId };
}

async function findActiveAssignmentForOwnerProgram(
  supabase: SupabaseClient,
  owner: OwnerRef,
  programId: string,
): Promise<JourneyAssignment | null> {
  let q = supabase
    .from("journey_assignments")
    .select("*")
    .eq("is_active", true)
    .eq("source_kind", "program")
    .eq("source_id", programId);

  if (owner.kind === "couple") q = q.eq("couple_id", owner.coupleId);
  else q = q.eq("user_id", owner.userId);

  const { data, error } = await q.maybeSingle();
  if (error) {
    // When more than one row matches maybeSingle() returns an error - we
    // still want the first as the "existing" signal for the dedup check.
    if (/multiple/i.test(error.message)) {
      const { data: fallback } = await q.limit(1);
      const first = (fallback ?? [])[0] as JourneyAssignment | undefined;
      return first ?? null;
    }
    throw new Error(error.message);
  }
  return (data as JourneyAssignment | null) ?? null;
}
