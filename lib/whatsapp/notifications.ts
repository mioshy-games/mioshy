/**
 * High-level WhatsApp send helper.
 *
 * Resolves the user's mobile + opt-in state via the admin client, sends the
 * template, logs the attempt to whatsapp_messages, and tells the caller whether
 * to fall back to email. NEVER throws — best-effort, like the email path.
 */

import { createServiceRoleClient } from "@/lib/supabase-admin";
import { normalizePhoneForWhatsApp } from "./phone";
import { sendTemplate, sendText } from "./client";
import type { TemplateSend } from "./templates";

const WINDOW_MS = 24 * 60 * 60 * 1000;

export type WhatsAppSendOutcome = {
  sent: boolean;
  /** true when the caller should send the email instead (no phone / no opt-in / failed). */
  fellBackToEmail: boolean;
  reason?: string;
  waMessageId?: string;
  /** What actually went out, once sent. */
  mode?: "text" | "template";
};

type ProfileRow = {
  mobile: string | null;
  whatsapp_opt_in: boolean | null;
  whatsapp_opt_out_at: string | null;
  whatsapp_last_inbound_at: string | null;
};

/**
 * Send a pre-approved template to a user by id. Returns whether it was sent and
 * whether the caller should fall back to email. Kept for callers that always
 * want a template regardless of window (reminders, invites).
 */
export async function sendWhatsAppToUser(
  args: { userId: string } & TemplateSend
): Promise<WhatsAppSendOutcome> {
  return sendWhatsAppMessage({ userId: args.userId, template: args });
}

/**
 * Window-aware send. Resolves consent + phone + the 24h service window, then:
 *   • window OPEN  → sends `freeText` as a free-text message (if provided),
 *   • window CLOSED (or no freeText) → sends the approved `template`.
 * Falls back to email when there's no phone / no opt-in / nothing valid to send
 * / the send fails. Logs every attempt to whatsapp_messages. NEVER throws.
 */
export async function sendWhatsAppMessage(args: {
  userId: string;
  freeText?: string;
  template?: TemplateSend;
}): Promise<WhatsAppSendOutcome> {
  const admin = createServiceRoleClient();
  if (!admin) return fallback("admin-client-unavailable");

  // 1) Resolve consent + phone + window.
  const { data, error } = await admin
    .from("profiles")
    .select("mobile, whatsapp_opt_in, whatsapp_opt_out_at, whatsapp_last_inbound_at")
    .eq("id", args.userId)
    .maybeSingle<ProfileRow>();

  if (error || !data) return fallback("profile-not-found");
  if (!data.whatsapp_opt_in || data.whatsapp_opt_out_at) return fallback("no-opt-in");

  const phone = normalizePhoneForWhatsApp(data.mobile);
  if (!phone) return fallback("no-valid-phone");

  const windowOpen = data.whatsapp_last_inbound_at
    ? Date.now() - new Date(data.whatsapp_last_inbound_at).getTime() < WINDOW_MS
    : false;

  // 2) Decide what to send. Free text only inside the window; otherwise the
  //    approved template. If neither is available for the current state, fall
  //    back to email rather than sending something WhatsApp would reject.
  const freeText = args.freeText?.trim();
  const useText = windowOpen && !!freeText;
  if (!useText && !args.template) return fallback("no-template-for-closed-window");

  const result = useText
    ? await sendText({ to: phone, body: freeText! })
    : await sendTemplate({
        to: phone,
        templateName: args.template!.templateName,
        languageCode: args.template!.languageCode,
        components: args.template!.components,
      });

  // 3) Log (best-effort).
  await admin
    .from("whatsapp_messages")
    .insert({
      recipient_user_id: args.userId,
      to_phone: phone,
      direction: "outbound",
      template_name: useText ? null : args.template!.templateName,
      category: useText ? "service" : args.template!.category,
      wa_message_id: result.ok ? result.waMessageId : null,
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : { status: result.status, code: result.errorCode, message: result.message },
      payload: useText
        ? { body: freeText }
        : { components: args.template!.components },
    })
    .then(
      () => undefined,
      () => undefined // swallow log errors
    );

  if (!result.ok) return fallback(`send-failed:${result.message}`);

  return {
    sent: true,
    fellBackToEmail: false,
    waMessageId: result.waMessageId,
    mode: useText ? "text" : "template",
  };
}

function fallback(reason: string): WhatsAppSendOutcome {
  return { sent: false, fellBackToEmail: true, reason };
}
