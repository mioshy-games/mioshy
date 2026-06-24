import "server-only";

import { createServiceRoleClient } from "@/lib/supabase-admin";
import { israelDate, addDays } from "./schedule";
import { sendMarathonWelcome } from "./send";

/**
 * Enroll a marathon lead. Day 1 is the NEXT Israel calendar day (signup does
 * NOT send content immediately — only the welcome). Idempotent: a phone with an
 * active enrollment is left as-is. The welcome template is sent best-effort
 * (no-ops gracefully until WhatsApp is configured + the template is approved).
 * Never throws — enrollment must never break the lead-capture response.
 */
export async function enrollLeadInMarathon(args: {
  leadId: string | null;
  phone: string;
  language?: string;
}): Promise<{ enrolled: boolean; reason?: string }> {
  const admin = createServiceRoleClient();
  if (!admin) return { enrolled: false, reason: "admin-unavailable" };

  const phone = args.phone.trim();
  if (!phone) return { enrolled: false, reason: "no-phone" };
  const language = args.language === "en" ? "en" : "he";

  try {
    // Already enrolled (active)? No-op.
    const { data: existing } = await admin
      .from("marathon_enrollments")
      .select("id")
      .eq("phone", phone)
      .eq("status", "active")
      .maybeSingle();
    if (existing) return { enrolled: false, reason: "already-active" };

    const startedOn = addDays(israelDate(), 1); // day 1 = tomorrow (Israel)

    const { data: created, error } = await admin
      .from("marathon_enrollments")
      .insert({
        lead_id: args.leadId,
        phone,
        language,
        started_on: startedOn,
        status: "active",
      })
      .select("id")
      .single();

    // Unique partial index can race two concurrent signups → treat as enrolled.
    if (error || !created) return { enrolled: false, reason: error?.message ?? "insert-failed" };

    const enrollmentId = (created as { id: string }).id;

    // Welcome (best-effort). Stamp only on a real send.
    const welcome = await sendMarathonWelcome({ phone, language });
    if (welcome.ok) {
      await admin
        .from("marathon_enrollments")
        .update({ welcome_sent_at: new Date().toISOString() })
        .eq("id", enrollmentId)
        .then(() => undefined, () => undefined);
    }

    return { enrolled: true };
  } catch (err) {
    console.warn("[marathon.enroll] failed (non-fatal)", err);
    return { enrolled: false, reason: "threw" };
  }
}
