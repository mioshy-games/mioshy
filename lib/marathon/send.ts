import "server-only";

import { createServiceRoleClient } from "@/lib/supabase-admin";
import { normalizePhoneForWhatsApp } from "@/lib/whatsapp/phone";
import { sendTemplate } from "@/lib/whatsapp/client";
import {
  marathonDayTemplate,
  marathonWelcomeTemplate,
} from "@/lib/whatsapp/templates";

/**
 * Marathon WhatsApp sends. Marathon leads are NOT registered users — they have
 * a phone on the `leads` row, no profile — so we can't use the profile-based
 * sendWhatsAppToUser. We send the approved template straight to the phone via
 * sendTemplate and log to whatsapp_messages (recipient_user_id stays null).
 *
 * Every marathon message is proactive (outside the 24h window), so it is always
 * a template — no free-text path here. Never throws.
 */

export type MarathonSendResult = {
  ok: boolean;
  waMessageId?: string;
  reason?: string;
};

async function logOutbound(args: {
  phone: string;
  templateName: string;
  ok: boolean;
  waMessageId?: string;
  error?: unknown;
}): Promise<void> {
  const admin = createServiceRoleClient();
  if (!admin) return;
  await admin
    .from("whatsapp_messages")
    .insert({
      recipient_user_id: null,
      to_phone: args.phone,
      direction: "outbound",
      template_name: args.templateName,
      category: "utility",
      wa_message_id: args.waMessageId ?? null,
      status: args.ok ? "sent" : "failed",
      error: args.ok ? null : { detail: args.error ?? "send_failed" },
      payload: { surface: "marathon" },
    })
    .then(() => undefined, () => undefined);
}

export async function sendMarathonDay(args: {
  phone: string;
  day: number;
  domain: string;
  activity: string;
  language: string;
}): Promise<MarathonSendResult> {
  const to = normalizePhoneForWhatsApp(args.phone);
  if (!to) return { ok: false, reason: "no-valid-phone" };

  const tpl = marathonDayTemplate({
    day: args.day,
    domain: args.domain,
    activity: args.activity,
    languageCode: args.language === "en" ? "en" : "he",
  });
  const result = await sendTemplate({
    to,
    templateName: tpl.templateName,
    languageCode: tpl.languageCode,
    components: tpl.components,
  });

  await logOutbound({
    phone: to,
    templateName: tpl.templateName,
    ok: result.ok,
    waMessageId: result.ok ? result.waMessageId : undefined,
    error: result.ok ? undefined : result.message,
  });

  return result.ok
    ? { ok: true, waMessageId: result.waMessageId }
    : { ok: false, reason: result.message };
}

export async function sendMarathonWelcome(args: {
  phone: string;
  language: string;
}): Promise<MarathonSendResult> {
  const to = normalizePhoneForWhatsApp(args.phone);
  if (!to) return { ok: false, reason: "no-valid-phone" };

  const tpl = marathonWelcomeTemplate({
    languageCode: args.language === "en" ? "en" : "he",
  });
  const result = await sendTemplate({
    to,
    templateName: tpl.templateName,
    languageCode: tpl.languageCode,
    components: tpl.components,
  });

  await logOutbound({
    phone: to,
    templateName: tpl.templateName,
    ok: result.ok,
    waMessageId: result.ok ? result.waMessageId : undefined,
    error: result.ok ? undefined : result.message,
  });

  return result.ok
    ? { ok: true, waMessageId: result.waMessageId }
    : { ok: false, reason: result.message };
}
