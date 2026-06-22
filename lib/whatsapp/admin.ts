import "server-only";

import { createServiceRoleClient } from "@/lib/supabase-admin";
import { normalizePhoneForWhatsApp } from "./phone";
import { getWhatsAppConfig } from "./client";

/**
 * Admin-side WhatsApp read helpers. Centralises the 24h service-window
 * calculation and the "can we message this user" eligibility check so the
 * client card, the compose gating, and the send action all agree.
 *
 * All reads use the service-role client — whatsapp_messages is RLS-locked to
 * service_role, and the admin routes that call these are already gated by
 * requireAdmin().
 */

/** 24h service window, in milliseconds. */
export const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

export type WhatsAppRecipientState = {
  userId: string;
  /** Raw stored mobile (free text), or null. */
  mobile: string | null;
  /** Normalised digits-only phone, or null if it can't be normalised. */
  normalizedPhone: string | null;
  optIn: boolean;
  optedOut: boolean;
  optInAt: string | null;
  lastInboundAt: string | null;
  /** Inbound within the last 24h → free text allowed; else template only. */
  windowOpen: boolean;
  /** Eligible to receive a WhatsApp at all: valid phone, opted in, not opted out. */
  eligible: boolean;
};

/** True when WhatsApp env is configured (so callers can hide the option pre-launch). */
export function isWhatsAppConfigured(): boolean {
  return getWhatsAppConfig() !== null;
}

type ProfileWaRow = {
  mobile: string | null;
  whatsapp_opt_in: boolean | null;
  whatsapp_opt_out_at: string | null;
  whatsapp_opt_in_at: string | null;
  whatsapp_last_inbound_at: string | null;
};

function deriveState(userId: string, row: ProfileWaRow | null): WhatsAppRecipientState {
  const mobile = row?.mobile ?? null;
  const normalizedPhone = normalizePhoneForWhatsApp(mobile);
  const optIn = !!row?.whatsapp_opt_in;
  const optedOut = !!row?.whatsapp_opt_out_at;
  const lastInboundAt = row?.whatsapp_last_inbound_at ?? null;
  const windowOpen = lastInboundAt
    ? Date.now() - new Date(lastInboundAt).getTime() < WHATSAPP_WINDOW_MS
    : false;
  return {
    userId,
    mobile,
    normalizedPhone,
    optIn,
    optedOut,
    optInAt: row?.whatsapp_opt_in_at ?? null,
    lastInboundAt,
    windowOpen,
    eligible: !!normalizedPhone && optIn && !optedOut,
  };
}

/** Resolve WhatsApp state for a single user. Never throws. */
export async function getWhatsAppRecipientState(
  userId: string,
): Promise<WhatsAppRecipientState> {
  const admin = createServiceRoleClient();
  if (!admin) return deriveState(userId, null);
  const { data } = await admin
    .from("profiles")
    .select(
      "mobile, whatsapp_opt_in, whatsapp_opt_out_at, whatsapp_opt_in_at, whatsapp_last_inbound_at",
    )
    .eq("id", userId)
    .maybeSingle<ProfileWaRow>();
  return deriveState(userId, data ?? null);
}

/** Resolve WhatsApp state for several users at once. */
export async function getWhatsAppRecipientStates(
  userIds: string[],
): Promise<Map<string, WhatsAppRecipientState>> {
  const out = new Map<string, WhatsAppRecipientState>();
  if (userIds.length === 0) return out;
  const admin = createServiceRoleClient();
  if (!admin) {
    for (const id of userIds) out.set(id, deriveState(id, null));
    return out;
  }
  const { data } = await admin
    .from("profiles")
    .select(
      "id, mobile, whatsapp_opt_in, whatsapp_opt_out_at, whatsapp_opt_in_at, whatsapp_last_inbound_at",
    )
    .in("id", userIds);
  const byId = new Map<string, ProfileWaRow>();
  for (const r of (data ?? []) as Array<ProfileWaRow & { id: string }>) {
    byId.set(r.id, r);
  }
  for (const id of userIds) out.set(id, deriveState(id, byId.get(id) ?? null));
  return out;
}

export type WhatsAppLogRow = {
  id: string;
  direction: "outbound" | "inbound";
  status: string;
  template_name: string | null;
  created_at: string;
  payload: { body?: string; text?: string } | null;
};

/** Last N whatsapp_messages for a user, newest first. Never throws. */
export async function listRecentWhatsAppMessages(
  userId: string,
  limit = 5,
): Promise<WhatsAppLogRow[]> {
  const admin = createServiceRoleClient();
  if (!admin) return [];
  const { data } = await admin
    .from("whatsapp_messages")
    .select("id, direction, status, template_name, created_at, payload")
    .eq("recipient_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as WhatsAppLogRow[];
}
