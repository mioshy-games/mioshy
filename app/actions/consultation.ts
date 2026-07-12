"use server";

/**
 * Consultation-call actions (Stage 2). Called by ConsultationCallButton when the
 * Calendly popup fires `calendly.event_scheduled`. Records a lead in
 * consultation_requests and mirrors the Meta Schedule event to the Conversions
 * API with the SAME eventId the browser Pixel used (dedup). Never throws.
 */

import { cookies, headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendMetaCapiEvent } from "@/lib/analytics/meta-capi";

export async function recordConsultationScheduled(args: {
  source: string;
  eventId: string;
  calendlyInviteeUri?: string | null;
}): Promise<{ ok: boolean }> {
  const source =
    typeof args?.source === "string" && args.source.trim()
      ? args.source.trim().slice(0, 80)
      : "assessment_results";
  const eventId = typeof args?.eventId === "string" ? args.eventId.slice(0, 120) : "";
  const inviteeUri =
    typeof args?.calendlyInviteeUri === "string" && args.calendlyInviteeUri.startsWith("https://")
      ? args.calendlyInviteeUri.slice(0, 500)
      : null;

  // Who scheduled — the results page is post-auth, so the session user is the
  // lead. Anonymous is tolerated (user_id/email left null).
  let userId: string | null = null;
  let email: string | null = null;
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
    email = user?.email ?? null;
  } catch {
    /* anon */
  }

  const admin = createAdminSupabaseClient();

  // Lead row (fire-and-forget — a tracking hiccup must not surface to the user).
  try {
    await admin.from("consultation_requests").insert({
      user_id: userId,
      email,
      source,
      calendly_invitee_uri: inviteeUri,
    });
  } catch (err) {
    console.error("[consultation] insert failed", err);
  }

  // CAPI Schedule — same eventId as the Pixel for dedup.
  try {
    const jar = await cookies();
    const hdrs = await headers();
    await sendMetaCapiEvent({
      eventName: "Schedule",
      eventId,
      userData: {
        email,
        externalId: userId,
        fbp: jar.get("_fbp")?.value ?? null,
        fbc: jar.get("_fbc")?.value ?? null,
        clientIpAddress: (hdrs.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
        clientUserAgent: hdrs.get("user-agent") ?? null,
      },
      customData: { source, content_name: "consultation_call" },
    });
  } catch (err) {
    console.error("[consultation] CAPI failed", err);
  }

  return { ok: true };
}
