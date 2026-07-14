import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isTestUser } from "@/lib/auth/is-test-user";
import { tagAsRegistered } from "@/lib/email/brevo-segments-sync";
import { fireCompleteRegistrationCapi } from "@/lib/analytics/meta-capi";

type JourneyRow = { id: string; current_step: number | null; status: string; last_activity_at: string | null };

const isCompleteStatus = (s: string) => s === "complete" || s === "completed";
const tsOf = (r: { last_activity_at: string | null }) => (r.last_activity_at ? new Date(r.last_activity_at).getTime() : 0);

/**
 * All the journey post-auth work — profile + consent writes (signup only),
 * deterministic anon-journey claiming (both signup & login), and the
 * registered marker + CompleteRegistration (signup + new user). Ported verbatim
 * from journey-inline-signup.ts so the OTP path and the (legacy) password path
 * behave identically. The `debug` envelope of the old action is dropped.
 *
 * Phone is deferred under OTP (collected in a later step) — passed as null.
 */
export async function finalizeJourneySignup(args: {
  userId: string;
  email: string;
  deviceId: string;
  fullName: string;
  phone?: string | null;
  marketingConsent: boolean;
  whatsappOptIn: boolean;
  termsAccepted: boolean;
  language?: "he" | "en";
  isSignup: boolean;
  isNewUser: boolean;
}): Promise<{ journey: JourneyRow | null }> {
  const admin = createAdminSupabaseClient();
  const { userId, email, deviceId } = args;
  const nowIso = new Date().toISOString();

  // ── Profile + consent (signup only) ──────────────────────────────────────
  if (args.isSignup) {
    const { error: profileErr } = await admin.from("profiles").upsert({
      id: userId,
      full_name: args.fullName.trim(),
      phone: args.phone || null,
      marketing_consent: args.marketingConsent,
      marketing_consent_at: args.marketingConsent ? nowIso : null,
      marketing_consent_source: "journey_inline",
      whatsapp_opt_in: args.whatsappOptIn,
      whatsapp_opt_in_at: args.whatsappOptIn ? nowIso : null,
      whatsapp_opt_in_source: "journey_inline",
    }, { onConflict: "id" });
    if (profileErr) console.warn("[finalizeJourneySignup] profile upsert failed (non-fatal)", profileErr.message);

    const { error: termsErr } = await admin.from("profiles")
      .update({ terms_accepted: args.termsAccepted, terms_accepted_at: args.termsAccepted ? nowIso : null }).eq("id", userId);
    if (termsErr) console.warn("[finalizeJourneySignup] terms columns write failed (non-fatal)", termsErr.message);

    if (args.marketingConsent && !(await isTestUser(admin, userId))) {
      try { await tagAsRegistered(email, userId, args.language ?? "he"); } catch (e) { console.error("[finalizeJourneySignup] Brevo sync failed", e); }
    }
  }

  // ── Claim anon journeys deterministically (both signup & login) ───────────
  const { data: anonRows, error: listErr } = await admin.from("journeys")
    .select("id, status, last_activity_at, current_step")
    .eq("device_id", deviceId).is("user_id", null)
    .order("last_activity_at", { ascending: false });
  if (listErr) {
    console.error("[finalizeJourneySignup] claim list failed", listErr);
  } else {
    const rows = (anonRows ?? []) as JourneyRow[];
    const completes = rows.filter((r) => isCompleteStatus(r.status));
    const actives = rows.filter((r) => !isCompleteStatus(r.status));
    const bestActive = actives.slice().sort((a, b) => {
      const stepDiff = (b.current_step ?? 0) - (a.current_step ?? 0);
      return stepDiff !== 0 ? stepDiff : tsOf(b) - tsOf(a);
    })[0] ?? null;

    // 1. All terminal rows together (outside the active unique index).
    if (completes.length > 0) {
      const { error } = await admin.from("journeys").update({ user_id: userId, last_activity_at: nowIso }).in("id", completes.map((r) => r.id));
      if (error) console.error("[finalizeJourneySignup] claim complete rows failed", error);
    }
    // 2. At most ONE active row (index-conflict tolerated).
    if (bestActive) {
      const { error } = await admin.from("journeys").update({ user_id: userId, last_activity_at: nowIso }).eq("id", bestActive.id);
      if (error) console.warn("[finalizeJourneySignup] claim active row failed (tolerated)", { id: bestActive.id, error: error.message });
    }
  }

  // ── Resolve the journey the client jumps to (complete → step → recency) ───
  const { data: candidateJourneys } = await admin.from("journeys")
    .select("id, current_step, status, last_activity_at").eq("user_id", userId);
  const journey = (candidateJourneys ?? []).slice().sort((a, b) => {
    const aC = isCompleteStatus(a.status) ? 1 : 0;
    const bC = isCompleteStatus(b.status) ? 1 : 0;
    if (aC !== bC) return bC - aC;
    const stepDiff = (b.current_step ?? 0) - (a.current_step ?? 0);
    if (stepDiff !== 0) return stepDiff;
    return tsOf(b) - tsOf(a);
  })[0] ?? null;

  // ── Registered marker + CompleteRegistration (signup + new user) ──────────
  if (args.isSignup) {
    const { error: markerErr } = await admin.from("analytics_events").insert({
      event: "journey_assessment_registered", session_id: null, device_id: deviceId,
      user_id: userId, locale: args.language ?? null, properties: { assessment_id: "journey" },
    });
    if (markerErr) console.warn("[finalizeJourneySignup] registered marker insert failed (non-fatal)", markerErr.message);
    if (args.isNewUser) await fireCompleteRegistrationCapi({ userId, email, contentName: "journey" });
  }

  return { journey: (journey ?? null) as JourneyRow | null };
}
