// ============================================================
// Threaded message reads + types — slice 6.
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

export type AuthorKind = "user" | "expert";

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
  return ((data ?? []) as JourneyMessage[]).filter((m) =>
    m.is_private ? m.author_user_id === viewerUserId : true,
  );
}

/**
 * General expert channel fetch. Per Itzik #7 these are partner-
 * private by default — the channel belongs to one user and only
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
  return ((data ?? []) as JourneyMessage[]).filter(
    (m) =>
      // The channel owner sees everything in their channel.
      // Anyone else (this only matters when an expert is the viewer
      // — the RLS policy already prevents cross-user reads) sees
      // only non-private rows.
      channelUserId === viewerUserId ? true : !m.is_private,
  );
}

/**
 * Admin/expert variant of getGeneralChannelThread — returns every
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
  return (data ?? []) as JourneyMessage[];
}

/**
 * Channel ensure helper — used by server actions (and the UI on
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
