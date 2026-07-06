// ============================================================
// Auto-assignment of Journey on purchase.
//
// Updated 2026-05-24 (P1.1): switched from program-kind assignments
// with eager materialization to per-user cadence containers with
// lazy item delivery. Items are no longer created at purchase time —
// they're materialized by the cadence engine after the user completes
// their priority-ranking assessment.
//
// When the Cardcom indicator (webhook) confirms a paid subscription,
// this module:
//   1. Resolves the anchor date from the purchase timestamp
//      (start-of-UTC-day per schedule.resolveAnchorDate).
//   2. Resolves the user's couple membership — only for the
//      couples.started_journey_at stamp (Layer-5 anniversary
//      milestones). This stamp is best-effort: failure here is
//      logged but does not fail the assignment. Cadence assignments
//      themselves are PER-USER, not per-couple, since each partner
//      has their own priority ranking and delivered-items history.
//   3. Calls ensureCadenceAssignment (cadence-engine.ts) — idempotent
//      get-or-create. Returns the SAME id for Cardcom webhook retries,
//      post-cancel resubscribes, and concurrent calls (23505 race
//      recovery handled inside).
//
// What does NOT happen here:
//   - No scheduled_items are materialized. The first item arrives
//     when the user submits priorities in /journey/assessment, via
//     cadence-trigger.onPriorityRankingSubmitted → day-1 materialize.
//   - No program lookup. The cadence engine works on priority
//     categories from migration 055, not on per-product programs.
//
// Non-blocking from the user's UI flow — the user's redirect happens
// regardless of auto-assign outcome. This helper therefore NEVER
// throws; failures are logged and returned as a result object with
// ok: false.
//
// Related modules:
//   - cadence-engine.ts        — ensureCadenceAssignment + picker + cron
//   - cadence-trigger.ts       — onPriorityRankingSubmitted (day-1 item)
//   - app/[locale]/my/journey/page.tsx — self-heal gate for legacy users
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase-admin";
import { ensureCadenceAssignment } from "./cadence-engine";
import { resolveAnchorDate } from "./schedule";
import { sendCampaignMessage } from "@/lib/whatsapp/campaign";
import { coachWelcomeTemplate } from "@/lib/whatsapp/templates";
import { coachWelcomeApplies } from "@/lib/whatsapp/rules";
import type { JourneyProductSlug } from "./types";

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
      outcome: "cadence_assignment_ready";
      assignmentId: string;
      userId: string;
    }
  | { ok: false; reason: string };

/**
 * Main entry point — idempotent, non-throwing, safe to call from a webhook.
 *
 * Contract:
 *   • Always resolves to an `ok: true` result when the business state is
 *     consistent. The new cadence-based flow has no "nothing to do" cases —
 *     every paying user gets a cadence assignment (creating one if absent).
 *   • Returns `ok: false` only for infra/DB errors worth alerting on.
 *
 * What changed in P1.1 (2026-05-24):
 *   - REMOVED: program-kind assignment creation + materializeAssignment.
 *     Previously created 275 scheduled_items at offset=0 → "everything
 *     unlocked" bug.
 *   - REMOVED: day-1 unlock_at override. The first item is now
 *     materialized by cadence-trigger.onPriorityRankingSubmitted after
 *     the user completes /journey/assessment.
 *   - ADDED: ensureCadenceAssignment — idempotent get-or-create of the
 *     per-user cadence container. Re-invocations return the SAME
 *     assignment id (Cardcom retries, post-cancel resubscribes).
 */
export async function assignJourneyOnPurchase(
  args: AssignJourneyOnPurchaseArgs,
): Promise<AssignJourneyOnPurchaseResult> {
  const supabase = args.supabase ?? (await createAdminClient());

  try {
    // 1. Resolve anchor — start-of-UTC-day from the purchase timestamp.
    //    Becomes the cadence assignment's anchor_date and the reference
    //    point for "weeks since join" delivery slots.
    const anchorIso = resolveAnchorDate({
      anchorKind: "purchase",
      purchaseAt: args.purchasedAt,
    });
    const anchorDate = new Date(anchorIso);

    // 2. Resolve owner — used only for the couples.started_journey_at
    //    stamp. Cadence assignments themselves are PER-USER (migration
    //    058's partial unique index keys on user_id only), so paired
    //    users each get their own assignment.
    const owner = await resolveOwnerForUser(supabase, args.userId);

    // 3. Get-or-create the per-user cadence assignment.
    //    ensureCadenceAssignment is idempotent via the partial unique
    //    index on (user_id) WHERE source_kind='cadence' AND
    //    is_active=true (migration 058). Returns the SAME id for:
    //      - Cardcom webhook retries (same user, same payment)
    //      - Post-cancel resubscribes (preserves anchor +
    //        delivered_items + priority ranking history)
    //      - Concurrent calls (handled via 23505 race recovery inside)
    //
    //    NOTE: We do NOT materialize scheduled_items here. Items are
    //    created lazily by the cadence engine when:
    //      (a) The user submits priority ranking →
    //          onPriorityRankingSubmitted fires
    //          materializeNextItemForUser for the day-1 item.
    //      (b) The cadence cron tick fires on a delivery slot.
    //    This prevents the "275 items unlocked at once" bug.
    const assignmentId = await ensureCadenceAssignment(
      args.userId,
      anchorDate,
    );
    if (!assignmentId) {
      return {
        ok: false,
        reason: "ensureCadenceAssignment returned null (no admin client?)",
      };
    }

    // 4. Layer-5 — stamp the couple's started_journey_at on first
    //    purchase so the anniversary milestones (30/90/365 days)
    //    anchor to the moment the couple actually started, not to
    //    couple creation. The `.is("started_journey_at", null)` guard
    //    makes this a no-op on resubscribe.
    //    Best-effort: failure here doesn't fail the assignment.
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

    // coach_welcome (WhatsApp) — one-time welcome for a new JOURNEY joiner,
    // right after the subscription exists (a joiner here is BY DEFINITION a
    // purchaser, satisfying the "non-purchaser never gets coach" rule). Fully
    // gated by the campaign layer (WHATSAPP_MODE, opt-in, idempotency, 1/week
    // throttle). Best-effort: never blocks or fails the assignment.
    if (coachWelcomeApplies(args.product)) {
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", args.userId)
          .maybeSingle();
        const firstName = ((prof?.full_name as string | null) ?? "")
          .trim()
          .split(/\s+/)[0];
        if (firstName) {
          await sendCampaignMessage({
            userId: args.userId,
            template: coachWelcomeTemplate({ name: firstName }),
          });
        }
      } catch (err) {
        console.warn(
          "[assignJourneyOnPurchase] coach_welcome send failed (non-fatal)",
          err,
        );
      }
    }

    return {
      ok: true,
      outcome: "cadence_assignment_ready",
      assignmentId,
      userId: args.userId,
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
