// ============================================================
// Threaded message reads + types - slice 6.
//
// journey_messages is the canonical store for all message bodies on
// per-item threads (scheduled_item_id NOT NULL) and the general
// expert channel (channel_user_id NOT NULL). The XOR is enforced
// by a CHECK constraint on the table.
//
// Server actions live in app/actions/journey-messages.ts; this
// module just owns reads + types + privacy filtering.
// ============================================================

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import {
  DEFAULT_COACH_SNAKE,
  snakePersonaWithFallback,
} from "@/lib/journey/default-coach";

export type AuthorKind = "user" | "expert";

/**
 * Layer 2 — coach persona attached to expert messages.
 * Resolved via the journey_messages.expert_signed_by FK + a JOIN onto
 * profiles. Null for user messages and for legacy expert messages
 * the migration backfill couldn't attribute.
 */
export interface CoachPersona {
  id:                string;
  display_name_he:   string | null;
  display_name_en:   string | null;
  avatar_url:        string | null;
  short_bio_he:      string | null;
  short_bio_en:      string | null;
}

export interface JourneyMessage {
  id: string;
  scheduled_item_id: string | null;
  channel_user_id: string | null;
  author_user_id: string | null;
  author_kind: AuthorKind;
  body: string;
  /** { ":heart:": ["uid-1","uid-2"], ":thumbsup:": [...] } */
  reactions: Record<string, string[]>;
  is_private: boolean;
  legacy_response_id: string | null;
  legacy_user_message_id: string | null;
  created_at: string;
  edited_at: string | null;
  /** Layer 2 — the coach who wrote this message. Always null for
   *  user messages; null for expert messages that predate the
   *  Layer-2 backfill. */
  expert_signed_by: string | null;
  /** Resolved persona for the expert_signed_by user. Same null
   *  semantics as above; non-null for current expert messages. */
  expert_persona: CoachPersona | null;
}

/**
 * Per-item thread fetch with private filtering applied for the given
 * viewer. Mirrors the rule from migration 035 §9 / journey_messages
 * RLS policy (kept in TS too because the admin service-role client
 * bypasses RLS and we still want partner-private rows hidden from
 * the partner).
 *
 * Returns messages ordered by created_at ascending so the UI can
 * render top-to-bottom without a sort step.
 */
export async function getPerItemThread(
  scheduledItemId: string,
  viewerUserId: string,
): Promise<JourneyMessage[]> {
  const admin = createServiceRoleClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("journey_messages")
    .select("*")
    .eq("scheduled_item_id", scheduledItemId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[messages.getPerItemThread]", error);
    return [];
  }
  const rows = ((data ?? []) as Array<JourneyMessage & { expert_signed_by: string | null }>)
    .filter((m) => (m.is_private ? m.author_user_id === viewerUserId : true));
  return await attachPersonas(admin, rows);
}

/**
 * General expert channel fetch. Per Itzik #7 these are partner-
 * private by default - the channel belongs to one user and only
 * that user + the expert pool sees it. We still apply a defensive
 * is_private filter (default true on the column) so a future
 * "shared with partner" toggle wouldn't accidentally leak.
 */
export async function getGeneralChannelThread(
  channelUserId: string,
  viewerUserId: string,
): Promise<JourneyMessage[]> {
  const admin = createServiceRoleClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("journey_messages")
    .select("*")
    .eq("channel_user_id", channelUserId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[messages.getGeneralChannelThread]", error);
    return [];
  }
  const rows = ((data ?? []) as Array<JourneyMessage & { expert_signed_by: string | null }>).filter(
    (m) =>
      // The channel owner sees everything in their channel.
      // Anyone else (this only matters when an expert is the viewer
      // - the RLS policy already prevents cross-user reads) sees
      // only non-private rows.
      channelUserId === viewerUserId ? true : !m.is_private,
  );
  return await attachPersonas(admin, rows);
}

/**
 * Admin/expert variant of getGeneralChannelThread - returns every
 * row in a channel WITHOUT the privacy filter. The user-facing
 * variant hides partner-private rows from non-owners; the admin
 * surface (per-couple workspace) needs to see everything the user
 * sent so the on-duty expert can respond. RLS still gates the
 * underlying read to admins via the service-role bypass.
 *
 * Used by GeneralChannelAdminReply on /dashboard/my-clients/[id].
 */
export async function getGeneralChannelThreadForAdmin(
  channelUserId: string,
): Promise<JourneyMessage[]> {
  const admin = createServiceRoleClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("journey_messages")
    .select("*")
    .eq("channel_user_id", channelUserId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[messages.getGeneralChannelThreadForAdmin]", error);
    return [];
  }
  return await attachPersonas(
    admin,
    (data ?? []) as Array<JourneyMessage & { expert_signed_by: string | null }>,
  );
}

/**
 * Resolve coach personas for a batch of messages. Single round-trip
 * lookup against profiles for every distinct expert_signed_by id in
 * the batch, then maps the persona onto each message. User messages
 * and unattributed expert messages get expert_persona=null.
 */
async function attachPersonas(
  admin: ReturnType<typeof createServiceRoleClient>,
  messages: Array<JourneyMessage & { expert_signed_by: string | null }>,
): Promise<JourneyMessage[]> {
  if (!admin || messages.length === 0) return messages;

  const ids = Array.from(
    new Set(
      messages
        .map((m) => m.expert_signed_by)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  if (ids.length === 0) {
    return messages.map((m) => ({ ...m, expert_persona: null }));
  }

  const { data: profiles, error } = await admin
    .from("profiles")
    .select(
      "id, coach_display_name_he, coach_display_name_en, coach_avatar_url, coach_short_bio_he, coach_short_bio_en",
    )
    .in("id", ids);

  if (error) {
    console.warn("[messages.attachPersonas] profile lookup failed", error);
    return messages.map((m) => ({ ...m, expert_persona: null }));
  }

  const personaById = new Map<string, CoachPersona>(
    ((profiles ?? []) as Array<{
      id: string;
      coach_display_name_he: string | null;
      coach_display_name_en: string | null;
      coach_avatar_url:      string | null;
      coach_short_bio_he:    string | null;
      coach_short_bio_en:    string | null;
    }>).map((p) => [
      p.id,
      // Fill missing fields with the Yitzhak default so coaches who
      // haven't filled their /dashboard/coach-profile yet still surface
      // with a name + face on every message.
      snakePersonaWithFallback(p.id, {
        coach_display_name_he: p.coach_display_name_he,
        coach_display_name_en: p.coach_display_name_en,
        coach_avatar_url:      p.coach_avatar_url,
        coach_short_bio_he:    p.coach_short_bio_he,
        coach_short_bio_en:    p.coach_short_bio_en,
      }),
    ]),
  );

  return messages.map((m) => ({
    ...m,
    // For expert messages whose signer doesn't resolve (legacy rows
    // pre-backfill, or expert_signed_by missing), fall back to the
    // shared Yitzhak default so the user UI always has a face.
    expert_persona: m.expert_signed_by
      ? personaById.get(m.expert_signed_by) ?? DEFAULT_COACH_SNAKE
      : null,
  }));
}

/**
 * Channel ensure helper - used by server actions (and the UI on
 * empty state) to make sure the user has a journey_user_channels
 * row before posting / fetching. Safe to call repeatedly.
 */
export async function ensureUserChannel(userId: string): Promise<void> {
  const admin = createServiceRoleClient();
  if (!admin) return;
  await admin
    .from("journey_user_channels")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
}
