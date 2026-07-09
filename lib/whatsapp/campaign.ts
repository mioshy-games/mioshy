/**
 * Gated campaign sender for the automated WhatsApp flows (coach_welcome,
 * intro_price_expiry_reminder). Wraps the low-level client with the launch
 * safety rails, in this order:
 *
 *   1. WHATSAPP_MODE — off (nothing), allowlist (send only to WHATSAPP_ALLOWLIST,
 *      journal every other eligible recipient as "would_send"), live (send all).
 *   2. opt-in + valid mobile (consent is mandatory).
 *   3. idempotency — one (template_name, user) send ever (counts would_send too).
 *   4. throttle — at most ONE outbound WhatsApp per user per 7 days.
 *
 * Every outcome is journalled to whatsapp_messages (the log). NEVER throws.
 *
 * The two "iron rules" that are contextual (purchaser ↔ reminder, non-purchaser
 * ↔ coach, purchase stops everything) are enforced by the CALLERS at trigger
 * time; this layer enforces mode + consent + idempotency + throttle.
 */

import { createServiceRoleClient } from "@/lib/supabase-admin";
import { normalizePhoneForWhatsApp } from "./phone";
import { sendTemplate } from "./client";
import { throttlePassed } from "./rules";
import type { TemplateSend } from "./templates";

export type WhatsAppMode = "off" | "allowlist" | "live";

export function getWhatsAppMode(): WhatsAppMode {
  const m = (process.env.WHATSAPP_MODE || "off").trim().toLowerCase();
  return m === "live" ? "live" : m === "allowlist" ? "allowlist" : "off";
}

/** Normalised phone allowlist for `allowlist` mode. */
export function getAllowlist(): Set<string> {
  const raw = process.env.WHATSAPP_ALLOWLIST || "";
  const nums = raw
    .split(/[,\s]+/)
    .map((p) => normalizePhoneForWhatsApp(p))
    .filter((p): p is string => Boolean(p));
  return new Set(nums);
}

/** Mode + allowlist decision for an already-normalised phone. */
export function modeAllows(phone: string): { allowed: boolean; reason: string } {
  const mode = getWhatsAppMode();
  if (mode === "off") return { allowed: false, reason: "mode_off" };
  if (mode === "live") return { allowed: true, reason: "live" };
  return getAllowlist().has(phone)
    ? { allowed: true, reason: "allowlist_match" }
    : { allowed: false, reason: "allowlist_skip" };
}

export type CampaignOutcome = {
  status: "sent" | "would_send" | "skipped" | "failed";
  reason?: string;
  waMessageId?: string;
};

type ProfileRow = {
  mobile: string | null;
  whatsapp_opt_in: boolean | null;
  whatsapp_opt_out_at: string | null;
};

type Admin = NonNullable<ReturnType<typeof createServiceRoleClient>>;

async function journal(
  admin: Admin,
  args: { userId: string; template: TemplateSend },
  phone: string | null,
  status: CampaignOutcome["status"],
  reason?: string,
  waMessageId?: string,
): Promise<void> {
  await admin
    .from("whatsapp_messages")
    .insert({
      recipient_user_id: args.userId,
      to_phone: phone,
      direction: "outbound",
      template_name: args.template.templateName,
      category: args.template.category,
      wa_message_id: waMessageId ?? null,
      status,
      error: reason ? { reason } : null,
    })
    .then(
      () => undefined,
      () => undefined,
    );
}

/**
 * Send one campaign template to a user through all the safety rails.
 * `throttle: false` opts a specific flow out of the 1/week cap (default on).
 */
export async function sendCampaignMessage(args: {
  userId: string;
  template: TemplateSend;
  throttle?: boolean;
}): Promise<CampaignOutcome> {
  // Feature fully off: run nothing, journal nothing.
  if (getWhatsAppMode() === "off") return { status: "skipped", reason: "mode_off" };

  const admin = createServiceRoleClient();
  if (!admin) return { status: "skipped", reason: "no-admin-client" };

  const { data: prof } = await admin
    .from("profiles")
    .select("mobile, whatsapp_opt_in, whatsapp_opt_out_at")
    .eq("id", args.userId)
    .maybeSingle<ProfileRow>();

  if (!prof) return { status: "skipped", reason: "profile-not-found" };
  if (!prof.whatsapp_opt_in || prof.whatsapp_opt_out_at) {
    await journal(admin, args, null, "skipped", "no-opt-in");
    return { status: "skipped", reason: "no-opt-in" };
  }
  const phone = normalizePhoneForWhatsApp(prof.mobile);
  if (!phone) {
    await journal(admin, args, null, "skipped", "no-valid-phone");
    return { status: "skipped", reason: "no-valid-phone" };
  }

  // Idempotency: one (template, user) ever — counts would_send too.
  const { count: dup } = await admin
    .from("whatsapp_messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", args.userId)
    .eq("template_name", args.template.templateName)
    .eq("direction", "outbound")
    .in("status", ["queued", "sent", "delivered", "read", "would_send"]);
  if ((dup ?? 0) > 0) return { status: "skipped", reason: "already-sent" };

  // Throttle: ≤1 outbound (or would_send) per user per 7 days.
  if (args.throttle !== false) {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { count: recent } = await admin
      .from("whatsapp_messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_user_id", args.userId)
      .eq("direction", "outbound")
      .in("status", ["sent", "delivered", "read", "would_send"])
      .gte("created_at", since);
    if (!throttlePassed(recent ?? 0)) {
      await journal(admin, args, phone, "skipped", "throttled-1-per-week");
      return { status: "skipped", reason: "throttled-1-per-week" };
    }
  }

  // Mode gate: allowlist/off recipients are journalled, not messaged.
  const dec = modeAllows(phone);
  if (!dec.allowed) {
    await journal(admin, args, phone, "would_send", dec.reason);
    return { status: "would_send", reason: dec.reason };
  }

  // Live send.
  const result = await sendTemplate({
    to: phone,
    templateName: args.template.templateName,
    languageCode: args.template.languageCode,
    components: args.template.components,
  });
  if (result.ok) {
    await journal(admin, args, phone, "sent", undefined, result.waMessageId);
    return { status: "sent", waMessageId: result.waMessageId };
  }
  await journal(admin, args, phone, "failed", result.message);
  return { status: "failed", reason: result.message };
}
