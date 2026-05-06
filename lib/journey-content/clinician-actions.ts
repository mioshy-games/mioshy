"use server";

/**
 * lib/journey-content/clinician-actions.ts
 *
 * Server actions a clinician calls from the dashboard to:
 *   - reply to a user's response
 *   - change the triage status (open / resolved / concerning)
 *
 * Phase 2D - closes the loop on the response workflow.
 *
 * Auth model:
 *   - We re-use the existing `requireExpert()` helper that the
 *     /dashboard/my-clients pages already use. Anyone who can land
 *     on the inbox can act on it.
 *   - Writes go through the service-role client because the
 *     `journey_item_responses.clinician_*` columns aren't covered
 *     by the user's RLS policies (the user can only INSERT/SELECT
 *     their own responses; updates are clinician territory).
 *
 * Hard rules:
 *   - Never throws to the caller; returns a typed result.
 *   - Path-revalidates the couple detail page so the inbox refreshes
 *     after the action without a manual reload.
 */

import { revalidatePath } from "next/cache";
import { requireExpert } from "@/lib/auth/expert";
import { createServiceRoleClient } from "@/lib/supabase-admin";

export type ClinicianStatus = "open" | "resolved" | "concerning";

export type ClinicianActionResult =
  | { ok: true }
  | { ok: false; reason: "unauthorized" | "invalid_input" | "db_error"; message?: string };

/**
 * Save (or update) the clinician's reply on a response. Optionally
 * also flips the triage status to "resolved".
 */
export async function clinicianReply(args: {
  responseId: string;
  replyText: string;
  /** Couple id used for path revalidation. Optional; falls back to
   *  no-op when missing. */
  coupleId?: string;
  /** When true, also marks the row as resolved. Defaults to true
   *  because typing a reply usually means the clinician is closing
   *  the loop. */
  markResolved?: boolean;
}): Promise<ClinicianActionResult> {
  const session = await requireExpertOrFail();
  if (!session.ok) return { ok: false, reason: "unauthorized" };

  const responseId = String(args.responseId ?? "").trim();
  const replyText = String(args.replyText ?? "").trim();

  if (!responseId) return { ok: false, reason: "invalid_input", message: "missing responseId" };
  if (replyText.length < 1 || replyText.length > 4000) {
    return { ok: false, reason: "invalid_input", message: "replyText length out of range" };
  }

  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, reason: "db_error", message: "no service-role client" };

  const status: ClinicianStatus =
    args.markResolved === false ? "open" : "resolved";

  const { error } = await admin
    .from("journey_item_responses")
    .update({
      clinician_id: session.userId,
      clinician_reply_text: replyText,
      clinician_replied_at: new Date().toISOString(),
      clinician_status: status,
    })
    .eq("id", responseId);

  if (error) {
    console.error("[clinicianReply] update failed", {
      responseId,
      error: error.message,
      code: (error as { code?: string }).code ?? null,
    });
    return { ok: false, reason: "db_error", message: error.message };
  }

  if (args.coupleId) {
    revalidatePath(`/dashboard/my-clients/${args.coupleId}`);
  }
  return { ok: true };
}

/**
 * Triage-only - change the status without writing a reply. Useful
 * when the clinician marks a response as "concerning" to flag it
 * for follow-up later, or "resolved" because the response needs no
 * reply (e.g. a thank-you).
 */
export async function clinicianSetStatus(args: {
  responseId: string;
  status: ClinicianStatus;
  coupleId?: string;
}): Promise<ClinicianActionResult> {
  const session = await requireExpertOrFail();
  if (!session.ok) return { ok: false, reason: "unauthorized" };

  const responseId = String(args.responseId ?? "").trim();
  if (!responseId) return { ok: false, reason: "invalid_input", message: "missing responseId" };
  if (!["open", "resolved", "concerning"].includes(args.status)) {
    return { ok: false, reason: "invalid_input", message: "invalid status" };
  }

  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, reason: "db_error", message: "no service-role client" };

  const { error } = await admin
    .from("journey_item_responses")
    .update({
      clinician_status: args.status,
      clinician_id: session.userId,
    })
    .eq("id", responseId);

  if (error) {
    console.error("[clinicianSetStatus] update failed", {
      responseId,
      status: args.status,
      error: error.message,
    });
    return { ok: false, reason: "db_error", message: error.message };
  }

  if (args.coupleId) {
    revalidatePath(`/dashboard/my-clients/${args.coupleId}`);
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────

async function requireExpertOrFail(): Promise<
  { ok: true; userId: string } | { ok: false }
> {
  try {
    const session = await requireExpert();
    return { ok: true, userId: session.user.id };
  } catch {
    return { ok: false };
  }
}
