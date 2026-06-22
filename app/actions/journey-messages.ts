"use server";

// ============================================================
// Server actions for the v3 threaded messaging surface (slice 6).
//
// Two surfaces, one storage table (journey_messages):
//   - per-item threads (scheduled_item_id NOT NULL)
//   - general expert channel (channel_user_id NOT NULL)
//
// Dual-write contract for the slice 6 transitional period:
//   * User per-item posts → journey_messages + journey_item_responses
//   * Expert replies to items → journey_messages + update legacy
//     journey_item_responses.clinician_reply_text on the latest user
//     response so the existing clinician inbox stays in sync.
//   * User channel posts → journey_messages + journey_user_messages
//   * Expert channel replies → journey_messages only (no legacy
//     equivalent - the channel's expert-reply path is brand new).
//
// Side effects:
//   * The first user message in a per-item thread stamps
//     scheduled_items.responded_at = now() so the cadence engine's
//     auto-skip rule keys correctly.
//   * Each post triggers a notification (in-app log + email) via
//     lib/journey-content/notifications.ts.
//
// Auth model:
//   * User actions go through resolveViewer() (session client →
//     identity, admin client for writes).
//   * Expert actions go through requireExpert() - same pattern as
//     the existing clinicianReply server action.
// ============================================================

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireExpert } from "@/lib/auth/expert";
import { ensureUserChannel } from "@/lib/journey-content/messages";
import { makeLogger } from "@/lib/observability/log";

// 2026-05-31 — scoped logger for the four server actions in this file.
// Every action emits `start` + `viewer.ok|viewer.fail` + per-step rows
// + `done` (with ok=true|false). Pattern: filter Vercel logs by
// `scope=shell.action.chat` to see the whole conversation pipeline.
const log = makeLogger("shell.action.chat");
import {
  notifyExpertPool,
  notifyUser,
} from "@/lib/journey-content/notifications";
import { sendWhatsAppMessage } from "@/lib/whatsapp/notifications";
import { coachNudgeTemplate } from "@/lib/whatsapp/templates";
import { logActivity } from "@/lib/journey/activity";
import { classifyAndStampMessage } from "@/lib/ai/classify-message";
import type {
  JourneyAssignment,
  JourneyScheduledItem,
} from "@/lib/journey-content/types";

const MESSAGE_MAX_LEN = 4000;

type Ok<T extends Record<string, unknown> = Record<string, never>> = {
  ok: true;
} & T;
type Err = { ok: false; error: string };

// ------------------------------------------------------------
// Shared helpers (mirrored from journey-content-user.ts so this
// file stays standalone and the dual-write paths can be deleted in
// one shot when the legacy tables retire).
// ------------------------------------------------------------

// 2026-06-01 — Itzik: chat sending should NOT require the full
// profile (mobile + password + name). Sending a message to your
// assigned expert is a private communication — the expert team can
// follow up via the in-app channel itself. The full-profile gate
// remains in place for pair / redeem / purchase / play, where the
// expert team genuinely needs phone + email to act on the request.
//
// New rule: just verify the visitor is logged in. The userId is the
// only identity downstream code consumes.
async function resolveViewer(): Promise<
  { ok: true; userId: string; coupleIds: string[] } | Err
> {
  const session = await createServerSupabaseClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return { ok: false, error: "login_required" };
  const { data: memberships, error } = await session
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  const coupleIds = (memberships ?? [])
    .map((m) => m.couple_id as string)
    .filter(Boolean);
  return { ok: true, userId: user.id, coupleIds };
}

async function loadScheduledForViewer(args: {
  scheduledItemId: string;
  userId: string;
  coupleIds: string[];
}): Promise<
  | { ok: true; scheduled: JourneyScheduledItem; assignment: JourneyAssignment }
  | Err
> {
  const admin = await createAdminClient();
  const { data: scheduledRow, error: sErr } = await admin
    .from("journey_scheduled_items")
    .select("*")
    .eq("id", args.scheduledItemId)
    .maybeSingle();
  if (sErr) return { ok: false, error: sErr.message };
  if (!scheduledRow) return { ok: false, error: "not_found" };
  const scheduled = scheduledRow as JourneyScheduledItem;

  const { data: assignmentRow, error: aErr } = await admin
    .from("journey_assignments")
    .select("*")
    .eq("id", scheduled.assignment_id)
    .maybeSingle();
  if (aErr) return { ok: false, error: aErr.message };
  if (!assignmentRow) return { ok: false, error: "not_found" };
  const assignment = assignmentRow as JourneyAssignment;
  if (!assignment.is_active) return { ok: false, error: "assignment_inactive" };

  const ownedByMe =
    (assignment.user_id && assignment.user_id === args.userId) ||
    (assignment.couple_id && args.coupleIds.includes(assignment.couple_id));
  if (!ownedByMe) return { ok: false, error: "forbidden" };

  return { ok: true, scheduled, assignment };
}

function isUnlocked(scheduled: JourneyScheduledItem, now = new Date()): boolean {
  const unlock = new Date(scheduled.unlock_at).getTime();
  if (!Number.isFinite(unlock)) return false;
  return unlock <= now.getTime();
}

function revalidateMessageSurfaces() {
  revalidatePath("/[locale]/journey/timeline", "layout");
  revalidatePath("/[locale]/my/journey", "page");
  revalidatePath("/[locale]/dashboard", "layout");
}

function previewBody(body: string): string {
  const trimmed = body.trim().replace(/\s+/g, " ");
  return trimmed.length > 140 ? `${trimmed.slice(0, 140)}…` : trimmed;
}

// ============================================================
// User → per-item thread
// ============================================================

export async function postPerItemMessage(args: {
  scheduledItemId: string;
  body: string;
  /** v3 default: per-item threads are partner-visible (false). */
  isPrivate?: boolean;
}): Promise<Ok<{ messageId: string }> | Err> {
  const t0 = Date.now();
  log.info("item.send.start", {
    scheduled_id: args.scheduledItemId,
    body_len: (args.body ?? "").trim().length,
    private: !!args.isPrivate,
  });

  if (!args.scheduledItemId) {
    log.warn("item.send.rejected", { reason: "missing_id" });
    return { ok: false, error: "missing_id" };
  }
  const trimmed = (args.body ?? "").trim();
  if (trimmed.length === 0) {
    log.warn("item.send.rejected", {
      scheduled_id: args.scheduledItemId,
      reason: "empty_body",
    });
    return { ok: false, error: "empty_body" };
  }
  if (trimmed.length > MESSAGE_MAX_LEN) {
    log.warn("item.send.rejected", {
      scheduled_id: args.scheduledItemId,
      reason: "body_too_long",
      body_len: trimmed.length,
    });
    return { ok: false, error: "body_too_long" };
  }

  const viewer = await resolveViewer();
  if (!viewer.ok) {
    log.error("item.send.viewer_failed", {
      scheduled_id: args.scheduledItemId,
      reason: viewer.error,
    });
    return viewer;
  }

  const scope = await loadScheduledForViewer({
    scheduledItemId: args.scheduledItemId,
    userId: viewer.userId,
    coupleIds: viewer.coupleIds,
  });
  if (!scope.ok) {
    log.error("item.send.scope_failed", {
      scheduled_id: args.scheduledItemId,
      user_id: viewer.userId,
      reason: scope.error,
    });
    return scope;
  }
  if (!isUnlocked(scope.scheduled)) {
    log.warn("item.send.locked", {
      scheduled_id: args.scheduledItemId,
      user_id: viewer.userId,
      unlock_at: scope.scheduled.unlock_at,
    });
    return { ok: false, error: "locked" };
  }

  const admin = await createAdminClient();
  const isPrivate = !!args.isPrivate;

  // Step 1 - write the legacy row first. The clinician inbox queries
  // pivot on journey_item_responses; if this insert fails we don't
  // want to leak a journey_messages row that's invisible to the inbox.
  const { data: legacyRow, error: legacyErr } = await admin
    .from("journey_item_responses")
    .insert({
      scheduled_item_id: args.scheduledItemId,
      user_id: viewer.userId,
      response_text: trimmed,
      is_private: isPrivate,
    })
    .select("id")
    .single();
  if (legacyErr || !legacyRow) {
    return {
      ok: false,
      error: legacyErr?.message ?? "legacy_insert_failed",
    };
  }
  const legacyResponseId = legacyRow.id as string;

  // Step 2 - write the canonical journey_messages row, linked back.
  const { data: msgRow, error: msgErr } = await admin
    .from("journey_messages")
    .insert({
      scheduled_item_id: args.scheduledItemId,
      author_user_id: viewer.userId,
      author_kind: "user",
      body: trimmed,
      is_private: isPrivate,
      legacy_response_id: legacyResponseId,
    })
    .select("id")
    .single();
  if (msgErr || !msgRow) {
    // The legacy row is already in - log and continue. The inbox sees
    // the post; the new thread UI just won't show this one until the
    // back-fill runs again.
    console.error("[postPerItemMessage] journey_messages insert failed", msgErr);
    return { ok: false, error: msgErr?.message ?? "messages_insert_failed" };
  }

  // Step 3 - stamp scheduled_items.responded_at on the FIRST user
  // post in this thread. Cadence engine's auto-skip rule keys on this.
  if (!scope.scheduled.responded_at) {
    await admin
      .from("journey_scheduled_items")
      .update({ responded_at: new Date().toISOString() })
      .eq("id", args.scheduledItemId)
      .is("responded_at", null);
  }

  // Step 4 - activity log + notification (best effort).
  await logActivity({
    userId: viewer.userId,
    coupleId: scope.assignment.couple_id ?? null,
    scheduledItemId: args.scheduledItemId,
    verb: "response_posted",
    payload: { is_private: isPrivate, message_id: msgRow.id },
  });

  await notifyExpertPool({
    kind: "item_message_user_posted",
    subject: "Mioshy: a user posted on a journey item",
    payload: {
      preview: previewBody(trimmed),
      context_label: `scheduled_item_id=${args.scheduledItemId}`,
      href: `/dashboard/my-clients/${scope.assignment.couple_id ?? viewer.userId}`,
    },
  });

  // Phase 4 — fire-and-forget AI classification. Failures don't
  // block the user's response — the message is already persisted.
  void classifyAndStampMessage({
    table: "journey_messages",
    messageId: msgRow.id as string,
    body: trimmed,
  });

  revalidateMessageSurfaces();
  log.info("item.send.done", {
    scheduled_id: args.scheduledItemId,
    user_id: viewer.userId,
    message_id: String(msgRow.id),
    dur_ms: Date.now() - t0,
  });
  return { ok: true, messageId: msgRow.id as string };
}

// ============================================================
// Expert → per-item thread
// ============================================================

export async function postExpertReplyToItem(args: {
  scheduledItemId: string;
  body: string;
  /** Optional: when the body came from a saved library row, pass its
   *  id so we can stamp tags onto the message for admin tracking. */
  libraryId?: string | null;
}): Promise<Ok<{ messageId: string }> | Err> {
  if (!args.scheduledItemId) return { ok: false, error: "missing_id" };
  const trimmed = (args.body ?? "").trim();
  if (trimmed.length === 0) return { ok: false, error: "empty_body" };
  if (trimmed.length > MESSAGE_MAX_LEN) {
    return { ok: false, error: "body_too_long" };
  }

  const expert = await requireExpertOrFail();
  if (!expert.ok) return { ok: false, error: "unauthorized" };

  const admin = await createAdminClient();

  // Layer-3 admin tracker — pull tags from the library row if any.
  let topicTags: string[] = [];
  if (args.libraryId) {
    const { data: libRow } = await admin
      .from("journey_expert_library")
      .select("tags")
      .eq("id", args.libraryId)
      .maybeSingle();
    const tags = (libRow as { tags: string[] | null } | null)?.tags;
    if (Array.isArray(tags)) topicTags = tags;
  }

  // Find the latest user response on this scheduled_item - that's the
  // "ticket" the legacy clinician inbox tracks. We mirror the reply
  // there so dashboards keep working.
  const { data: latestUserResponse } = await admin
    .from("journey_item_responses")
    .select("id, user_id, scheduled_item_id")
    .eq("scheduled_item_id", args.scheduledItemId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Also need the assignment so we know who the recipient is.
  const { data: schedRow } = await admin
    .from("journey_scheduled_items")
    .select("id, assignment_id")
    .eq("id", args.scheduledItemId)
    .maybeSingle();
  if (!schedRow) return { ok: false, error: "not_found" };
  const { data: assignRow } = await admin
    .from("journey_assignments")
    .select("user_id, couple_id")
    .eq("id", schedRow.assignment_id as string)
    .maybeSingle();
  if (!assignRow) return { ok: false, error: "not_found" };

  // Step 1 - insert the canonical expert message.
  const { data: msgRow, error: msgErr } = await admin
    .from("journey_messages")
    .insert({
      scheduled_item_id: args.scheduledItemId,
      author_user_id: expert.userId,
      author_kind: "expert",
      // Layer 2 — stamp the specific coach so the user sees their
      // persona on the reply (not generic "מיאושי").
      expert_signed_by: expert.userId,
      body: trimmed,
      // Expert replies on per-item are partner-visible by default
      // (matches the historical clinician_reply_text behaviour).
      is_private: false,
      legacy_response_id: latestUserResponse?.id ?? null,
      topic_tags: topicTags,
    })
    .select("id")
    .single();
  if (msgErr || !msgRow) {
    return {
      ok: false,
      error: msgErr?.message ?? "messages_insert_failed",
    };
  }

  // Step 2 - mirror to the legacy clinician_reply_text on the latest
  // user response so the existing clinician inbox shows the reply.
  // Skipped when there's no user response yet (shouldn't happen via
  // the UI but the engine could push a "broadcast" reply later).
  if (latestUserResponse?.id) {
    await admin
      .from("journey_item_responses")
      .update({
        clinician_id: expert.userId,
        clinician_reply_text: trimmed,
        clinician_replied_at: new Date().toISOString(),
        clinician_status: "resolved",
      })
      .eq("id", latestUserResponse.id);
  }

  // Step 3 - notify the user. For couple-owned legacy assignments we
  // notify both partners; for cadence (user-owned) we notify just
  // the partner who owns the cadence row.
  const recipients: string[] = [];
  if (assignRow.user_id) recipients.push(assignRow.user_id as string);
  if (assignRow.couple_id) {
    const { data: members } = await admin
      .from("couple_members")
      .select("user_id")
      .eq("couple_id", assignRow.couple_id as string);
    for (const m of (members ?? []) as Array<{ user_id: string }>) {
      if (!recipients.includes(m.user_id)) recipients.push(m.user_id);
    }
  }
  for (const uid of recipients) {
    await notifyUser({
      recipientUserId: uid,
      kind: "item_message_expert_replied",
      subject: "Mioshy: an expert replied on your item",
      payload: {
        preview: previewBody(trimmed),
        href: `/he/journey/timeline/${args.scheduledItemId}`,
      },
    });
  }

  revalidateMessageSurfaces();
  return { ok: true, messageId: msgRow.id as string };
}

// ============================================================
// User → general expert channel
// ============================================================

export async function postGeneralChannelMessage(args: {
  body: string;
}): Promise<Ok<{ messageId: string }> | Err> {
  const t0 = Date.now();
  const trimmed = (args.body ?? "").trim();
  log.info("channel.send.start", { body_len: trimmed.length });

  if (trimmed.length === 0) {
    log.warn("channel.send.rejected", { reason: "empty_body" });
    return { ok: false, error: "empty_body" };
  }
  if (trimmed.length > MESSAGE_MAX_LEN) {
    log.warn("channel.send.rejected", {
      reason: "body_too_long",
      body_len: trimmed.length,
      max: MESSAGE_MAX_LEN,
    });
    return { ok: false, error: "body_too_long" };
  }

  const viewer = await resolveViewer();
  if (!viewer.ok) {
    // The MOST common cause of "the send button does nothing" — the
    // viewer hits a profile/login gate before any DB write. Surface it
    // in logs so Itzik can spot it from Vercel without UI debugging.
    log.error("channel.send.viewer_failed", { reason: viewer.error });
    return viewer;
  }
  log.info("channel.send.viewer_ok", {
    user_id: viewer.userId,
    couple_count: viewer.coupleIds.length,
  });

  try {
    await ensureUserChannel(viewer.userId);
  } catch (err) {
    log.error("channel.send.ensure_channel_failed", {
      user_id: viewer.userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: "ensure_channel_failed" };
  }

  const admin = await createAdminClient();
  const coupleId = viewer.coupleIds[0] ?? null;

  // Step 1 — legacy table mirror.
  const { data: legacyRow, error: legacyErr } = await admin
    .from("journey_user_messages")
    .insert({
      user_id: viewer.userId,
      couple_id: coupleId,
      message_text: trimmed,
    })
    .select("id")
    .single();
  if (legacyErr || !legacyRow) {
    log.error("channel.send.legacy_insert_failed", {
      user_id: viewer.userId,
      reason: legacyErr?.message ?? "no_row_returned",
    });
    return {
      ok: false,
      error: legacyErr?.message ?? "legacy_insert_failed",
    };
  }

  // Step 2 — canonical journey_messages row.
  const { data: msgRow, error: msgErr } = await admin
    .from("journey_messages")
    .insert({
      channel_user_id: viewer.userId,
      author_user_id: viewer.userId,
      author_kind: "user",
      body: trimmed,
      is_private: true,
      legacy_user_message_id: legacyRow.id as string,
    })
    .select("id")
    .single();
  if (msgErr || !msgRow) {
    log.error("channel.send.canonical_insert_failed", {
      user_id: viewer.userId,
      legacy_id: String(legacyRow.id),
      reason: msgErr?.message ?? "no_row_returned",
    });
    return { ok: false, error: msgErr?.message ?? "messages_insert_failed" };
  }

  await notifyExpertPool({
    kind: "channel_message_user_posted",
    subject: "Mioshy: a user posted to the general channel",
    payload: {
      preview: previewBody(trimmed),
      context_label: `user_id=${viewer.userId}`,
      href: `/dashboard/my-clients/${coupleId ?? viewer.userId}`,
    },
  });

  void classifyAndStampMessage({
    table: "journey_messages",
    messageId: msgRow.id as string,
    body: trimmed,
  });

  revalidateMessageSurfaces();
  log.info("channel.send.done", {
    user_id: viewer.userId,
    message_id: String(msgRow.id),
    dur_ms: Date.now() - t0,
  });
  return { ok: true, messageId: msgRow.id as string };
}

// ============================================================
// Expert → general expert channel
// ============================================================

export async function postExpertReplyToChannel(args: {
  channelUserId: string;
  body: string;
  libraryId?: string | null;
  /** Delivery channel. Default email = zero regression. WhatsApp is admin-only. */
  channel?: "email" | "whatsapp" | "both";
}): Promise<Ok<{ messageId: string }> | Err> {
  if (!args.channelUserId) return { ok: false, error: "missing_id" };
  const trimmed = (args.body ?? "").trim();
  if (trimmed.length === 0) return { ok: false, error: "empty_body" };
  if (trimmed.length > MESSAGE_MAX_LEN) {
    return { ok: false, error: "body_too_long" };
  }

  const expert = await requireExpertOrFail();
  if (!expert.ok) return { ok: false, error: "unauthorized" };

  await ensureUserChannel(args.channelUserId);

  const admin = await createAdminClient();

  // Layer-3 admin tracker — pull tags from library row if any.
  let topicTags: string[] = [];
  if (args.libraryId) {
    const { data: libRow } = await admin
      .from("journey_expert_library")
      .select("tags")
      .eq("id", args.libraryId)
      .maybeSingle();
    const tags = (libRow as { tags: string[] | null } | null)?.tags;
    if (Array.isArray(tags)) topicTags = tags;
  }

  const { data: msgRow, error: msgErr } = await admin
    .from("journey_messages")
    .insert({
      channel_user_id: args.channelUserId,
      author_user_id: expert.userId,
      author_kind: "expert",
      // Layer 2 — coach signature so the user sees the named expert
      // who replied, not the generic "מיאושי".
      expert_signed_by: expert.userId,
      body: trimmed,
      // Channel is solo by definition - expert reply visible only to
      // the channel owner (and the expert pool / admin).
      is_private: true,
      topic_tags: topicTags,
    })
    .select("id")
    .single();
  if (msgErr || !msgRow) {
    return { ok: false, error: msgErr?.message ?? "messages_insert_failed" };
  }

  await notifyUser({
    recipientUserId: args.channelUserId,
    kind: "channel_message_expert_replied",
    subject: "Mioshy: an expert replied in your channel",
    payload: {
      preview: previewBody(trimmed),
      href: `/he/my/journey`,
    },
  });

  // WhatsApp delivery (additive, admin-only). Best-effort — never blocks or
  // fails the action; the in-app message + email above are unaffected. Free
  // text inside the 24h window, else the coach_nudge template (WA layer picks).
  const channel = args.channel ?? "email";
  if (channel === "whatsapp" || channel === "both") {
    try {
      const { data: prof } = await admin
        .from("profiles")
        .select("role")
        .eq("id", expert.userId)
        .maybeSingle();
      if ((prof as { role: string } | null)?.role === "admin") {
        await sendUserChannelWhatsApp(admin, {
          userId: args.channelUserId,
          body: trimmed,
          adminId: expert.userId,
        });
      }
    } catch (err) {
      console.warn("[postExpertReplyToChannel] whatsapp send failed (non-fatal)", err);
    }
  }

  revalidateMessageSurfaces();
  return { ok: true, messageId: msgRow.id as string };
}

/**
 * Send a single-recipient channel message over WhatsApp and record a
 * unified-history row in sent_messages. sendWhatsAppMessage resolves opt-in /
 * phone / 24h window and picks free text vs the coach_nudge template, logging
 * to whatsapp_messages. Unreachable users (no opt-in / no phone) are skipped —
 * they still got the in-app message + email. Best-effort.
 */
async function sendUserChannelWhatsApp(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  args: { userId: string; body: string; adminId: string },
): Promise<void> {
  const { data: prof } = await admin
    .from("profiles")
    .select("full_name, mobile")
    .eq("id", args.userId)
    .maybeSingle();
  const name = (prof as { full_name: string | null } | null)?.full_name?.trim() || "";
  const mobile = (prof as { mobile: string | null } | null)?.mobile ?? "";
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://mioshy.com").replace(/\/$/, "");
  const conversationUrl = `${base}/he/my/journey`;

  const outcome = await sendWhatsAppMessage({
    userId: args.userId,
    freeText: args.body,
    template: coachNudgeTemplate({ name, conversationUrl }),
  });

  const attempted = outcome.sent || outcome.reason?.startsWith("send-failed");
  if (!attempted) return;

  await admin
    .from("sent_messages")
    .insert({
      user_id: args.userId,
      channel: "whatsapp",
      body: args.body,
      to_address: mobile,
      sent_by: "admin",
      sent_by_admin: args.adminId,
      provider_id: outcome.waMessageId ?? null,
      status: outcome.sent ? "sent" : "failed",
    })
    .then(() => undefined, () => undefined);
}

// ============================================================
// Reactions
// ============================================================

const ALLOWED_EMOJIS = new Set([
  ":heart:",
  ":thumbsup:",
  ":thinking:",
  ":sparkles:",
  ":pray:",
]);

export async function toggleReaction(args: {
  messageId: string;
  emoji: string;
}): Promise<
  Ok<{ reactions: Record<string, string[]> }> | Err
> {
  if (!args.messageId) return { ok: false, error: "missing_id" };
  if (!ALLOWED_EMOJIS.has(args.emoji)) {
    return { ok: false, error: "invalid_emoji" };
  }
  const viewer = await resolveViewer();
  if (!viewer.ok) return viewer;

  const admin = await createAdminClient();
  const { data: msg, error: rErr } = await admin
    .from("journey_messages")
    .select("id, reactions")
    .eq("id", args.messageId)
    .maybeSingle();
  if (rErr) return { ok: false, error: rErr.message };
  if (!msg) return { ok: false, error: "not_found" };

  const current = (msg.reactions as Record<string, string[]> | null) ?? {};
  const list = Array.isArray(current[args.emoji]) ? [...current[args.emoji]] : [];
  const idx = list.indexOf(viewer.userId);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.push(viewer.userId);
  }
  const next: Record<string, string[]> = { ...current };
  if (list.length === 0) {
    delete next[args.emoji];
  } else {
    next[args.emoji] = list;
  }

  const { error: updErr } = await admin
    .from("journey_messages")
    .update({ reactions: next })
    .eq("id", args.messageId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidateMessageSurfaces();
  return { ok: true, reactions: next };
}

// ------------------------------------------------------------

async function requireExpertOrFail(): Promise<
  { ok: true; userId: string } | { ok: false }
> {
  try {
    const session = await requireExpert();
    return { ok: true, userId: session.user.id };
  } catch {
    return { ok: false };
  }
}
