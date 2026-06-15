/**
 * High-level WhatsApp send helper.
 *
 * Resolves the user's mobile + opt-in state via the admin client, sends the
 * template, logs the attempt to whatsapp_messages, and tells the caller whether
 * to fall back to email. NEVER throws — best-effort, like the email path.
 */

import { createServiceRoleClient } from "@/lib/supabase-admin";
import { normalizePhoneForWhatsApp } from "./phone";
import { sendTemplate } from "./client";
import type { TemplateSend } from "./templates";

export type WhatsAppSendOutcome = {
  sent: boolean;
  /** true when the caller should send the email instead (no phone / no opt-in / failed). */
  fellBackToEmail: boolean;
  reason?: string;
  waMessageId?: string;
};

type ProfileRow = {
  mobile: string | null;
  whatsapp_opt_in: boolean | null;
  whatsapp_opt_out_at: string | null;
};

/**
 * Send a template to a user by id. Returns whether it was sent and whether the
 * caller should fall back to email.
 */
export async function sendWhatsAppToUser(
  args: { userId: string } & TemplateSend
): Promise<WhatsAppSendOutcome> {
  const admin = createServiceRoleClient();
  if (!admin) return fallback("admin-client-unavailable");

  // 1) Resolve consent + phone.
  const { data, error } = await admin
    .from("profiles")
    .select("mobile, whatsapp_opt_in, whatsapp_opt_out_at")
    .eq("id", args.userId)
    .maybeSingle<ProfileRow>();

  if (error || !data) return fallback("profile-not-found");
  if (!data.whatsapp_opt_in || data.whatsapp_opt_out_at) return fallback("no-opt-in");

  const phone = normalizePhoneForWhatsApp(data.mobile);
  if (!phone) return fallback("no-valid-phone");

  // 2) Send.
  const result = await sendTemplate({
    to: phone,
    templateName: args.templateName,
    languageCode: args.languageCode,
    components: args.components,
  });

  // 3) Log (best-effort).
  await admin
    .from("whatsapp_messages")
    .insert({
      recipient_user_id: args.userId,
      to_phone: phone,
      direction: "outbound",
      template_name: args.templateName,
      category: args.category,
      wa_message_id: result.ok ? result.waMessageId : null,
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : { status: result.status, code: (result as any).errorCode, message: result.message },
      payload: { components: args.components },
    })
    .then(
      () => undefined,
      () => undefined // swallow log errors
    );

  if (!result.ok) return fallback(`send-failed:${result.message}`);

  return { sent: true, fellBackToEmail: false, waMessageId: result.waMessageId };
}

function fallback(reason: string): WhatsAppSendOutcome {
  return { sent: false, fellBackToEmail: true, reason };
}
