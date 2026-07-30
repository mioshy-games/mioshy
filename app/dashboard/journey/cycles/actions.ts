"use server";

// ============================================================
// Admin intervention tools for the five-track cycle model (spec §5).
//
//   openCycleAction        — open the next cycle for a user by hand
//   resetCompletionAction  — undo a "we did this" mark
//
// Both are thin wrappers over the SAME engine the user-facing flow uses, so
// the admin can never produce a state the product cannot produce (§5: "the
// admin logic must be identical to what the user gets, otherwise we are back
// to two sources of truth").
// ============================================================

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import {
  openCycleForUser,
  resetCycleItemCompletion,
} from "@/lib/journey-content/cycle-engine";

export type CycleActionResult = { ok: true; message: string } | { ok: false; error: string };

function revalidate(userId?: string) {
  revalidatePath("/dashboard/journey/cycles", "layout");
  if (userId) revalidatePath(`/dashboard/journey/cycles/${userId}`, "layout");
}

/**
 * Open the next cycle for a user.
 *
 * `force` bypasses the eligibility gate. Use it knowingly: the gate is what
 * keeps a PAUSED customer's content waiting instead of burning, because the
 * one-month clock starts the moment a cycle opens. Forcing a cycle open for
 * someone on a break spends their month while they are away.
 */
export async function openCycleAction(
  userId: string,
  force = false,
): Promise<CycleActionResult> {
  await requireAdmin();
  const result = await openCycleForUser(userId, { force });
  revalidate(userId);

  if (result.ok) {
    return {
      ok: true,
      message: `נפתח מחזור ${result.cycleNumber} עם ${result.itemCount} פרקים`,
    };
  }
  return { ok: false, error: reasonToHebrew(result.reason) };
}

export async function resetCompletionAction(
  cycleItemId: string,
  userId: string,
): Promise<CycleActionResult> {
  await requireAdmin();
  const result = await resetCycleItemCompletion(cycleItemId);
  revalidate(userId);
  return result.ok
    ? { ok: true, message: "הסימון בוטל" }
    : { ok: false, error: reasonToHebrew(result.reason) };
}

/** The engine speaks in machine reasons; the admin screen should not. */
function reasonToHebrew(reason?: string): string {
  switch (reason) {
    case "already_open":
      return "כבר יש מחזור פתוח למשתמש הזה";
    case "manually_paused":
      return "המשתמש בהשהיה — פתיחה עכשיו תשרוף לו את החודש. אפשר לכפות, אבל דעו מה אתם עושים";
    case "in_grace":
      return "המנוי בתקופת חסד (חיוב שלא עבר) — אין זכאות לתוכן חדש";
    case "blocked":
      return "המנוי חסום";
    case "no_journey_subscription":
      return "אין מנוי journey פעיל";
    case "no_priorities":
      return "אין דירוג קטגוריות למשתמש";
    case "no_content_left":
      return "נגמר התוכן — אין פרקים שהמשתמש עוד לא קיבל";
    case "cycle_already_closed":
      return "המחזור כבר נסגר, אי אפשר לבטל סימון בדיעבד";
    case "not_found":
      return "לא נמצא";
    default:
      return reason ?? "שגיאה לא ידועה";
  }
}
