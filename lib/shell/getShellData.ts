/**
 * Resolves all the data the AppShell needs from the current request:
 *
 *   • Couple identity (names + initials) — for <CoupleCard>
 *   • Assigned expert + most recent message — for <ExpertMini>
 *   • Per-nav badge counts                — for <SideNav> + <MobileTabs>
 *
 * Returns `null` when the caller isn't authenticated. The (shell) layout
 * uses the null return as a signal to redirect to /auth (vs. rendering
 * the shell with a fake identity).
 *
 * Designed to be cheap on every request — we cache the entitlements +
 * couple lookups via the existing React.cache wrappers and skip badge
 * queries when there's no journey entitlement (the route gate handles
 * that case elsewhere, but defensive — saves DB calls for the "Today"
 * page that hits the shell for every authenticated session).
 *
 * Added 2026-05-29 as part of Step 2 of the post-login redesign.
 */

import "server-only";

import { cache } from "react";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import { getCurrentCoupleContext } from "@/lib/between-us/couples";
import { getCoachPersonaForUser } from "@/lib/journey/coach";
import { getGeneralChannelThread } from "@/lib/journey-content/messages";
import { getUnreadCountForUser } from "@/lib/journey-content/notifications-read";
import { getTimelineForOwner } from "@/lib/journey-content/queries";
import {
  journeyOwnerForUser,
  preferCoupleOwner,
} from "@/lib/journey-content/owner";
import type {
  CoupleCardData,
  ExpertMiniData,
  NavKey,
} from "@/components/shell";

export interface ShellData {
  /** Auth-resolved user id. Useful for the layout if it needs more reads. */
  userId: string;
  /** Whether the user has an active Journey subscription. */
  hasJourney: boolean;
  /** Identity card data — always present for authenticated users. */
  couple: CoupleCardData;
  /** Expert mini data — null when the user isn't assigned to one yet. */
  expert: ExpertMiniData | null;
  /** Badge counts per nav key, sparse — only keys with > 0 appear. */
  badges: Partial<Record<NavKey, number>>;
  /** Soft dot indicators per nav key (e.g. unfinished partner-share). */
  dots: Partial<Record<NavKey, boolean>>;
  /** Unread notifications count for the PageHeader bell. */
  notificationCount: number;
}

/**
 * Pull the first non-empty initial from a name string. Defaults to a
 * single space when the name is empty/null so the avatar always has
 * something to render (RTL-stable). For Hebrew names we want the FIRST
 * character of the string (e.g. "נועה" → "נ"); for Latin names the
 * same rule reads as the first letter, which is correct.
 */
function initialOf(name: string | null | undefined): string {
  if (!name) return " ";
  const trimmed = name.trim();
  if (!trimmed) return " ";
  // Array spread to handle multi-byte glyphs correctly.
  return [...trimmed][0];
}

/**
 * Resolve a display name for the owner when the profile's full_name is
 * empty. Order of preference:
 *   1. profiles.full_name (when populated by signup)
 *   2. The locale-appropriate "me" word ("אני" / "Me") — much friendlier
 *      than an email prefix slug.
 *   3. Email local-part (only as a last resort — happens when the user
 *      has no profile row AND no real email, which is rare).
 *
 * The shell prefers (2) over (3) so users without a full_name don't see
 * "fr" (from "fred@example.com") in the sidebar pair-avatar.
 */
function resolveOwnerName(args: {
  fullName: string | null;
  email: string | null;
  isHe: boolean;
}): string {
  if (args.fullName && args.fullName.trim().length > 0) {
    return args.fullName.trim();
  }
  return args.isHe ? "אני" : "Me";
}

/**
 * Build the locale-aware status line under the names ("המסע פעיל ·
 * החודש 1"). Returns null for non-Hebrew (English copy goes via the
 * messages namespace at the layout level — keeping this pure for now).
 */
function buildStatusLine(args: {
  hasJourney: boolean;
  hebrew: boolean;
}): string | null {
  const { hasJourney, hebrew } = args;
  if (!hebrew) return null;
  if (!hasJourney) return "ללא ליווי כרגע";
  return "המסע פעיל";
}

/**
 * Count the number of journey items that unlocked in the last 24 hours
 * AND haven't been completed yet — used as the "השיעורים שלי" badge.
 *
 * Respects `profiles.lessons_seen_at` (B5): once the user opens the
 * /my/lessons page, the cutoff moves to MAX(seen_at, NOW()-24h). Items
 * unlocked before the visit are considered "already seen" and don't
 * inflate the badge.
 *
 * Wraps the same timeline fetch as /my/today and /my/lessons, with
 * graceful degradation when the underlying calls fail.
 */
async function countFreshUnlockedItems(args: {
  userId: string;
  coupleId: string | null;
  lessonsSeenAt: string | null;
}): Promise<number> {
  try {
    const legacyOwner = preferCoupleOwner(args.userId, args.coupleId);
    const cadenceOwner = journeyOwnerForUser(args.userId);
    const [legacy, cadence] = await Promise.all([
      getTimelineForOwner({
        owner: legacyOwner,
        viewerUserId: args.userId,
        viewerCoupleRole: null,
        sourceKinds: ["program", "category", "item"],
      }),
      getTimelineForOwner({
        owner: cadenceOwner,
        viewerUserId: args.userId,
        viewerCoupleRole: null,
        sourceKinds: ["cadence"],
      }),
    ]);
    const nowMs = Date.now();
    const recencyMs = nowMs - 24 * 60 * 60 * 1000;
    // Cutoff = whichever is MORE RECENT, the user's last visit OR the
    // 24h recency window. Treats NULL as "never seen" → fall back to
    // the recency window so the badge still surfaces fresh items.
    const seenMs = args.lessonsSeenAt
      ? new Date(args.lessonsSeenAt).getTime()
      : 0;
    const cutoffMs = Math.max(recencyMs, seenMs);
    const merged = [...legacy, ...cadence];
    return merged.filter((e) => {
      const unlockMs = new Date(e.scheduled.unlock_at).getTime();
      if (unlockMs > nowMs) return false; // not unlocked
      if (unlockMs <= cutoffMs) return false; // before cutoff
      if (e.completion?.completed_at) return false; // already done
      return true;
    }).length;
  } catch (err) {
    console.warn("[getShellData.countFreshUnlockedItems] failed", err);
    return 0;
  }
}

/**
 * Count clinician replies that arrived AFTER the user's last visit to
 * /my/expert (or in the last 30 days, whichever is more recent).
 *
 * Uses the session client so RLS keeps this user-scoped. Falls back to
 * 0 on any error.
 */
async function countFreshClinicianReplies(args: {
  userId: string;
  expertSeenAt: string | null;
}): Promise<number> {
  const nowMs = Date.now();
  const recencyMs = nowMs - 30 * 24 * 60 * 60 * 1000;
  const seenMs = args.expertSeenAt
    ? new Date(args.expertSeenAt).getTime()
    : 0;
  const cutoffIso = new Date(Math.max(recencyMs, seenMs)).toISOString();

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("journey_item_responses")
      .select("clinician_replied_at", { head: false, count: "exact" })
      .eq("user_id", args.userId)
      .not("clinician_reply_text", "is", null)
      .gt("clinician_replied_at", cutoffIso)
      .limit(50);
    if (error || !data) return 0;
    return data.length;
  } catch (err) {
    console.warn("[getShellData.countFreshClinicianReplies] failed", err);
    return 0;
  }
}

/**
 * Main entry. Server-only. Returns null when not authenticated.
 *
 * Wrapped in React.cache so the layout AND every page that reads the
 * shell share one DB round-trip per request. Critical: every page in
 * the (shell) group calls this twice (once via the layout, once at
 * page-level) — the cache turns the second call into a free lookup.
 */
export const getShellData = cache(_getShellData);

async function _getShellData(args: {
  locale: "he" | "en";
}): Promise<ShellData | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const hebrew = args.locale === "he";

  // Entitlements are React.cache-wrapped — calling this here is free
  // because the (shell) layout's parent (locale layout) already paid
  // the cost.
  const entitlements = await getUserEntitlements();
  const hasJourney = !!entitlements?.journey;

  // Couple context — single owner/partner row + role.
  const coupleCtx = await getCurrentCoupleContext();

  // Pull the owner & partner names. Owner = profiles row for THIS user.
  // Partner = the other couple_member's profile row (if any). Done in
  // parallel to keep the shell render-cost flat.
  //
  // We could derive the partner id from `coupleCtx` if it exposed
  // members, but it intentionally only returns the count — so we hit
  // couple_members directly here. Admin client is fine: auth.uid is
  // validated above and RLS doesn't apply when partner lookups need to
  // cross couple_members rows that belong to the SAME couple as the
  // caller (already verified via getCurrentCoupleContext).
  const admin = createServiceRoleClient();
  let fullName: string | null = null;
  let partnerName: string | null = null;
  // B5 — surface "seen" markers. NULL when migration 099 hasn't run yet
  // OR the user has never opened the surface. Both cases map to "no
  // cut-off" — badge sees everything in the recency window.
  let expertSeenAt: string | null = null;
  let lessonsSeenAt: string | null = null;

  if (admin) {
    const ownerProfileP = admin
      .from("profiles")
      .select("full_name, expert_messages_seen_at, lessons_seen_at")
      .eq("id", user.id)
      .maybeSingle();

    // Partner lookup only runs when there IS a couple.
    const partnerNameP = coupleCtx?.couple_id
      ? (async () => {
          const { data: otherMembers } = await admin
            .from("couple_members")
            .select("user_id")
            .eq("couple_id", coupleCtx.couple_id!)
            .neq("user_id", user.id)
            .limit(1);
          const otherId = (otherMembers ?? [])[0]?.user_id as
            | string
            | undefined;
          if (!otherId) return null;
          const { data: row } = await admin
            .from("profiles")
            .select("full_name")
            .eq("id", otherId)
            .maybeSingle();
          return (row as { full_name: string | null } | null)?.full_name?.trim() ?? null;
        })()
      : Promise.resolve(null);

    const [{ data: ownerRow }, partnerVal] = await Promise.all([
      ownerProfileP,
      partnerNameP,
    ]);
    const orow = ownerRow as
      | {
          full_name: string | null;
          expert_messages_seen_at: string | null;
          lessons_seen_at: string | null;
        }
      | null;
    fullName = orow?.full_name?.trim() || null;
    expertSeenAt = orow?.expert_messages_seen_at ?? null;
    lessonsSeenAt = orow?.lessons_seen_at ?? null;
    partnerName = partnerVal;
  }

  const ownerName = resolveOwnerName({
    fullName,
    email: user.email ?? null,
    isHe: hebrew,
  });

  const couple: CoupleCardData = {
    ownerName,
    ownerInitial: initialOf(ownerName),
    partnerName,
    partnerInitial: partnerName ? initialOf(partnerName) : null,
    statusLine: buildStatusLine({ hasJourney, hebrew }),
  };

  // ── Expert mini ────────────────────────────────────────────────────
  // Only populate when the user has a journey entitlement — without one
  // the channel is locked anyway. We pull the coach persona AND the
  // most recent message (in either direction) so the preview shows a
  // real snippet, not a stub.
  let expert: ExpertMiniData | null = null;
  if (hasJourney) {
    const persona = await getCoachPersonaForUser(user.id);
    const displayName = hebrew
      ? persona.displayNameHe || persona.displayNameEn
      : persona.displayNameEn || persona.displayNameHe;

    if (displayName) {
      // Most recent message in the user's general channel. Limit 1 is
      // implicit — getGeneralChannelThread returns the whole thread and
      // we pluck the newest. The dashboard already pays this fetch, so
      // we re-use it later via React.cache when wired.
      let lastMessage: string | null = null;
      try {
        const thread = await getGeneralChannelThread(user.id, user.id);
        const newest = thread[thread.length - 1] ?? null;
        lastMessage = newest?.body ?? null;
      } catch (err) {
        console.warn("[shell.getShellData] expert thread read failed", err);
      }

      expert = {
        expertName: displayName,
        expertInitial: initialOf(displayName),
        online: true, // we don't track presence yet — UI implies availability
        lastMessage,
        askHref: "/my/expert",
        // Caller (layout) overrides via CMS string — fallback in Hebrew.
        askLabel: hebrew ? "שאלה למומחה" : "Ask your expert",
      };
    }
  }

  // ── Badges (Step 6: real counts in parallel) ───────────────────────
  // Each badge degrades to 0 on failure (the helper functions all
  // swallow their own errors). The three reads run in parallel so the
  // shell render-cost stays flat regardless of how many we add later.
  //
  //   • expert  — clinician replies in the last 30 days (read tracking
  //               can come later; for now "recent" is the proxy).
  //   • lessons — items unlocked in the last 24h not yet completed.
  //   • bell    — the existing journey_notifications inbox count.
  //
  // Skips badge lookups entirely when the user isn't entitled to
  // Journey — there's nothing to count.
  const badges: Partial<Record<NavKey, number>> = {};
  const dots: Partial<Record<NavKey, boolean>> = {};

  if (!coupleCtx?.couple_id) {
    // Soft nudge to pair — strong growth lever, lives on every visit.
    dots.share = true;
  }

  let notificationCount = 0;

  if (hasJourney) {
    // B5 — both badge queries now respect the surface "seen" marker.
    // The `countFreshClinicianReplies` and `countFreshUnlockedItems`
    // helpers above take MAX(seen_at, recency cut-off), so:
    //   • Opening the page once → badge = 0 next render.
    //   • A new reply / lesson arrives → badge re-appears.
    // Bell badge uses the existing read_at column on journey_notifications.
    const [freshReplies, freshLessons, unread] = await Promise.all([
      countFreshClinicianReplies({
        userId:        user.id,
        expertSeenAt:  expertSeenAt,
      }),
      countFreshUnlockedItems({
        userId:        user.id,
        coupleId:      coupleCtx?.couple_id ?? null,
        lessonsSeenAt: lessonsSeenAt,
      }),
      getUnreadCountForUser(user.id).catch(() => 0),
    ]);

    if (freshReplies > 0) badges.expert = freshReplies;
    if (freshLessons > 0) badges.lessons = freshLessons;
    notificationCount = unread;
  }

  return {
    userId: user.id,
    hasJourney,
    couple,
    expert,
    badges,
    dots,
    notificationCount,
  };
}
