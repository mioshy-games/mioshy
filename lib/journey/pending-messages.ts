/**
 * Pending-message inbox helpers for the admin / expert dashboard.
 *
 * "Pending" = a general-channel thread whose LATEST message was sent by
 * the user (i.e. the expert hasn't replied yet). We don't track an
 * explicit `read_at` per message; the "latest writer" heuristic is the
 * cheapest reliable signal and matches the way the expert already works
 * (open the thread → read everything → reply once).
 *
 * Used by:
 *   • `/dashboard` overview card ("Pending user messages")
 *   • `/dashboard/coaching/sidebar` badge (count only)
 *
 * Added 2026-06-01 (Itzik: "smart UX for experts handling messages").
 */

import "server-only";

import { createServiceRoleClient } from "@/lib/supabase-admin";

export interface PendingMessageRow {
  /** journey_user_channels.user_id — the message owner. Drives every
   *  downstream link target (we use it to look up coupleId for the
   *  /dashboard/my-clients/[coupleId] URL). */
  userId: string;
  /** When the user last wrote. ISO. */
  lastUserMessageAt: string;
  /** Last body (clipped at 140 chars by the consumer). */
  lastBody: string;
  /** Full name when present, falls back to email local-part, then to
   *  a short uid suffix. Never null — so the row always has SOMETHING
   *  to render. */
  displayName: string;
  /** Email — for the secondary line under the name. May be null. */
  email: string | null;
  /** Couple membership when present — drives the deep-link target.
   *  Solo users link to /dashboard/my-clients/[userId] (TBD route) for
   *  now we just link to the journey-expert-messages page filtered. */
  coupleId: string | null;
  /** Total user-side message count in this channel (helps the expert
   *  see a "this person writes a lot" signal at a glance). */
  totalUserMessages: number;
}

export interface PendingMessagesResult {
  rows: PendingMessageRow[];
  /** Same as rows.length, but exposed so callers (badge) can read the
   *  number without pulling the array. */
  count: number;
  /** Whether the fetch hit an error and degraded. Callers can decide
   *  whether to render an "inbox temporarily unavailable" hint. */
  ok: boolean;
}

const HARD_CAP = 50;

export async function getPendingExpertMessages(opts: {
  /** Cap on rows returned. Default 50. The sidebar badge passes 999 to
   *  get a true count; the overview card passes 8 for the visible list. */
  limit?: number;
} = {}): Promise<PendingMessagesResult> {
  const limit = Math.min(opts.limit ?? HARD_CAP, HARD_CAP);
  try {
    const admin = createServiceRoleClient();
    if (!admin) return { rows: [], count: 0, ok: false };

    // 1. Pull every general-channel message into memory. The table is
    //    write-light and we only need 4 columns. Once volume crosses a
    //    threshold this should move to a Postgres view/RPC; for the
    //    Mioshy scale today (~hundreds of rows per channel) the in-memory
    //    fold beats the round-trips a paginated approach would cost.
    const { data, error } = await admin
      .from("journey_messages")
      .select("channel_user_id, author_kind, body, created_at")
      .not("channel_user_id", "is", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("[pending-messages] fetch failed", error);
      return { rows: [], count: 0, ok: false };
    }

    type RawRow = {
      channel_user_id: string;
      author_kind: "user" | "expert";
      body: string | null;
      created_at: string;
    };
    const rows = (data ?? []) as RawRow[];

    // 2. Walk the rows newest-first. For each channel, the FIRST entry
    //    we see is the latest message. If that latest is by a user, the
    //    thread needs a reply. We also count user-side rows per channel
    //    while we're at it (single pass).
    type Acc = {
      latest: RawRow | null;
      userCount: number;
    };
    const byChannel = new Map<string, Acc>();
    for (const r of rows) {
      const slot = byChannel.get(r.channel_user_id) ?? {
        latest: null,
        userCount: 0,
      };
      if (slot.latest === null) slot.latest = r;
      if (r.author_kind === "user") slot.userCount += 1;
      byChannel.set(r.channel_user_id, slot);
    }

    const pendingUserIds: string[] = [];
    const meta = new Map<
      string,
      { lastUserMessageAt: string; lastBody: string; totalUserMessages: number }
    >();
    for (const [userId, slot] of byChannel.entries()) {
      if (!slot.latest) continue;
      if (slot.latest.author_kind !== "user") continue;
      pendingUserIds.push(userId);
      meta.set(userId, {
        lastUserMessageAt: slot.latest.created_at,
        lastBody: slot.latest.body ?? "",
        totalUserMessages: slot.userCount,
      });
    }
    if (pendingUserIds.length === 0) {
      return { rows: [], count: 0, ok: true };
    }

    // 3. Hydrate profiles + couple membership in parallel. One round-trip
    //    each — both queries are bounded by the small `pendingUserIds`
    //    set, so payload stays tiny even with hundreds of pending rows.
    const [profileRes, memberRes] = await Promise.all([
      admin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", pendingUserIds),
      admin
        .from("couple_members")
        .select("user_id, couple_id")
        .in("user_id", pendingUserIds),
    ]);

    type ProfileRow = { id: string; full_name: string | null; email: string | null };
    type MemberRow = { user_id: string; couple_id: string };
    const profileById = new Map<string, ProfileRow>(
      ((profileRes.data ?? []) as ProfileRow[]).map((p) => [p.id, p]),
    );
    const coupleByUser = new Map<string, string>(
      ((memberRes.data ?? []) as MemberRow[]).map((m) => [m.user_id, m.couple_id]),
    );

    const enriched: PendingMessageRow[] = pendingUserIds.map((userId) => {
      const m = meta.get(userId)!;
      const profile = profileById.get(userId) ?? null;
      const displayName =
        (profile?.full_name?.trim() ?? "") ||
        (profile?.email ? profile.email.split("@")[0] : "") ||
        `user ${userId.slice(0, 8)}`;
      return {
        userId,
        lastUserMessageAt: m.lastUserMessageAt,
        lastBody: m.lastBody,
        displayName,
        email: profile?.email ?? null,
        coupleId: coupleByUser.get(userId) ?? null,
        totalUserMessages: m.totalUserMessages,
      };
    });

    // 4. Sort newest-first and cap. The display layer further clips per
    //    its own surface budget.
    enriched.sort((a, b) => b.lastUserMessageAt.localeCompare(a.lastUserMessageAt));
    return {
      rows: enriched.slice(0, limit),
      count: enriched.length,
      ok: true,
    };
  } catch (err) {
    console.warn("[pending-messages] threw", err);
    return { rows: [], count: 0, ok: false };
  }
}
