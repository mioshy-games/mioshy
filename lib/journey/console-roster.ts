import "server-only";

import { createServiceRoleClient } from "@/lib/supabase-admin";

/**
 * Persistent SOLO roster for the coach console.
 *
 * The MVP feed only surfaced solo users that had a *pending* message
 * (getPendingExpertMessages), so a solo conversation vanished the moment the
 * coach replied. This builds the durable solo population instead, so a
 * conversation is never lost:
 *
 *   • every solo journey SUBSCRIBER (v_user_directory.owns_journey) — shows up
 *     the instant they subscribe, even before they write a word.
 *   • every solo user who has EVER written a journey message — kept forever
 *     (their message history is the persistence), regardless of subscription.
 *
 * "Solo" = not a member of any couple (couples come from listExpertClients).
 * isSubscriber drives the feed's middle (subscribers) vs bottom (no-sub) bands.
 */

export interface SoloRosterEntry {
  userId: string;
  fullName: string | null;
  email: string | null;
  /** owns_journey — active journey subscription. */
  isSubscriber: boolean;
  /** Most recent message from/to this user across journey threads. ISO|null. */
  lastActivityAt: string | null;
}

export async function loadSoloRoster(): Promise<SoloRosterEntry[]> {
  const admin = createServiceRoleClient();
  if (!admin) return [];

  try {
    // 1. Last activity per message owner (newest-first scan; first hit wins).
    //    General-channel owner = channel_user_id; per-item owner = the user
    //    author (author_kind='user'); expert rows on per-item threads carry no
    //    owner here (the per-item lastActivity still updates via the user's own
    //    rows, which is what we sort on).
    const { data: msgs } = await admin
      .from("journey_messages")
      .select("channel_user_id, author_user_id, author_kind, created_at")
      .order("created_at", { ascending: false });

    const lastActivity = new Map<string, string>();
    for (const m of (msgs ?? []) as Array<{
      channel_user_id: string | null;
      author_user_id: string | null;
      author_kind: "user" | "expert";
      created_at: string;
    }>) {
      const owner =
        m.channel_user_id ??
        (m.author_kind === "user" ? m.author_user_id : null);
      if (owner && !lastActivity.has(owner)) lastActivity.set(owner, m.created_at);
    }
    const writerIds = Array.from(lastActivity.keys());

    // 2. Every coupled user (to exclude — couples render as couple rows).
    const { data: members } = await admin
      .from("couple_members")
      .select("user_id");
    const coupleUserIds = new Set(
      ((members ?? []) as Array<{ user_id: string }>).map((m) => m.user_id),
    );

    const soloWriterIds = writerIds.filter((id) => !coupleUserIds.has(id));

    // 3. Identity + subscription for the union of journey subscribers and solo
    //    writers, in one read. owns_journey=true pulls subscribers who may have
    //    no messages yet; the in-list pulls non-subscriber writers.
    let q = admin
      .from("v_user_directory")
      .select("user_id, full_name, email, owns_journey");
    if (soloWriterIds.length > 0) {
      q = q.or(
        `owns_journey.eq.true,user_id.in.(${soloWriterIds.join(",")})`,
      );
    } else {
      q = q.eq("owns_journey", true);
    }
    const { data: dir } = await q;

    const entries: SoloRosterEntry[] = [];
    for (const r of (dir ?? []) as Array<{
      user_id: string;
      full_name: string | null;
      email: string | null;
      owns_journey: boolean | null;
    }>) {
      if (coupleUserIds.has(r.user_id)) continue; // couples handled elsewhere
      entries.push({
        userId: r.user_id,
        fullName: r.full_name,
        email: r.email,
        isSubscriber: Boolean(r.owns_journey),
        lastActivityAt: lastActivity.get(r.user_id) ?? null,
      });
    }
    return entries;
  } catch {
    return [];
  }
}
