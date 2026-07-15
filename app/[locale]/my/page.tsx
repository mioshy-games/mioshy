import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Link } from "@/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  Flame,
  Gamepad2,
  Library,
  Sparkles,
  Users,
} from "lucide-react";
import {
  getCurrentCoupleContext,
  getCurrentCoupleContextFresh,
  listOwnedGamesForCouple,
} from "@/lib/between-us/couples";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import { JourneyGraceBanner } from "@/components/my/JourneyGraceBanner";
import { TrialEndingBanner } from "@/components/my/TrialEndingBanner";
import { OnboardingReminderCard } from "@/components/my/OnboardingReminderCard";
import { isFullAssessmentPending } from "@/lib/journey/full-assessment-pending";
import { UpgradeToJourneyCard } from "@/components/my/UpgradeToJourneyCard";
import { getOwnerJourneyStatus } from "@/lib/journey-content/owner-status";
import { countUnreadJourneyItems } from "@/lib/journey-content/unread";
import { getFreshClinicianReplies } from "@/lib/journey-content/fresh-replies";
import { getProfileGate } from "@/lib/auth/profile-gate";
import { RedeemCodeButton } from "@/components/between-us/RedeemCodeButton";
import { MyInvitePopup } from "@/components/my/MyInvitePopup";
import { hasActionablePendingInvitationForEmail } from "@/lib/between-us/invitations";
import type { PillarKey } from "@/lib/entitlements/getUserEntitlements";
import {
  derivePillarState,
  type AssessmentStage,
  type PillarStateOutput,
} from "@/lib/dashboard/pillar-state";
import { StateBadge } from "@/components/ui/StateBadge";
import { CmsText } from "@/components/cms/CmsText";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getCmsTranslations({
    locale: params.locale === "he" ? "he" : "en",
    namespace: "myHub",
    page: "my",
  });
  return {
    title: `Mioshy - ${t("metaTitle")}`,
    description: t("metaDescription"),
    robots: { index: false, follow: false },
  };
}

export default async function MyHubPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams?: { purchased?: string; code?: string };
}) {
  const { locale } = params;
  const isHe = locale === "he";

  // ─── Perf-debug logger (Itzik 2026-05-28 audit) ──────────────────
  // The verbose [/my:RENDER] dump used to fire on every request and
  // serialised the full entitlement + journey state to Vercel logs.
  // Helpful when debugging billing tickets — wasteful for the 99% of
  // hits with no issue. Set DEBUG_MY=1 (Vercel env or .env.local) to
  // re-enable. Same gate is applied to the BUILD marker.
  const debugMy = process.env.DEBUG_MY === "1";

  // Kick the CMS translations request off in parallel with the auth
  // round-trip. They have no dependency on each other so awaiting them
  // sequentially burned an extra ~150-400ms per render.
  const tPromise = getCmsTranslations({
    locale: isHe ? "he" : "en",
    namespace: "myHub",
    page: "my",
  });

  // Post-purchase shortcut - when the billing-success page sends users back
  // to /my?purchased=<game_id> after an Adults purchase, we drop them
  // straight into /my/adults instead of showing a celebration banner.
  // Per spec: "User wants to use, not celebrate."
  if (debugMy) console.log("[/my] BUILD=2026-04-30-redesign-phase-B v1");

  const purchasedQuery = searchParams?.purchased ?? null;
  if (purchasedQuery) {
    if (debugMy)
      console.log("[/my] redirecting to /my/adults due to ?purchased=", purchasedQuery);
    redirect(`/${locale}/my/adults`);
  }

  // The two top-of-render reads (couple ctx + entitlements) share the
  // same `auth.getUser()` underneath. Both are wrapped in React.cache
  // (couples.ts + getUserEntitlements.ts) so duplicated work across
  // layout + this page collapses to one set of round-trips.
  // NOTE: `ctx` is `let` because the lazy-couple-creation block below
  // may reassign it after createCoupleForSelf; entitlements is const.
  const [initialCtx, entitlements] = await Promise.all([
    getCurrentCoupleContext(),
    getUserEntitlements(),
  ]);
  if (!initialCtx) redirect(`/${locale}/auth`);
  if (!entitlements) redirect(`/${locale}/auth`);
  let ctx = initialCtx;

  // ─── Lazy couple creation (Itzik 2026-05-27) ─────────────────────
  // Some subscription paths don't auto-create a couple row (Cardcom
  // indicator webhook, admin-bypass users, hand-granted subs). When
  // that happens, the PartnerShareCard needs ctx.pair_code to render,
  // and pair_code only exists once a couple row does. The RPC is
  // idempotent so it's safe to run on every /my hit for affected users.
  // We do this BEFORE the big parallel fan-out so all the downstream
  // queries see the freshly-created couple_id.
  if (entitlements.pillarCount > 0 && !ctx.couple_id) {
    try {
      const { createCoupleForSelf } = await import(
        "@/app/actions/between-us-couple"
      );
      const created = await createCoupleForSelf();
      if (created.ok) {
        // Bypass the React.cache memo so we pick up the row we just made.
        const refreshed = await getCurrentCoupleContextFresh();
        if (refreshed) ctx = refreshed;
      }
    } catch (err) {
      console.warn(
        "[/my] lazy couple creation failed — share widget will hide",
        err,
      );
    }
  }

  const hasCouple = !!ctx.couple_id;
  const coupleId = ctx.couple_id;

  // ─── BIG PARALLEL FAN-OUT (Itzik perf audit 2026-05-28) ──────────
  // Everything below depends on `ctx` and `entitlements` (already
  // resolved) but NOT on each other. The old code awaited them
  // sequentially — 7 round-trips at ~150ms = 1+ second wasted. Now
  // they all fly concurrently and the slowest one sets the floor.
  const adminClientPromise = hasCouple
    ? import("@/lib/supabase/admin").then((m) =>
        m.createAdminSupabaseClient(),
      )
    : null;

  const [
    t,
    unreadJourneyCount,
    freshReplies,
    journeyStatus,
    owned,
    profileGate,
    partnerFullName,
    fullAssessmentPending,
  ] = await Promise.all([
    tPromise,
    countUnreadJourneyItems({
      userId: ctx.user_id,
      coupleId: ctx.couple_id,
    }).catch(() => 0),
    getFreshClinicianReplies(ctx.user_id).catch(() => ({
      latestReplyAt: null,
      recentReplyCount: 0,
      latestReplyHref: null,
    })),
    getOwnerJourneyStatus({
      userId: ctx.user_id,
      coupleId: ctx.couple_id,
    }),
    hasCouple
      ? listOwnedGamesForCouple(coupleId as string)
      : Promise.resolve([] as Awaited<ReturnType<typeof listOwnedGamesForCouple>>),
    getProfileGate(),
    // ─── Partner profile lookup ─────────────────────────────────────
    // Used by the "משוייך ל X" banner when the couple is fully
    // paired. Two admin reads collapsed into one helper so it can
    // ride alongside the rest of the fan-out instead of being a
    // post-script. TODO (Itzik 2026-05-28): consider storing
    // partner_full_name on couples to drop this lookup entirely.
    (async () => {
      if (!hasCouple || (ctx.partner_count ?? 0) < 2 || !coupleId)
        return null;
      try {
        const admin = await adminClientPromise;
        if (!admin) return null;
        const { data: members } = await admin
          .from("couple_members")
          .select("user_id")
          .eq("couple_id", coupleId);
        const partnerUserId = (members ?? [])
          .map((m) => m.user_id as string)
          .find((id) => id !== ctx.user_id);
        if (!partnerUserId) return null;
        const { data: profile } = await admin
          .from("profiles")
          .select("full_name")
          .eq("id", partnerUserId)
          .maybeSingle();
        return (profile?.full_name as string | null) ?? null;
      } catch (err) {
        console.warn("[/my] partner profile lookup failed", err);
        return null;
      }
    })(),
    // ─── Full-assessment pending (item-2 of the onboarding reminder) ──────
    // PER-USER: keyed on ctx.user_id, so one partner finishing does NOT clear
    // the other's reminder. Admin (service-role) read mirrors the former
    // CompleteFullAssessmentCard. Fail-open to "not pending" so a transient
    // read error never nags a user who may already be done.
    hasCouple
      ? (async () => {
          try {
            const admin = await adminClientPromise;
            if (!admin) return false;
            return await isFullAssessmentPending(admin, ctx.user_id);
          } catch (err) {
            console.warn("[/my] full-assessment pending check failed", err);
            return false;
          }
        })()
      : Promise.resolve(false),
  ]);

  const journeyNotificationCount =
    unreadJourneyCount + freshReplies.recentReplyCount;
  const ownedCount = owned.length;
  const profileIncomplete = !!profileGate && !profileGate.complete;
  const needsPartner = hasCouple && (ctx.partner_count ?? 0) < 2;

  // Consolidated onboarding reminder (NON-BLOCKING): shown while EITHER step is
  // outstanding — partner not yet joined OR this user's full assessment still
  // pending. Auto-hides per-user once both are done. Subscribers only (hasCouple
  // ⇒ pillarCount > 0 ⇒ a couple+pair_code already exist). Gates no content.
  const showOnboarding = hasCouple && (needsPartner || fullAssessmentPending);

  // ─── Redeemer pairing popup — auto-open ONLY with real invite context ──
  // (Itzik 2026-07-15) A free registrant with NO invitation should not get the
  // "enter your pairing code" popup auto-popped — nobody invited them, so it's
  // confusing. (Most genuinely-invited partners are already auto-redeemed during
  // signup and thus have a couple.) Auto-open only when the user arrived via an
  // invite link (?code=) or a real pending invitation exists for them. The
  // standing "enter code" card on the page below stays available for anyone who
  // genuinely has a code and wants to open it themselves. Owner popup unchanged.
  const arrivedViaInviteLink = !!searchParams?.code?.trim();
  const hasPendingInvite =
    !hasCouple && !arrivedViaInviteLink
      ? await hasActionablePendingInvitationForEmail(entitlements.email)
      : false;
  const showRedeemerPopup =
    !hasCouple && (arrivedViaInviteLink || hasPendingInvite);

  // ─── Pillar state derivation ─────────────────────────────────────────
  // One pure helper computes badge + CTA per pillar. UI just renders.
  // See docs/my-page-redesign-spec.md §0 (MVP) and §3/§5.
  const assessmentStage: AssessmentStage = journeyStatus.hasCompletedAssessment
    ? "completed"
    : journeyStatus.hasInProgressAssessment
      ? "in_progress"
      : "not_started";

  const gamesPillar = derivePillarState({
    pillar: "games",
    entitlement: entitlements.games,
    isHe,
  });
  const journeyPillar = derivePillarState({
    pillar: "journey",
    entitlement: entitlements.journey,
    hasActiveAssignments: journeyStatus.hasActiveAssignments,
    assessmentStage,
    isHe,
  });
  const adultsPillar = derivePillarState({
    pillar: "adults",
    entitlement: entitlements.adults,
    isHe,
  });

  // ─── Diagnostic log - gated behind DEBUG_MY=1 (Itzik perf audit 2026-05-28) ──
  // Was unconditional and ran on every render. The serialisation alone
  // (and the resulting log volume) was non-trivial; gate it so it only
  // fires when explicitly enabled for debugging billing/auth tickets.
  if (debugMy) {
    console.log("[/my:RENDER]", {
      user_id: ctx.user_id,
      email: entitlements.email,
      couple_id: ctx.couple_id,
      entitlements: {
        games: entitlements.games,
        journey: entitlements.journey,
        adults: entitlements.adults,
        pillarCount: entitlements.pillarCount,
      },
      assessmentStage,
      journeyStatus: {
        hasActiveAssignments: journeyStatus.hasActiveAssignments,
        hasInProgressAssessment: journeyStatus.hasInProgressAssessment,
        hasCompletedAssessment: journeyStatus.hasCompletedAssessment,
      },
      pillarStates: {
        games: gamesPillar.state,
        journey: journeyPillar.state,
        adults: adultsPillar.state,
      },
      journey_cta: journeyPillar.ctaLabel,
      journey_href: journeyPillar.ctaHref,
      notifications: {
        unreadItems: unreadJourneyCount,
        freshReplies: freshReplies.recentReplyCount,
        total: journeyNotificationCount,
      },
    });
  }

  // The Journey rail and the per-tab work-area used to live here. They
  // moved to /[locale]/my/journey, where all the past/present/future
  // therapeutic management lives. /my stays a quiet hub of the three
  // pillars; everything Journey-specific is one click away.

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="relative text-white"
    >
      {/* Backdrop is now provided globally by Chrome.tsx for every authed
          page (fixed-positioned, viewport-locked). Page just renders its
          own content above. */}

      <main className="relative mx-auto max-w-6xl px-4 pb-16 pt-10 sm:pt-14">
        {/* ─────── Once-per-session pairing popup, split by role ───────
            · Owner who still needs a partner → share-code popup (reuses
              PartnerShareCard). · Registered non-purchaser (no couple yet)
              → code-entry popup (reuses RedeemDialog). Both dismiss to
              localStorage (distinct keys) and never reappear once the user
              pairs (the gating conditions below stop mounting them). */}
        {hasCouple && needsPartner && ctx.pair_code ? (
          <MyInvitePopup mode="owner" pairCode={ctx.pair_code} />
        ) : null}
        {showRedeemerPopup ? (
          <MyInvitePopup mode="redeemer" redirectTo="/my/lessons" />
        ) : null}

        {/* ─────── Page title ─────── */}
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-fuchsia-200" />
              <span className="text-white/85">
                <CmsText cmsKey="myHub.accountLabel" />
              </span>
            </div>
            <h1 className="mt-3 flex items-center gap-3 text-4xl font-bold tracking-tight sm:text-5xl">
              <Library className="h-8 w-8 text-fuchsia-300 sm:h-10 sm:w-10" />
              <CmsText cmsKey="myHub.pageHeading" />
            </h1>
            {/* Welcome line — bumped from text-sm (default) to base 18px
                per Itzik 2026-05-06. The free-tier user reads this as their
                first sentence after signup, so it has to feel like a
                proper welcome, not a status caption. */}
            <CmsText
              cmsKey="myHub.heroLede"
              as="p"
              className="mt-3 max-w-xl text-[18px] leading-[1.55] text-white/80"
            />
          </div>

          {/* Account + invoices intentionally moved to a quiet quick-links
              row at the BOTTOM of the page. Per spec §5.3: the dashboard is
              about products, not admin chrome. Admin lives in /my/account. */}
        </section>

        {/* ─────── Consolidated onboarding reminder (top-of-page) ───────
            Replaces the former standalone PartnerShareCard banner AND the
            CompleteFullAssessmentCard. One NON-BLOCKING card with two checklist
            items (connect partner / complete full assessment), each with a ✓
            state, composing PartnerShareCard + RedeemCodeButton for the invite
            and a CTA to the assessment. Auto-hides per-user when both are done.
            Free-tier users (no couple) see nothing. */}
        {showOnboarding ? (
          <section className="mt-6">
            <OnboardingReminderCard
              pairCode={ctx.pair_code}
              partnerConnected={!needsPartner}
              partnerMode={
                entitlements.journey
                  ? "task"
                  : entitlements.pillarCount > 0
                    ? "optional"
                    : "disabled"
              }
            />
          </section>
        ) : null}

        {/* Fully-onboarded acknowledgement — only once the reminder is gone, so
            the "משוייך ל X" banner never doubles up with the reminder's own
            item-1 ✓. */}
        {hasCouple && !needsPartner && !showOnboarding ? (
          <section className="mt-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-50 backdrop-blur">
              <Users className="h-4 w-4 text-emerald-300" />
              <span>
                {isHe ? "משוייך ל " : "Paired with "}
                <span className="font-semibold">
                  {partnerFullName ??
                    (isHe ? "פרטנר" : "your partner")}
                </span>
              </span>
            </div>
          </section>
        ) : null}

        {/* v3 slice 5 - grace / blocked banner. Renders nothing when
            journey is active or null. Sits above the membership banner
            so users in grace immediately see the "your plan ended"
            message without scrolling. */}
        {/* Task 21 — gentle days-6-7 trial escalation (self-gating client island). */}
        {entitlements.isTrialing ? (
          <section className="mt-8">
            <TrialEndingBanner isHe={isHe} />
          </section>
        ) : null}

        {entitlements.journeyState && entitlements.journeyState !== "active" ? (
          <section className="mt-8">
            <JourneyGraceBanner
              isHe={isHe}
              state={entitlements.journeyState}
              graceUntil={entitlements.journeyGraceUntil}
            />
          </section>
        ) : null}

        {/* F3.2 "complete later" prompt now lives inside the consolidated
            OnboardingReminderCard above (item 2). */}

        {/* ─────── Membership-status banner ───────
            Lights up immediately after the title so a returning user sees
            "where they stand" without scrolling. Three states:
              · pillarCount === 0 → Free tier, soft CTA toward pricing.
              · pillarCount 1-2  → Active, showing which pillar(s), nudge
                                    toward the unentitled ones.
              · pillarCount === 3 → All-access, celebratory copy. */}
        <section className="mt-8">
          {entitlements.pillarCount === 0 ? (
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-white/15 bg-gradient-to-br from-fuchsia-500/15 via-white/5 to-violet-500/15 p-5 backdrop-blur">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/85">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
                  <CmsText cmsKey="myHub.statusFree" />
                </div>
                <CmsText
                  cmsKey="myHub.statusFreeTitle"
                  as="p"
                  className="mt-2 text-[20px] font-semibold text-white sm:text-[19px]"
                />
                <CmsText
                  cmsKey="myHub.statusFreeBody"
                  as="p"
                  className="mt-1 text-[18px] leading-[1.55] text-white/75 sm:text-[16px]"
                />
              </div>
              {/* CTA bumped from h-10/text-sm to h-12/text-base + bolder
                  shadow per Itzik 2026-05-06 — the free-tier user needs
                  one obvious next step, not a quiet pill. */}
              <Link
                href="/pricing"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-white px-6 text-[16px] font-semibold text-fuchsia-700 shadow-lg hover:bg-white/95 hover:shadow-xl transition"
              >
                <CmsText cmsKey="myHub.seePricing" />
              </Link>
            </div>
          ) : entitlements.pillarCount === 3 ? (
            <div className="rounded-2xl border border-emerald-300/40 bg-emerald-400/10 p-5 backdrop-blur">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    <CmsText cmsKey="myHub.statusAllAccess" />
                  </div>
                  <CmsText
                    cmsKey="myHub.statusAllAccessSubFull"
                    as="p"
                    className="mt-2 text-[18px] font-semibold text-white sm:text-[16px]"
                  />
                  <p className="mt-1 text-[16px] text-emerald-100/85 sm:text-sm">
                    <CmsText cmsKey="myHub.statusAllAccessSub" />
                  </p>
                </div>
              </div>

              {/* PartnerShareCard moved to top-of-page partner status
                  section above (Itzik 2026-05-27). */}
            </div>
          ) : (
            <div className="rounded-2xl border border-fuchsia-300/30 bg-fuchsia-400/10 p-5 backdrop-blur">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/40 bg-fuchsia-500/25 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-fuchsia-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-300" />
                    <CmsText cmsKey="myHub.statusActiveMember" />
                  </div>
                  <p className="mt-2 text-[18px] font-semibold text-white sm:text-[16px]">
                    {t("activeMemberPillarsTemplate").replace(
                      "{count}",
                      String(entitlements.pillarCount),
                    )}
                  </p>
                  <p className="mt-1 text-[16px] text-fuchsia-100/80 sm:text-sm">
                    {(() => {
                      const owned: string[] = [];
                      const missing: string[] = [];
                      if (entitlements.games) owned.push(t("entitlementGames"));
                      else missing.push(t("entitlementGames"));
                      if (entitlements.journey) owned.push(t("entitlementJourney"));
                      else missing.push(t("entitlementJourney"));
                      if (entitlements.adults) owned.push(t("entitlementAdults"));
                      else missing.push(t("entitlementAdults"));
                      return t("activeMemberDetailsTemplate")
                        .replace("{owned}", owned.join(", "))
                        .replace("{missing}", missing.join(", "));
                    })()}
                  </p>
                </div>
                <Link
                  href="/pricing"
                  className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
                >
                  <CmsText cmsKey="myHub.upgradePlan" />
                </Link>
              </div>

              {/* PartnerShareCard moved to top-of-page partner status
                  section above (Itzik 2026-05-27). */}
            </div>
          )}
        </section>

        {/* ─────── Cross-sell: games-only users get a Journey upgrade nudge ───────
            2026-05-22: Itzik consolidated subscriptions to weekly-only and
            made Journey grant unrestricted Adults access on top of every
            games title. Surface a one-line nudge for users currently on
            just the games plan so they know the upgrade path exists. The
            indicator webhook handles the games-sub cancellation
            automatically the moment the Journey checkout completes. */}
        {entitlements.games && !entitlements.journey ? (
          <UpgradeToJourneyCard isHe={isHe} />
        ) : null}

        {/* Per spec §5.2 - the "Got a code from partner?" panel was moved
            BELOW the pillar cards. Cards come first (the products), partner
            stuff comes second (the relationship plumbing). */}

        {/* Profile-completion + redeem-code banners moved BELOW the
            pillar grid per Itzik 2026-05-07 — see the section right
            after the pillar grid ends (line ~490+). */}

        {/* ─────── The three pillars ─────── */}
        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* Games pillar */}
          {entitlements.games ? (
            <EntitledPillar
              isHe={isHe}
              pillar="games"
              pillarState={gamesPillar}
              title={t("pillarGamesTitle")}
              description={t("cardGamesLede")}
              notificationAriaTemplate={t("notificationAria")}
            />
          ) : (
            <PillarMarketing
              isHe={isHe}
              pillar="games"
              pillarState={gamesPillar}
              title={t("pillarGamesTitle")}
              tagline={t("cardGamesBuyLede")}
            />
          )}

          {/* Journey pillar */}
          {entitlements.journey ? (
            <EntitledPillar
              isHe={isHe}
              pillar="journey"
              pillarState={journeyPillar}
              title={t("pillarJourneyTitle")}
              subtitle={t("pillarJourneySubtitle")}
              description={t("cardJourneyOwnerLede")}
              notificationCount={journeyNotificationCount}
              notificationAriaTemplate={t("notificationAria")}
            />
          ) : (
            <PillarMarketing
              isHe={isHe}
              pillar="journey"
              pillarState={journeyPillar}
              title={t("pillarJourneyTitle")}
              subtitle={t("pillarJourneySubtitle")}
              tagline={t("cardJourneyBuyLede")}
            />
          )}

          {/* Adults pillar */}
          {entitlements.adults ? (
            <EntitledPillar
              isHe={isHe}
              pillar="adults"
              pillarState={adultsPillar}
              title={t("pillarAdultsEntitledTitle")}
              description={`${ownedCount} ${
                ownedCount === 1
                  ? t("adultsOwnedSingular")
                  : t("adultsOwnedPlural")
              }`}
              notificationAriaTemplate={t("notificationAria")}
            />
          ) : (
            <PillarMarketing
              isHe={isHe}
              pillar="adults"
              pillarState={adultsPillar}
              title={t("pillarAdultsMarketingTitle")}
              tagline={t("cardAdultsBuyLede")}
            />
          )}
        </section>

        {/* ─────── Profile-completion + redeem-code (Itzik 2026-05-07) ───
            These two banners now sit in ONE row directly under the
            services pillars — two equal columns on desktop, stacked
            on mobile. Each column renders only when its condition is
            met:
              • Profile-completion → only journey customers (pairing
                a partner is the action that requires it).
              • "Got a code from partner?" → only users without a
                couple yet.
            If neither condition holds, the section renders nothing. */}
        {(entitlements.journey && profileIncomplete) || !hasCouple ? (
          <section className="mt-8 grid gap-4 sm:grid-cols-2">
            {entitlements.journey && profileIncomplete ? (
              <div className="flex flex-col justify-between gap-3 rounded-2xl border border-amber-300/40 bg-amber-400/10 p-5">
                <div>
                  <p className="text-[16px] font-semibold text-amber-100">
                    <CmsText cmsKey="myHub.completeProfile" />
                  </p>
                  <CmsText
                    cmsKey="myHub.pairProfilePrereq"
                    as="p"
                    className="mt-1.5 text-[14px] leading-[1.55] text-amber-100/85"
                  />
                </div>
                <Link
                  href={`/account/profile?reason=profile_incomplete&next=${encodeURIComponent("/my")}`}
                  className="inline-flex min-h-[44px] items-center justify-center self-start rounded-full bg-white px-5 text-[15px] font-semibold text-amber-700 shadow hover:bg-amber-50 transition"
                >
                  <CmsText cmsKey="myHub.completeNow" />
                </Link>
              </div>
            ) : null}
            {!hasCouple ? (
              <div className="flex flex-col justify-between gap-3 rounded-2xl border border-white/15 bg-white/[0.05] p-5">
                <div>
                  <p className="text-[16px] font-semibold text-white">
                    <CmsText cmsKey="myHub.gotCode" />
                  </p>
                  <CmsText
                    cmsKey="myHub.redeemHint"
                    as="p"
                    className="mt-1.5 text-[14px] leading-[1.55] text-white/75"
                  />
                </div>
                <RedeemCodeButton
                  isHe={isHe}
                  variant="primary"
                  label={
                    isHe
                      ? "הזן את קוד ההזמנה שקיבלת"
                      : "Enter the invite code you received"
                  }
                  redirectTo="/my/lessons"
                />
              </div>
            ) : null}
          </section>
        ) : null}

        {/* ─────── Quick links footer (per spec §5.3) ───────
            One link to the existing /account page, which already bundles
            subscription details + charges/invoices + profile + partner
            management. Per spec §9 the user wanted this surface to
            consolidate the admin-y bits - and /account already does. */}
        <footer className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t border-white/5 pt-8 text-sm">
          <Link
            href="/account"
            className="inline-flex items-center gap-1.5 text-white/55 transition hover:text-white"
          >
            <Users className="h-3.5 w-3.5" />
            <CmsText cmsKey="myHub.footerAccountLink" />
          </Link>
        </footer>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pillar visual identity (2026-05-06 redesign per Itzik):
//
// Each pillar gets its own colour DNA so the three cards read as three
// distinct products instead of three identical glass panels. The CTA is
// now a real *button* (filled background, pill-shaped, prominent shadow)
// rather than a small "→" link buried at the bottom corner.
//
// Per pillar:
//   • games   - fuchsia/rose: the playful, bright, energetic surface
//   • journey - emerald/teal: the calm, clinical, healing surface
//   • adults  - amber/rose:   the intimate, warm, candlelit surface
//
// The whole card stays clickable (the outer <Link>) for affordance, but
// the visual button inside is what tells the user "press here". The
// arrow only translates on hover - no autoplay animations.
// ─────────────────────────────────────────────────────────────────────────────

const PILLAR_THEMES: Record<
  PillarKey,
  {
    Icon: typeof Gamepad2;
    iconWrapEntitled: string;   // background colour for the icon plate (entitled)
    iconWrapMarketing: string;  // softer version for marketing
    cardEntitled: string;       // outer card border + bg (entitled)
    cardMarketing: string;      // outer card border + bg (marketing)
    cardGlow: string;           // soft halo behind the icon (entitled only)
    button: string;             // CTA button background (entitled)
    buttonMarketing: string;    // CTA button background (marketing)
  }
> = {
  games: {
    Icon: Gamepad2,
    iconWrapEntitled:
      "bg-gradient-to-br from-fuchsia-500 to-rose-500 text-white shadow-[0_8px_24px_-8px_rgba(232,72,153,0.7)]",
    iconWrapMarketing:
      "bg-fuchsia-500/15 text-fuchsia-200 ring-1 ring-fuchsia-300/25",
    /* Entitled gradient bumped 10/3/10 → 22/8/22 per Itzik 2026-05-07 —
       owned pillars now have a clearly stronger fill so the user sees
       "I have this" at a glance, not just "this is a card". */
    cardEntitled:
      "border-fuchsia-300/45 bg-gradient-to-br from-fuchsia-500/[0.22] via-white/[0.08] to-rose-500/[0.22] hover:border-fuchsia-300/60",
    cardMarketing:
      "border-white/10 bg-white/[0.03] hover:border-fuchsia-300/30 hover:bg-fuchsia-500/[0.06]",
    cardGlow:
      "bg-gradient-to-br from-fuchsia-500/40 via-rose-500/20 to-transparent",
    button:
      "bg-gradient-to-r from-fuchsia-500 to-rose-500 text-white shadow-[0_10px_28px_-10px_rgba(232,72,153,0.8)] hover:brightness-110",
    buttonMarketing:
      "border border-fuchsia-300/40 bg-fuchsia-500/15 text-fuchsia-50 hover:bg-fuchsia-500/25 hover:border-fuchsia-300/60",
  },
  journey: {
    Icon: Compass,
    iconWrapEntitled:
      "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-[0_8px_24px_-8px_rgba(16,185,129,0.7)]",
    iconWrapMarketing:
      "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-300/25",
    cardEntitled:
      "border-emerald-300/45 bg-gradient-to-br from-emerald-500/[0.22] via-slate-900/45 to-teal-500/[0.22] hover:border-emerald-300/60",
    cardMarketing:
      "border-slate-300/[0.08] bg-slate-950/40 hover:border-emerald-300/25 hover:bg-emerald-500/[0.05]",
    cardGlow:
      "bg-gradient-to-br from-emerald-500/40 via-teal-500/20 to-transparent",
    button:
      "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_10px_28px_-10px_rgba(16,185,129,0.8)] hover:brightness-110",
    buttonMarketing:
      "border border-emerald-300/40 bg-emerald-500/15 text-emerald-50 hover:bg-emerald-500/25 hover:border-emerald-300/60",
  },
  adults: {
    Icon: Flame,
    iconWrapEntitled:
      "bg-gradient-to-br from-amber-500 to-rose-600 text-white shadow-[0_8px_24px_-8px_rgba(244,114,182,0.7)]",
    iconWrapMarketing:
      "bg-amber-500/15 text-amber-200 ring-1 ring-amber-300/25",
    cardEntitled:
      "border-amber-300/45 bg-gradient-to-br from-amber-500/[0.22] via-white/[0.08] to-rose-500/[0.22] hover:border-amber-300/60",
    cardMarketing:
      "border-white/10 bg-white/[0.03] hover:border-amber-300/25 hover:bg-amber-500/[0.06]",
    cardGlow:
      "bg-gradient-to-br from-amber-500/40 via-rose-500/20 to-transparent",
    button:
      "bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow-[0_10px_28px_-10px_rgba(244,114,182,0.8)] hover:brightness-110",
    buttonMarketing:
      "border border-amber-300/40 bg-amber-500/15 text-amber-50 hover:bg-amber-500/25 hover:border-amber-300/60",
  },
};

// Shared button class - pill-shaped, h-11, used for both entitled and
// marketing CTAs (the per-pillar `button` / `buttonMarketing` strings
// only supply colour and shadow). The base gap grows on hover for a
// direction-agnostic forward-motion feel that works the same in RTL
// and LTR (without depending on `rtl:` / `ltr:` Tailwind variants).
// Per Itzik 2026-05-06: pillar CTA was "getting lost" on the dashboard.
// Bumped from h-11/text-sm/font-bold to h-12/text-base/font-semibold +
// shadow on hover so the discover-the-rest action is unmistakable.
const PILLAR_BUTTON_BASE =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition group-hover:gap-3 shadow-md group-hover:shadow-lg";

// ─── EntitledPillar - "you have access" ──────────────────────────────────────

function EntitledPillar({
  isHe,
  pillar,
  pillarState,
  title,
  subtitle,
  description,
  notificationCount,
  notificationAriaTemplate,
}: {
  isHe: boolean;
  pillar: PillarKey;
  pillarState: PillarStateOutput;
  title: string;
  subtitle?: string;
  description: string;
  notificationCount?: number;
  // Template with {n} placeholder — provided by the parent so the
  // aria-label can be CMS-edited per locale.
  notificationAriaTemplate?: string;
}) {
  const Arrow = isHe ? ArrowLeft : ArrowRight;
  const hasNotif = typeof notificationCount === "number" && notificationCount > 0;
  const theme = PILLAR_THEMES[pillar];
  const Icon = theme.Icon;

  return (
    <Link
      href={pillarState.ctaHref}
      data-pillar={pillar}
      className={[
        "group relative flex flex-col justify-between gap-6 overflow-hidden rounded-3xl border p-6 transition",
        "min-h-[260px]",
        theme.cardEntitled,
      ].join(" ")}
    >
      {/* halo behind the icon plate, accent-coloured per pillar */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -top-12 end-[-3rem] h-44 w-44 rounded-full opacity-50 blur-3xl ${theme.cardGlow}`}
      />

      {hasNotif ? (
        <span
          aria-label={
            notificationAriaTemplate
              ? notificationAriaTemplate.replace(
                  "{n}",
                  String(notificationCount),
                )
              : String(notificationCount)
          }
          className="absolute end-4 top-4 z-10 inline-flex min-w-[24px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-bold text-white shadow-[0_6px_18px_-4px_rgba(244,63,94,0.7)]"
        >
          {notificationCount}
        </span>
      ) : null}

      <div className="relative">
        <div className="flex items-start gap-3">
          <span
            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${theme.iconWrapEntitled}`}
            aria-hidden
          >
            <Icon className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <StateBadge state={pillarState.state} isHe={isHe} />
            </div>
            <h3 className="mt-1.5 font-heading text-[34px] font-bold leading-tight tracking-tight text-white sm:text-[28px]">
              {title}
            </h3>
            {subtitle ? (
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-white/55">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        <p className="mt-4 line-clamp-3 text-[18px] leading-relaxed text-white/75 sm:text-[16px]">
          {description}
        </p>
      </div>

      <span
        className={`${PILLAR_BUTTON_BASE} ${theme.button} self-start`}
      >
        {pillarState.ctaLabel}
        <Arrow className="h-4 w-4 shrink-0" />
      </span>
    </Link>
  );
}

// ─── PillarMarketing - "not yet" CTA ─────────────────────────────────────────

function PillarMarketing({
  isHe,
  pillar,
  pillarState,
  title,
  subtitle,
  tagline,
}: {
  isHe: boolean;
  pillar: PillarKey;
  pillarState: PillarStateOutput;
  title: string;
  subtitle?: string;
  tagline: string;
}) {
  const Arrow = isHe ? ArrowLeft : ArrowRight;
  const theme = PILLAR_THEMES[pillar];
  const Icon = theme.Icon;

  return (
    <Link
      href={pillarState.ctaHref}
      data-pillar={pillar}
      className={[
        "group relative flex flex-col justify-between gap-6 overflow-hidden rounded-3xl border p-6 transition",
        "min-h-[260px]",
        theme.cardMarketing,
      ].join(" ")}
    >
      <div className="relative">
        <div className="flex items-start gap-3">
          <span
            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${theme.iconWrapMarketing}`}
            aria-hidden
          >
            <Icon className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <StateBadge state={pillarState.state} isHe={isHe} />
            </div>
            <h3 className="mt-1.5 font-heading text-[34px] font-bold leading-tight tracking-tight text-white sm:text-[28px]">
              {title}
            </h3>
            {subtitle ? (
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-white/45">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        {/* Tagline: bumped from 15px to 18px per Itzik 2026-05-06 — body
            text floor on the dashboard is the same as the homepage. */}
        <p className="mt-4 text-[18px] leading-[1.55] text-white/80">
          {tagline}
        </p>
      </div>

      <span
        className={`${PILLAR_BUTTON_BASE} ${theme.buttonMarketing} self-start`}
      >
        {pillarState.ctaLabel}
        <Arrow className="h-5 w-5 shrink-0" />
      </span>
    </Link>
  );
}
