"use server";

/**
 * lib/journey-content/user-messages.ts
 *
 * Server actions + queries for the user→clinician message channel
 * (JourneyExpertMessage component). Phase 4 wiring.
 *
 * Two surfaces:
 *   - submitExpertMessage(text)        - user-side, RLS-aware insert
 *   - listClinicianMessagesForUsers()  - admin-side, service-role bulk
 *
 * Tone of API: never throws to the caller. Return typed result.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { getCurrentCoupleContext } from "@/lib/between-us/couples";
import { computeMessageTags } from "@/lib/dashboard/auto-tag";

export type UserMessageStatus = "open" | "resolved" | "concerning" | null;

export type SubmitMessageResult =
  | { ok: true; messageId: string }
  | { ok: false; reason: "unauthenticated" | "invalid_input" | "db_error"; message?: string };

export interface UserMessageRow {
  id: string;
  userId: string;
  userEmail: string | null;
  coupleId: string | null;
  messageText: string;
  clinicianStatus: UserMessageStatus;
  createdAt: string;
}

const MAX_LEN = 4000;

// ─────────────────────────────────────────────────────────────────────
// User → server: submit a message
// ─────────────────────────────────────────────────────────────────────

export async function submitExpertMessage(args: {
  text: string;
}): Promise<SubmitMessageResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "unauthenticated" };

  const text = String(args.text ?? "").trim();
  if (text.length < 1 || text.length > MAX_LEN) {
    return {
      ok: false,
      reason: "invalid_input",
      message: `text must be 1..${MAX_LEN} characters`,
    };
  }

  // Resolve couple context (optional) so the admin Inbox can group
  // messages per couple.
  let coupleId: string | null = null;
  try {
    const ctx = await getCurrentCoupleContext();
    coupleId = ctx?.couple_id ?? null;
  } catch {
    coupleId = null;
  }

  const tags = computeMessageTags({ text });

  const { data, error } = await supabase
    .from("journey_user_messages")
    .insert({
      user_id: user.id,
      couple_id: coupleId,
      message_text: text,
      tags,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[submitExpertMessage] insert failed", {
      user_id: user.id,
      code: (error as { code?: string }).code,
      message: error.message,
    });
    return { ok: false, reason: "db_error", message: error.message };
  }

  return { ok: true, messageId: String(data.id) };
}

// ─────────────────────────────────────────────────────────────────────
// Admin → server: list messages for a list of users (a couple's two
// partners). Used by /dashboard/my-clients/[coupleId].
// ─────────────────────────────────────────────────────────────────────

export async function listClinicianUserMessages(args: {
  userIds: string[];
  limit?: number;
}): Promise<UserMessageRow[]> {
  const limit = Math.max(1, Math.min(args.limit ?? 50, 200));
  if (args.userIds.length === 0) return [];

  const admin = createServiceRoleClient();
  if (!admin) {
    console.error("[listClinicianUserMessages] no service-role client");
    return [];
  }

  const { data, error } = await admin
    .from("journey_user_messages")
    .select("id, user_id, couple_id, message_text, clinician_status, created_at")
    .in("user_id", args.userIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[listClinicianUserMessages] fetch failed", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    userEmail: null, // emails aren't trivially fetchable; admin labels by partner index
    coupleId: row.couple_id ? String(row.couple_id) : null,
    messageText: String(row.message_text),
    clinicianStatus: (row.clinician_status as UserMessageStatus) ?? null,
    createdAt: String(row.created_at),
  }));
}
