/**
 * Pending-message inbox helpers for the admin / expert dashboard.
 *
 * "Pending" = the user's latest reply has not been answered by an expert.
 * We don't track an explicit `read_at` per message; the "latest writer"
 * heuristic is the cheapest reliable signal and matches the way the
 * expert already works (open the thread → read everything → reply once).
 *
 * Surfaces a user can write from (both flow through journey_messages):
 *   • General channel  (/my/expert)            → channel_user_id IS NOT NULL
 *   • Per-item thread  (/journey/timeline/[id]) → scheduled_item_id IS NOT NULL
 *
 * 2026-06-02 (Itzik): per-item replies were previously invisible to the
 * expert because this helper only queried general-channel messages.
 * Now both surfaces are folded into the pending list, keyed by user.
 *
 * Used by:
 *   • `/dashboard` overview card ("Pending user messages")
 *   • `/dashboard/coaching/sidebar` badge (count only)
 *   • `/dashboard/journey/replies` full table (step 3)
 */

import "server-only";

import { createServiceRoleClient } from "@/lib/supabase-admin";

export interface PendingMessageRow {
  /** profiles.id — the message owner. Drives every downstream link. */
  userId: string;
  /** When the user last wrote (across both surfaces). ISO. */
  lastUserMessageAt: string;
  /** Last body (clipped at 140 chars by the consumer). */
  lastBody: string;
  /** Surface the latest message came from. The detail page can use this
   *  to route the expert to the right reply UI. */
  lastContext: "general" | "per_item";
  /** When `lastContext === "per_item"`, the scheduled-item id of the
   *  thread the latest message belongs to. Null for general-channel. */
  lastScheduledItemId: string | null;
  /** Full name when present, falls back to email local-part, then to
   *  a short uid suffix. Never null — so the row always has SOMETHING
   *  to render. */
  displayName: string;
  /** Email — for the secondary line under the name. Sourced from auth.users
   *  (via v_user_directory) so it's present even when the profiles row is bare.
   *  May be null only for the rare account with no email at all. */
  email: string | null;
  /** Mobile/phone when available (profiles.phone ?? profiles.mobile, via
   *  v_user_directory). Shown as a sub-line. Null when not on file. */
  phone: string | null;
  /** Couple membership when present — drives the deep-link target.
   *  Solo users link to /dashboard/my-clients/[userId] (TBD route) for
   *  now we just link to the journey-expert-messages page filtered. */
  coupleId: string | null;
  /** Total user-side message count across BOTH surfaces (signals "this
   *  person writes a lot"). */
  totalUserMessages: number;
  /** Number of distinct per-item threads from this user where the last
   *  message is theirs (i.e. needs a reply on a specific lesson). */
  pendingPerItemThreads: number;
  /** True when the general channel itself needs a reply right now. */
  pendingGeneralChannel: boolean;
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

    // 1. Pull EVERY journey message (both general channel + per-item).
    //    The table is write-light and we only need 5 columns. We need
    //    author_user_id too — for per-item threads the scheduled item is
    //    where we group, but to attribute the "who wrote" we read
    //    author_user_id (channel_user_id is null on per-item rows).
    const { data, error } = await admin
      .from("journey_messages")
      .select("channel_user_id, scheduled_item_id, author_user_id, author_kind, body, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("[pending-messages] fetch failed", error);
      return { rows: [], count: 0, ok: false };
    }

    type RawRow = {
      channel_user_id: string | null;
      scheduled_item_id: string | null;
      author_user_id: string | null;
      author_kind: "user" | "expert";
      body: string | null;
      created_at: string;
    };
    const rows = (data ?? []) as RawRow[];

    // 2. Resolve each row to (ownerUserId, threadKey).
    //    • General channel: ownerUserId = channel_user_id; threadKey = "general:<uid>"
    //    • Per-item: ownerUserId = author_user_id (the writer of the
    //      scheduled-item thread is its owner — the expert is the other
    //      side, never the owner); threadKey = "item:<scheduled>"
    //    Per-item threads where the LAST writer is the expert can't be
    //    keyed by author_user_id (would be the expert's id) — instead
    //    we resolve the owner from the FIRST message in the thread,
    //    which is always the user. We track first-author per thread on
    //    the fly while iterating newest→oldest by overwriting (so the
    //    final value is the oldest = user-side seed).

    type ThreadSlot = {
      ownerUserId: string | null;
      latest: RawRow | null;
      userCount: number;
      surface: "general" | "per_item";
    };
    const threads = new Map<string, ThreadSlot>();

    for (const r of rows) {
      let threadKey: string;
      let surface: "general" | "per_item";
      let ownerCandidate: string | null;

      if (r.channel_user_id) {
        threadKey = `general:${r.channel_user_id}`;
        surface = "general";
        ownerCandidate = r.channel_user_id;
      } else if (r.scheduled_item_id) {
        threadKey = `item:${r.scheduled_item_id}`;
        surface = "per_item";
        // For per-item threads, owner = the user. The expert can also
        // write here, so don't trust author_user_id on every row —
        // pick it up from user-authored rows only.
        ownerCandidate =
          r.author_kind === "user" ? r.author_user_id : null;
      } else {
        continue; // malformed row — skip
      }

      const slot =
        threads.get(threadKey) ??
        ({
          ownerUserId: null,
          latest: null,
          userCount: 0,
          surface,
        } as ThreadSlot);
      if (slot.latest === null) slot.latest = r;
      if (ownerCandidate && !slot.ownerUserId) slot.ownerUserId = ownerCandidate;
      if (r.author_kind === "user") slot.userCount += 1;
      threads.set(threadKey, slot);
    }

    // 3. Fold threads → per-user pending state.
    type UserAcc = {
      lastUserMessageAt: string;
      lastBody: string;
      lastContext: "general" | "per_item";
      lastScheduledItemId: string | null;
      totalUserMessages: number;
      pendingPerItemThreads: number;
      pendingGeneralChannel: boolean;
    };
    const byUser = new Map<string, UserAcc>();

    for (const [threadKey, slot] of threads.entries()) {
      if (!slot.ownerUserId) continue;
      if (!slot.latest) continue;
      const needsReply = slot.latest.author_kind === "user";

      const acc =
        byUser.get(slot.ownerUserId) ??
        ({
          lastUserMessageAt: "",
          lastBody: "",
          lastContext: "general",
          lastScheduledItemId: null,
          totalUserMessages: 0,
          pendingPerItemThreads: 0,
          pendingGeneralChannel: false,
        } as UserAcc);

      acc.totalUserMessages += slot.userCount;

      if (needsReply) {
        if (slot.surface === "per_item") acc.pendingPerItemThreads += 1;
        if (slot.surface === "general") acc.pendingGeneralChannel = true;

        if (slot.latest.created_at > acc.lastUserMessageAt) {
          acc.lastUserMessageAt = slot.latest.created_at;
          acc.lastBody = slot.latest.body ?? "";
          acc.lastContext = slot.surface;
          acc.lastScheduledItemId =
            slot.surface === "per_item"
              ? threadKey.replace(/^item:/, "")
              : null;
        }
      }

      byUser.set(slot.ownerUserId, acc);
    }

    const pendingUserIds = Array.from(byUser.entries())
      .filter(([, acc]) => acc.pendingGeneralChannel || acc.pendingPerItemThreads > 0)
      .map(([uid]) => uid);

    if (pendingUserIds.length === 0) {
      return { rows: [], count: 0, ok: true };
    }

    // 4. Hydrate identity (v_user_directory) + couple membership in parallel.
    //    One round-trip each, bounded by the small `pendingUserIds` set.
    //    v_user_directory is admin-only and built FROM auth.users LEFT JOIN
    //    profiles, so it carries the auth-backed email (always present) +
    //    phone (profiles.phone ?? mobile) + the signup-metadata name. That's
    //    why names no longer collapse to "user <id>" when profiles.full_name
    //    is blank. `select("*")` keeps this resilient to migration 137 (which
    //    adds `meta_name`): the field is simply undefined until that runs.
    const [dirRes, memberRes] = await Promise.all([
      admin
        .from("v_user_directory")
        .select("*")
        .in("user_id", pendingUserIds),
      admin
        .from("couple_members")
        .select("user_id, couple_id")
        .in("user_id", pendingUserIds),
    ]);

    type DirRow = {
      user_id: string;
      email: string | null;
      full_name: string | null;
      phone: string | null;
      meta_name?: string | null;
    };
    type MemberRow = { user_id: string; couple_id: string };
    const dirByUser = new Map<string, DirRow>(
      ((dirRes.data ?? []) as DirRow[]).map((d) => [d.user_id, d]),
    );
    const coupleByUser = new Map<string, string>(
      ((memberRes.data ?? []) as MemberRow[]).map((m) => [m.user_id, m.couple_id]),
    );

    const enriched: PendingMessageRow[] = pendingUserIds.map((userId) => {
      const acc = byUser.get(userId)!;
      const dir = dirByUser.get(userId) ?? null;
      const email = dir?.email ?? null;
      // Name fallback chain: profiles.full_name → auth signup-metadata name →
      // email local-part → "user <id>" (true last resort).
      const displayName =
        (dir?.full_name?.trim() || "") ||
        (dir?.meta_name?.trim() || "") ||
        (email ? email.split("@")[0] : "") ||
        `user ${userId.slice(0, 8)}`;
      return {
        userId,
        lastUserMessageAt: acc.lastUserMessageAt,
        lastBody: acc.lastBody,
        lastContext: acc.lastContext,
        lastScheduledItemId: acc.lastScheduledItemId,
        displayName,
        email,
        phone: dir?.phone ?? null,
        coupleId: coupleByUser.get(userId) ?? null,
        totalUserMessages: acc.totalUserMessages,
        pendingPerItemThreads: acc.pendingPerItemThreads,
        pendingGeneralChannel: acc.pendingGeneralChannel,
      };
    });

    // 5. Sort newest-first and cap. The display layer further clips per
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
