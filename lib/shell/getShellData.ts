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
import { getRequestUser } from "@/lib/auth/getRequestUser";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import { makeLogger } from "@/lib/observability/log";

// 2026-05-31 — every shell render emits start/phaseA/phaseB/done lines so
// slow renders are visible without manual digging. Filter Vercel logs by
// `scope=shell.data` to see per-render timing breakdowns.
const log = makeLogger("shell.data");
import { getCurrentCoupleContext } from "@/lib/between-us/couples";
import { getCoachPersonaForUser } from "@/lib/journey/coach";
import { getUnreadCountForUser } from "@/lib/journey-content/notifications-read";
import { listAssignmentsForOwner } from "@/lib/journey-content/queries";
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
  // 2026-05-31 — rewritten as a count-style query. Old version called
  // `getTimelineForOwner` twice, and each call internally fanned out to
  // 7 DB reads (assignments, scheduled, items, completions, responses,
  // categories, rules) — even though all the badge needs is a count of
  // scheduled rows in a small time window.
  //
  // New plan, 3-4 queries total:
  //   1. Assignment ids for legacy + cadence owners (in parallel).
  //   2. Scheduled rows in (cutoff, now] for those assignments (id +
  //      assignment_id + audience only — no joins).
  //   3. Completions for those scheduled ids (id-only) so we can subtract.
  //
  // Audience filter: legacy assignments are typically couple-owned, and
  // `viewerCoupleRole` is unknown at shell-render time → we preserve the
  // existing rule "couple-owned + unknown role → only audience='both'".
  // For user-owned assignments (cadence) the audience column doesn't
  // apply, so every scheduled row passes.
  try {
    const nowMs = Date.now();
    const recencyMs = nowMs - 24 * 60 * 60 * 1000;
    const seenMs = args.lessonsSeenAt
      ? new Date(args.lessonsSeenAt).getTime()
      : 0;
    const cutoffMs = Math.max(recencyMs, seenMs);
    const cutoffIso = new Date(cutoffMs).toISOString();
    const nowIso = new Date(nowMs).toISOString();

    const legacyOwner = preferCoupleOwner(args.userId, args.coupleId);
    const cadenceOwner = journeyOwnerForUser(args.userId);

    const [legacyAssignments, cadenceAssignments] = await Promise.all([
      listAssignmentsForOwner(legacyOwner, {
        onlyActive: true,
        sourceKinds: ["program", "category", "item"],
      }),
      listAssignmentsForOwner(cadenceOwner, {
        onlyActive: true,
        sourceKinds: ["cadence"],
      }),
    ]);
    if (
      legacyAssignments.length === 0 &&
      cadenceAssignments.length === 0
    ) {
      return 0;
    }

    // Tag each assignment id with its ownership kind so the audience
    // filter below can apply the correct rule. We don't need to keep
    // the full assignment row — only the kind, which is constant per
    // owner kind.
    const assignmentKindById = new Map<string, "couple" | "user">();
    for (const a of legacyAssignments) {
      assignmentKindById.set(
        a.id,
        legacyOwner.kind === "couple" ? "couple" : "user",
      );
    }
    for (const a of cadenceAssignments) {
      // cadenceOwner is always user-kind by construction.
      assignmentKindById.set(a.id, "user");
    }
    const assignmentIds = Array.from(assignmentKindById.keys());

    const supabase = await createServerSupabaseClient();
    const { data: scheduledRows, error: sErr } = await supabase
      .from("journey_scheduled_items")
      .select("id, assignment_id, audience")
      .in("assignment_id", assignmentIds)
      .gt("unlock_at", cutoffIso)
      .lte("unlock_at", nowIso);
    if (sErr) {
      console.warn(
        "[getShellData.countFreshUnlockedItems] scheduled read failed",
        sErr,
      );
      return 0;
    }
    if (!scheduledRows || scheduledRows.length === 0) return 0;

    type SRow = { id: string; assignment_id: string; audience: string };
    const audienceFiltered = (scheduledRows as SRow[]).filter((r) => {
      const kind = assignmentKindById.get(r.assignment_id);
      if (kind !== "couple") return true;
      // Couple-owned + unknown viewer role → only 'both' surfaces, same
      // as `getTimelineForOwner`'s defensive default.
      return r.audience === "both";
    });
    if (audienceFiltered.length === 0) return 0;

    // Subtract already-completed. If this read fails we return the
    // pre-subtraction count — over-counting beats showing zero badge.
    const scheduledIds = audienceFiltered.map((r) => r.id);
    const { data: completionRows, error: cErr } = await supabase
      .from("journey_item_completions")
      .select("scheduled_item_id")
      .in("scheduled_item_id", scheduledIds);
    if (cErr) {
      console.warn(
        "[getShellData.countFreshUnlockedItems] completions read failed",
        cErr,
      );
      return audienceFiltered.length;
    }
    const completedSet = new Set(
      ((completionRows ?? []) as { scheduled_item_id: string }[]).map(
        (c) => c.scheduled_item_id,
      ),
    );
    return audienceFiltered.filter((r) => !completedSet.has(r.id)).length;
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
 * Single-row body+timestamp fetch of the latest message in the user's
 * general channel — populates ExpertMini.lastMessage in the sidebar AND
 * the /my/today ChatRowPreview. Both consumers read from the same shell
 * data shape so /my/today doesn't need to refetch.
 *
 * Why this lives in the shell file rather than next to
 * getGeneralChannelThread: it's a shell-specific shape (1 row, body +
 * created_at, no personas) and pulling it in via the existing helper
 * would either re-introduce the over-fetch or muddy that helper's
 * contract.
 */
async function fetchLastMessagePreview(
  channelUserId: string,
): Promise<{ body: string | null; createdAt: string | null }> {
  try {
    const admin = createServiceRoleClient();
    if (!admin) return { body: null, createdAt: null };
    const { data, error } = await admin
      .from("journey_messages")
      .select("body, created_at")
      .eq("channel_user_id", channelUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return { body: null, createdAt: null };
    // The channel owner sees everything in their channel, including
    // private rows — same rule as getGeneralChannelThread.
    const row = data as { body: string | null; created_at: string | null };
    return { body: row.body ?? null, createdAt: row.created_at ?? null };
  } catch (err) {
    console.warn("[shell.fetchLastMessagePreview]", err);
    return { body: null, createdAt: null };
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
  const t0 = Date.now();
  log.info("start", { locale: args.locale });

  // 2026-05-31 — pull the request-scoped user + supabase client.
  // getRequestUser dedupes across every shell-side helper in the same
  // render — without this we paid 4-5 Supabase Auth round-trips per nav.
  const { user } = await getRequestUser();
  if (!user) {
    log.warn("no_user", { dur_ms: Date.now() - t0 });
    return null;
  }
  const tAuth = Date.now();
  log.info("auth_ok", { user_id: user.id, dur_ms: tAuth - t0 });

  const hebrew = args.locale === "he";
  const admin = createServiceRoleClient();

  // 2026-05-31 — parallelism pass.
  //
  // Previously this function awaited each fetch in series — entitlements,
  // then coupleCtx, then ownerProfile, then partner, then coach persona,
  // then last message, then badges. Many of those don't depend on each
  // other; the serial chain was ~5 sequential round-trips before the
  // sidebar could render.
  //
  // New phasing:
  //   Phase A (fire on auth):
  //     • entitlements (React.cache hit from parent layout — free)
  //     • coupleCtx
  //     • ownerProfile
  //   Phase B (after Phase A resolves):
  //     • partner lookup (depends on coupleCtx)
  //     • badges (depend on ownerProfile.lessons_seen_at + entitlements)
  //     • coach persona + last message (only when hasJourney)
  //
  // Net: 5 sequential round-trips → 2 (worst case). Couples with no
  // journey + no partner stay at ~1 round-trip beyond auth.
  type OwnerRow = {
    full_name: string | null;
    expert_messages_seen_at: string | null;
    lessons_seen_at: string | null;
  };

  const ownerProfileP: Promise<{ data: OwnerRow | null }> = admin
    ? (admin
        .from("profiles")
        .select("full_name, expert_messages_seen_at, lessons_seen_at")
        .eq("id", user.id)
        .maybeSingle() as unknown as Promise<{ data: OwnerRow | null }>)
    : Promise.resolve({ data: null });

  const phaseAStart = Date.now();
  const [entitlements, coupleCtx, { data: ownerRow }] = await Promise.all([
    getUserEntitlements(),
    getCurrentCoupleContext(),
    ownerProfileP,
  ]);
  log.info("phaseA_done", {
    user_id: user.id,
    has_journey: !!entitlements?.journey,
    has_couple: !!coupleCtx?.couple_id,
    has_profile: !!ownerRow,
    dur_ms: Date.now() - phaseAStart,
  });

  const hasJourney = !!entitlements?.journey;
  const fullName = ownerRow?.full_name?.trim() || null;
  const expertSeenAt = ownerRow?.expert_messages_seen_at ?? null;
  const lessonsSeenAt = ownerRow?.lessons_seen_at ?? null;

  // ── Phase B: fan everything else out in parallel ─────────────────────
  // Partner name (depends on coupleCtx). Admin client is fine: auth.uid
  // is validated above; cross-couple_members rows are within the same
  // couple verified via coupleCtx.
  const partnerP: Promise<string | null> =
    admin && coupleCtx?.couple_id
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
          return (
            (row as { full_name: string | null } | null)?.full_name?.trim() ??
            null
          );
        })()
      : Promise.resolve(null);

  // Journey-gated reads only fire when the user actually owns the pillar
  // — non-journey users skip these entirely.
  type CoachPersonaResult = Awaited<ReturnType<typeof getCoachPersonaForUser>>;
  const coachPersonaP: Promise<CoachPersonaResult | null> = hasJourney
    ? getCoachPersonaForUser(user.id)
    : Promise.resolve(null);
  const lastMessageP: Promise<{
    body: string | null;
    createdAt: string | null;
  }> = hasJourney
    ? fetchLastMessagePreview(user.id)
    : Promise.resolve({ body: null, createdAt: null });

  // Badge reads — same gating as before.
  const freshRepliesP: Promise<number> = hasJourney
    ? countFreshClinicianReplies({
        userId: user.id,
        expertSeenAt,
      })
    : Promise.resolve(0);
  const freshLessonsP: Promise<number> = hasJourney
    ? countFreshUnlockedItems({
        userId: user.id,
        coupleId: coupleCtx?.couple_id ?? null,
        lessonsSeenAt,
      })
    : Promise.resolve(0);
  const unreadP: Promise<number> = hasJourney
    ? getUnreadCountForUser(user.id).catch(() => 0)
    : Promise.resolve(0);

  const phaseBStart = Date.now();
  const [
    partnerName,
    coachPersona,
    lastMessage,
    freshReplies,
    freshLessons,
    unread,
  ] = await Promise.all([
    partnerP,
    coachPersonaP,
    lastMessageP,
    freshRepliesP,
    freshLessonsP,
    unreadP,
  ]);
  log.info("phaseB_done", {
    user_id: user.id,
    has_partner: !!partnerName,
    has_coach: !!coachPersona,
    fresh_replies: freshReplies,
    fresh_lessons: freshLessons,
    unread_count: unread,
    dur_ms: Date.now() - phaseBStart,
  });

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
  // Built from Phase B's coachPersona + lastMessage results — both
  // resolved with everything else in the single Promise.all above.
  let expert: ExpertMiniData | null = null;
  if (hasJourney && coachPersona) {
    const displayName = hebrew
      ? coachPersona.displayNameHe || coachPersona.displayNameEn
      : coachPersona.displayNameEn || coachPersona.displayNameHe;

    if (displayName) {
      expert = {
        expertName: displayName,
        expertInitial: initialOf(displayName),
        online: true, // we don't track presence yet — UI implies availability
        lastMessage: lastMessage.body,
        lastMessageAt: lastMessage.createdAt,
        askHref: "/my/expert",
        // Caller (layout) overrides via CMS string — fallback in Hebrew.
        askLabel: hebrew ? "שאלה למומחה" : "Ask your expert",
      };
    }
  }

  // ── Badges ─────────────────────────────────────────────────────────
  // Counts were resolved in Phase B (or set to 0 for non-journey users).
  // Sparse map — only keys with > 0 appear, the consumer renders them
  // as actual badges; everything else stays clean.
  const badges: Partial<Record<NavKey, number>> = {};
  const dots: Partial<Record<NavKey, boolean>> = {};

  if (!coupleCtx?.couple_id) {
    // Soft nudge to pair — strong growth lever, lives on every visit.
    dots.share = true;
  }

  if (freshReplies > 0) badges.expert = freshReplies;
  if (freshLessons > 0) badges.lessons = freshLessons;
  const notificationCount = unread;

  const total = Date.now() - t0;
  // Total > 1500ms is the threshold where the user starts to perceive
  // the navigation as slow. Bump those to warn so they're easy to spot.
  if (total > 1500) {
    log.warn("done", { user_id: user.id, dur_ms: total, slow: true });
  } else {
    log.info("done", { user_id: user.id, dur_ms: total });
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
