"use server";

/**
 * app/dashboard/actions/drift-check-in.ts
 *
 * Layer-3 coach action: send a drift check-in to a couple.
 * Posts a coach-signed personal note to BOTH partners' general
 * channels and stamps coach_checked_in_at on the drift_alerts row.
 *
 * The user's drift banner (Layer 3.8) only surfaces AFTER this
 * stamp — automation never guilt-trips, the human does.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireExpert } from "@/lib/auth/expert";
import { createAdminClient } from "@/lib/supabase-admin";
import { recordCoachLibraryUse } from "@/app/dashboard/actions/coach-library";

const schema = z.object({
  coupleId:    z.string().uuid(),
  message:     z.string().trim().min(1, "message_required").max(2000),
  /** Optional: when the message came from a saved-reply library row. */
  libraryId:   z.string().uuid().optional().nullable(),
});

type Result =
  | { ok: true; postedTo: number }
  | { ok: false; error: string };

export async function sendDriftCheckIn(raw: unknown): Promise<Result> {
  const session = await requireExpert();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first ? first.message : "invalid_input" };
  }
  const { coupleId, message, libraryId } = parsed.data;

  const admin = await createAdminClient();

  // Access check (admins skip).
  if (!session.isAdmin) {
    const { data: link } = await admin
      .from("expert_couples")
      .select("id")
      .eq("couple_id", coupleId)
      .eq("expert_id", session.user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!link) return { ok: false, error: "not_assigned" };
  }

  // Resolve members.
  const { data: members } = await admin
    .from("couple_members")
    .select("user_id")
    .eq("couple_id", coupleId);
  const userIds = ((members ?? []) as Array<{ user_id: string }>).map(
    (m) => m.user_id,
  );
  if (userIds.length === 0) return { ok: false, error: "no_members" };

  // Post the same message to each partner's general channel.
  for (const uid of userIds) {
    await admin
      .from("journey_user_channels")
      .upsert(
        { user_id: uid },
        { onConflict: "user_id", ignoreDuplicates: true },
      );
    const { error: msgErr } = await admin.from("journey_messages").insert({
      channel_user_id:   uid,
      author_user_id:    session.user.id,
      author_kind:       "expert",
      expert_signed_by:  session.user.id,
      body:              message.trim(),
      is_private:        true,
    });
    if (msgErr) {
      console.error("[sendDriftCheckIn] message insert failed", msgErr);
    }
  }

  // Stamp the drift alert. Upsert handles "no row yet" case.
  const nowIso = new Date().toISOString();
  await admin.from("journey_drift_alerts").upsert(
    {
      couple_id:           coupleId,
      // The cron normally maintains state; on a manual check-in
      // we leave state untouched on conflict. coach_checked_in_*
      // are the fields this action owns.
      state:               "drifting",
      coach_checked_in_at: nowIso,
      coach_checked_in_by: session.user.id,
    },
    { onConflict: "couple_id" },
  );

  // If the coach inserted from /library, bump its use count so the
  // popular templates float to the top of their list.
  if (libraryId) {
    await recordCoachLibraryUse(libraryId).catch(() => {
      /* non-fatal */
    });
  }

  revalidatePath(`/dashboard/my-clients/${coupleId}`, "layout");
  revalidatePath("/dashboard/my-clients", "layout");
  // The user's banner pulls from the drift_alerts row.
  revalidatePath("/[locale]/my/journey", "layout");

  return { ok: true, postedTo: userIds.length };
}
