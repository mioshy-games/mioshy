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
 *
 * The same scan also yields `coupleHistory`: every couple that has ANY user
 * message, even if it has no journey allocation (so it isn't in
 * listExpertClients). Without this an unallocated couple's conversation
 * disappeared the moment the coach replied — the couple-side twin of the solo
 * persistence problem above. The feed folds these in so a couple conversation
 * is likewise never lost.
 */

export interface SoloRosterEntry {
  userId: string;
  fullName: string | null;
  email: string | null;
  /** profiles.phone ?? mobile (via v_user_directory). For console search. */
  phone: string | null;
  /** owns_journey — active journey subscription. */
  isSubscriber: boolean;
  /** Most recent message from/to this user across journey threads. ISO|null. */
  lastActivityAt: string | null;
}

export interface ConsoleRoster {
  solo: SoloRosterEntry[];
  /** coupleId → last user-message activity (ISO) for every couple that has
   *  any message history, allocated or not. Persists quiet/unallocated
   *  couples in the feed. */
  coupleHistory: Map<string, string>;
}

export async function loadSoloRoster(): Promise<ConsoleRoster> {
  const admin = createServiceRoleClient();
  if (!admin) return { solo: [], coupleHistory: new Map() };

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

    // 2. Every coupled user → their couple. Coupled users are excluded from the
    //    solo roster (they render as couple rows); the user→couple map also lets
    //    us attribute message history to a couple below.
    const { data: members } = await admin
      .from("couple_members")
      .select("user_id, couple_id");
    const coupleByUser = new Map<string, string>(
      ((members ?? []) as Array<{ user_id: string; couple_id: string }>).map(
        (m) => [m.user_id, m.couple_id],
      ),
    );
    const coupleUserIds = new Set(coupleByUser.keys());

    const soloWriterIds = writerIds.filter((id) => !coupleUserIds.has(id));

    // 2b. Couples with message history (writer is a couple member). lastActivity
    //     is keyed by message owner; fold those into a per-couple last-activity.
    const coupleHistory = new Map<string, string>();
    for (const [userId, at] of lastActivity.entries()) {
      const coupleId = coupleByUser.get(userId);
      if (!coupleId) continue;
      const prev = coupleHistory.get(coupleId);
      if (!prev || at > prev) coupleHistory.set(coupleId, at);
    }

    // 3. Identity + subscription for the union of journey subscribers and solo
    //    writers. This used to be ONE read with
    //    `.or(owns_journey.eq.true,user_id.in.(<all writers>))`, but that put
    //    every writer UUID into the request URL — at production scale the URL
    //    blows past PostgREST's length limit (→ 414, the whole query fails and
    //    the catch returns []) and even a successful read is silently capped at
    //    1000 rows. Either way the entire no-sub band — and any solo user who
    //    was already replied to, e.g. שולי — vanishes from the console.
    //
    //    Instead: pull subscribers with a plain equality filter, and pull
    //    writers in bounded `.in(...)` chunks. Merge by user_id (a subscriber
    //    who also wrote appears once). Each read is range-capped so we never
    //    rely on the implicit 1000-row default.
    type DirRow = {
      user_id: string;
      full_name: string | null;
      email: string | null;
      phone: string | null;
      owns_journey: boolean | null;
    };
    const dirByUser = new Map<string, DirRow>();
    const SELECT = "user_id, full_name, email, phone, owns_journey";

    // 3a. Subscribers (owns_journey=true), regardless of message history.
    const { data: subs } = await admin
      .from("v_user_directory")
      .select(SELECT)
      .eq("owns_journey", true)
      .range(0, 9999);
    for (const r of (subs ?? []) as DirRow[]) dirByUser.set(r.user_id, r);

    // 3b. Solo writers (non-subscriber writers fill in here), chunked so the
    //     request URL stays well within limits no matter how many there are.
    const CHUNK = 200;
    for (let i = 0; i < soloWriterIds.length; i += CHUNK) {
      const chunk = soloWriterIds.slice(i, i + CHUNK);
      const { data: writers } = await admin
        .from("v_user_directory")
        .select(SELECT)
        .in("user_id", chunk);
      for (const r of (writers ?? []) as DirRow[]) {
        if (!dirByUser.has(r.user_id)) dirByUser.set(r.user_id, r);
      }
    }

    const entries: SoloRosterEntry[] = [];
    for (const r of dirByUser.values()) {
      if (coupleUserIds.has(r.user_id)) continue; // couples handled elsewhere
      entries.push({
        userId: r.user_id,
        fullName: r.full_name,
        email: r.email,
        phone: r.phone ?? null,
        isSubscriber: Boolean(r.owns_journey),
        lastActivityAt: lastActivity.get(r.user_id) ?? null,
      });
    }
    return { solo: entries, coupleHistory };
  } catch {
    return { solo: [], coupleHistory: new Map() };
  }
}
