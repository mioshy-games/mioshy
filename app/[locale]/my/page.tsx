import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Link } from "@/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Library,
  Sparkles,
  Users,
} from "lucide-react";
import {
  getCurrentCoupleContext,
  listOwnedGamesForCouple,
} from "@/lib/between-us/couples";
import {
  getPendingInvitationForCouple,
  toInvitationUiSummary,
} from "@/lib/between-us/invitations";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import { getOwnerJourneyStatus } from "@/lib/journey-content/owner-status";
import { countUnreadJourneyItems } from "@/lib/journey-content/unread";
import { getFreshClinicianReplies } from "@/lib/journey-content/fresh-replies";
import { getProfileGate } from "@/lib/auth/profile-gate";
import { PairCodeWidget } from "@/components/between-us/PairCodeWidget";
import { RedeemCodeButton } from "@/components/between-us/RedeemCodeButton";
import { InvitePartnerByEmail } from "@/components/between-us/InvitePartnerByEmail";
import type { PillarKey } from "@/lib/entitlements/getUserEntitlements";
import {
  derivePillarState,
  type AssessmentStage,
  type PillarStateOutput,
} from "@/lib/dashboard/pillar-state";
import { StateBadge } from "@/components/ui/StateBadge";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const isHe = params.locale === "he";
  return {
    title: `Mioshy - ${isHe ? "מיאושי שלי" : "My Mioshy"}`,
    description: isHe
      ? "שלושת עולמות מיאושי במקום אחד - משחקים, ליווי ולמבוגרים בלבד."
      : "The three worlds of Mioshy in one place - games, journey, adults only.",
  };
}

export default async function MyHubPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams?: { purchased?: string };
}) {
  const { locale } = params;
  const isHe = locale === "he";

  // Post-purchase shortcut — when the billing-success page sends users back
  // to /my?purchased=<game_id> after an Adults purchase, we drop them
  // straight into /my/adults instead of showing a celebration banner.
  // Per spec: "User wants to use, not celebrate."
  const purchasedQuery = searchParams?.purchased ?? null;
  if (purchasedQuery) {
    redirect(`/${locale}/my/adults`);
  }

  const ctx = await getCurrentCoupleContext();
  if (!ctx) redirect(`/${locale}/auth`);

  const entitlements = await getUserEntitlements(ctx.user_id);
  if (!entitlements) redirect(`/${locale}/auth`);

  // (Removed temporary diagnostic logs from the billing-debug session.
  // The pillar logic is now derived from a pure helper —
  // lib/dashboard/pillar-state.ts — so we don't need to dump raw
  // subscription rows from this page anymore.)

  // Coaching pillar notification — TWO sources combined:
  //   a. unread content items (countUnreadJourneyItems)
  //   b. recent clinician replies (getFreshClinicianReplies, 30-day window)
  //
  // We sum both into a single dot on the pillar card. The user just
  // wants to know "is there something new for me?" — not "of what kind?".
  // The detail (item vs. reply) shows up inside /my/journey.
  const [unreadJourneyCount, freshReplies] = await Promise.all([
    countUnreadJourneyItems({
      userId: ctx.user_id,
      coupleId: ctx.couple_id,
    }).catch(() => 0),
    getFreshClinicianReplies(ctx.user_id).catch(() => ({
      latestReplyAt: null,
      recentReplyCount: 0,
      latestReplyHref: null,
    })),
  ]);
  const journeyNotificationCount =
    unreadJourneyCount + freshReplies.recentReplyCount;

  // Journey pillar - decide whether the "Open" CTA should go to the live
  // timeline, to Resume Assessment, or to the marketing hub. This is the
  // only state that isn't already encoded in entitlements.
  const journeyStatus = await getOwnerJourneyStatus({
    userId: ctx.user_id,
    coupleId: ctx.couple_id,
  });

  // Pull couple + adults context (still relevant for the adults panel)
  const hasCouple = !!ctx.couple_id;
  const owned = hasCouple
    ? await listOwnedGamesForCouple(ctx.couple_id as string)
    : [];
  const ownedCount = owned.length;

  const profileGate = await getProfileGate();
  const profileIncomplete = !!profileGate && !profileGate.complete;

  const pendingInvitation = hasCouple
    ? toInvitationUiSummary(
        await getPendingInvitationForCouple(ctx.couple_id as string).catch(
          () => null,
        ),
      )
    : null;
  const needsPartner = hasCouple && (ctx.partner_count ?? 0) < 2;
  const isOwner = !hasCouple || ctx.role === "owner";

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

  // ─── Diagnostic log — prints once per render, server-side only ────
  // Surfaces in Vercel logs the exact state we're showing the user.
  // Helps reproduce reports like "I subscribed but the page treats
  // me as a guest" — we can correlate user_id to the resolved state.
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
        {/* ─────── Page title ─────── */}
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-fuchsia-200" />
              <span className="text-white/85">
                {isHe ? "החשבון שלך" : "Your account"}
              </span>
            </div>
            <h1 className="mt-3 flex items-center gap-3 text-4xl font-bold tracking-tight sm:text-5xl">
              <Library className="h-8 w-8 text-fuchsia-300 sm:h-10 sm:w-10" />
              {isHe ? "מיאושי שלי" : "My Mioshy"}
            </h1>
            <p className="mt-3 max-w-xl text-white/70">
              {isHe
                ? "שלושה שירותים, כל אחד בנפרד. פותחים את מה שרכשתם - ומכאן אפשר לגלות את השאר."
                : "Three services, each on its own. Open what you own - and discover the rest from here."}
            </p>
          </div>

          {/* Account + invoices intentionally moved to a quiet quick-links
              row at the BOTTOM of the page. Per spec §5.3: the dashboard is
              about products, not admin chrome. Admin lives in /my/account. */}
        </section>

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
                  {isHe ? "סטטוס: חינם" : "Status: Free"}
                </div>
                <p className="mt-2 text-sm font-semibold text-white">
                  {isHe
                    ? "החשבון שלך פעיל - אין עדיין מנוי בתשלום."
                    : "Your account is active — no paid plan yet."}
                </p>
                <p className="mt-1 text-sm text-white/70">
                  {isHe
                    ? "בחרו מסלול והתחילו לשחק, ללוות, או להזמין משחק למבוגרים בלבד."
                    : "Pick a plan and start playing, get coached, or order an adults-only game."}
                </p>
              </div>
              <Link
                href="/pricing"
                className="inline-flex min-h-[40px] items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-fuchsia-700 shadow hover:bg-white/90"
              >
                {isHe ? "לראות מחירים" : "See pricing"}
              </Link>
            </div>
          ) : entitlements.pillarCount === 3 ? (
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-emerald-300/40 bg-emerald-400/10 p-5 backdrop-blur">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  {isHe ? "סטטוס: הכל פתוח" : "Status: Full access"}
                </div>
                <p className="mt-2 text-sm font-semibold text-white">
                  {isHe
                    ? "המנוי שלך מקיף את כל מיאושי - משחקים, ליווי, ולמבוגרים בלבד."
                    : "Your plan covers all of Mioshy — games, journey, and adults only."}
                </p>
                <p className="mt-1 text-sm text-emerald-100/85">
                  {isHe ? "תהנו." : "Enjoy."}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-fuchsia-300/30 bg-fuchsia-400/10 p-5 backdrop-blur">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/40 bg-fuchsia-500/25 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-fuchsia-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-300" />
                  {isHe ? "סטטוס: מנוי פעיל" : "Status: Active member"}
                </div>
                <p className="mt-2 text-sm font-semibold text-white">
                  {isHe
                    ? `יש לכם גישה ל-${entitlements.pillarCount} מתוך 3 השירותים שלנו.`
                    : `You have access to ${entitlements.pillarCount} of our 3 services.`}
                </p>
                <p className="mt-1 text-sm text-fuchsia-100/80">
                  {(() => {
                    const owned: string[] = [];
                    const missing: string[] = [];
                    if (entitlements.games) owned.push(isHe ? "משחקים" : "Games");
                    else missing.push(isHe ? "משחקים" : "Games");
                    if (entitlements.journey) owned.push(isHe ? "ליווי" : "Journey");
                    else missing.push(isHe ? "ליווי" : "Journey");
                    if (entitlements.adults) owned.push(isHe ? "למבוגרים בלבד" : "Adults only");
                    else missing.push(isHe ? "למבוגרים בלבד" : "Adults only");
                    return isHe
                      ? `פעיל: ${owned.join(", ")}. אפשר להוסיף: ${missing.join(", ")}.`
                      : `Active: ${owned.join(", ")}. Add: ${missing.join(", ")}.`;
                  })()}
                </p>
              </div>
              <Link
                href="/pricing"
                className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
              >
                {isHe ? "לשדרג מסלול" : "Upgrade plan"}
              </Link>
            </div>
          )}
        </section>

        {/* Per spec §5.2 — the "Got a code from partner?" panel was moved
            BELOW the pillar cards. Cards come first (the products), partner
            stuff comes second (the relationship plumbing). */}

        {/* ─────── Profile completeness nudge ─────── */}
        {profileIncomplete ? (
          <section className="mt-8">
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-amber-300/40 bg-amber-400/10 p-5 backdrop-blur">
              <div className="text-sm text-amber-100">
                <p className="font-semibold">
                  {isHe ? "השלימו את הפרופיל" : "Complete your profile"}
                </p>
                <p className="mt-1 text-amber-100/85">
                  {isHe
                    ? "כדי לצמד פרטנר/ית, להזין קוד או להתחיל משחק - צריך שם מלא, נייד וסיסמה."
                    : "To pair a partner, redeem a code or start a game, add your full name, mobile, and password."}
                </p>
              </div>
              <Link
                href={`/account/profile?reason=profile_incomplete&next=${encodeURIComponent(
                  "/my",
                )}`}
                className="inline-flex min-h-[40px] items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-amber-700 shadow hover:bg-amber-50"
              >
                {isHe ? "להשלמה" : "Complete now"}
              </Link>
            </div>
          </section>
        ) : null}

        {/* ─────── The three pillars ─────── */}
        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* Games pillar */}
          {entitlements.games ? (
            <EntitledPillar
              isHe={isHe}
              pillar="games"
              pillarState={gamesPillar}
              titleHe="משחקים לזוגות"
              titleEn="Games for couples"
              description={
                isHe
                  ? "כנות ואתגר, גלגל הזוגיות, סולמות ונחשים."
                  : "Truth or dare, wheel, snakes & ladders."
              }
            />
          ) : (
            <PillarMarketing
              isHe={isHe}
              pillar="games"
              pillarState={gamesPillar}
              titleHe="משחקים לזוגות"
              titleEn="Games for couples"
              tagline={
                isHe
                  ? "כנות ואתגר, גלגל הזוגיות, סולמות ונחשים — משחקים שמרעננים את הקשר בערב אחד."
                  : "Truth & dare, the wheel, snakes & ladders — couples games that refresh your connection in a single evening."
              }
            />
          )}

          {/* Journey pillar */}
          {entitlements.journey ? (
            <EntitledPillar
              isHe={isHe}
              pillar="journey"
              pillarState={journeyPillar}
              titleHe="ליווי עם מיאושי"
              titleEn="Journey with Mioshy"
              subtitleHe="תוכנית עבודה אישית"
              subtitleEn="Personal work program"
              description={
                isHe
                  ? "הקליניקה המכווננת שלכם — תוכן שמסודר לפי מה שחשוב לכם, כל אחד עם הסדר שלו."
                  : "Your tuned clinic — content ordered by what matters to you, each partner sees their own ranking."
              }
              notificationCount={journeyNotificationCount}
            />
          ) : (
            <PillarMarketing
              isHe={isHe}
              pillar="journey"
              pillarState={journeyPillar}
              titleHe="ליווי עם מיאושי"
              titleEn="Journey with Mioshy"
              subtitleHe="תוכנית עבודה אישית"
              subtitleEn="Personal work program"
              tagline={
                isHe
                  ? "אבחון אישי + ליווי מומחים מבוסס על שבעת עקרונות הקשר הבריא."
                  : "Personal assessment + expert guidance built on seven principles of healthy partnership."
              }
            />
          )}

          {/* Adults pillar */}
          {entitlements.adults ? (
            <EntitledPillar
              isHe={isHe}
              pillar="adults"
              pillarState={adultsPillar}
              titleHe="למבוגרים בלבד"
              titleEn="Adults Only"
              description={
                isHe
                  ? `${ownedCount} ${
                      ownedCount === 1 ? "משחק" : "משחקים"
                    } פתוחים לשניכם.`
                  : `${ownedCount} game${ownedCount === 1 ? "" : "s"} unlocked for the two of you.`
              }
            />
          ) : (
            <PillarMarketing
              isHe={isHe}
              pillar="adults"
              pillarState={adultsPillar}
              titleHe="למבוגרים בלבד"
              titleEn="Adults Only"
              tagline={
                isHe
                  ? "משחקי זוגיות אינטימיים יותר — תכנים מותאמים, פרטיות מלאה."
                  : "More intimate couples games — curated content, full privacy."
              }
            />
          )}
        </section>

        {/* ─────── Partner section — only when relevant ───────
            Per spec §5.2: invite-partner shows ONLY if user has no
            partner yet. Once a partner has joined, the whole block
            disappears. Above the "got code from partner" alert because
            most signed-in users are senders, not receivers, of codes. */}
        {hasCouple && needsPartner ? (
          <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-white">
                  {isHe ? "הזמינו את בן/בת הזוג" : "Invite your partner"}
                </h3>
                <p className="mt-1 text-xs text-white/60">
                  {isHe
                    ? "שלחו הזמנה במייל. ברגע שיצטרפו, הזמן הזה ייעלם מהדשבורד."
                    : "Send an email invitation. Once they join, this section disappears."}
                </p>
              </div>
              <div className="w-full sm:w-auto">
                <InvitePartnerByEmail
                  locale={isHe ? "he" : "en"}
                  isHe={isHe}
                  invitation={pendingInvitation}
                  canInvite={isOwner}
                />
              </div>
            </div>

            {/* Pair code — for cross-device play. Shown alongside the
                invite (not as a separate section) so the "couple plumbing"
                lives in one place. */}
            {ctx.pair_code ? (
              <div className="mt-4 border-t border-white/5 pt-4">
                <p className="text-[11px] uppercase tracking-wider text-white/45">
                  {isHe
                    ? "קוד משחק (למכשיר שני)"
                    : "Game session code (second device)"}
                </p>
                <div className="mt-2">
                  <PairCodeWidget
                    pairCode={ctx.pair_code}
                    isHe={isHe}
                    compact
                  />
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* ─────── "Got a code from partner?" — only for users without
            a couple yet. Compact version, below the cards per spec §5.2. */}
        {!hasCouple ? (
          <section className="mt-8">
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">
                  {isHe ? "קיבלתם קוד מבן/בת הזוג?" : "Got a code from your partner?"}
                </p>
                <p className="mt-0.5 text-xs text-white/60">
                  {isHe
                    ? "הזינו את הקוד והחשבון יתחבר אליהם מיד."
                    : "Enter the code and your account links to theirs instantly."}
                </p>
              </div>
              <RedeemCodeButton
                isHe={isHe}
                variant="primary"
                redirectTo={`/${locale}/my`}
              />
            </div>
          </section>
        ) : null}

        {/* ─────── Quick links footer (per spec §5.3) ───────
            One link to the existing /account page, which already bundles
            subscription details + charges/invoices + profile + partner
            management. Per spec §9 the user wanted this surface to
            consolidate the admin-y bits — and /account already does. */}
        <footer className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t border-white/5 pt-8 text-sm">
          <Link
            href="/account"
            className="inline-flex items-center gap-1.5 text-white/55 transition hover:text-white"
          >
            <Users className="h-3.5 w-3.5" />
            {isHe
              ? "החשבון שלי · חשבוניות · ניהול מנוי"
              : "My account · invoices · subscription"}
          </Link>
        </footer>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EntitledPillar — compact "you have access" card.
//
// MVP version (Day 1):
//   - StateBadge replaces the old inline "Active" pill
//   - CTA copy + href come from derivePillarState (single source of truth)
//   - Optional subtitle line for the Journey card ("תוכנית עבודה אישית")
//   - Notification dot kept (rose-500). The "white flashing" reported on
//     the Games card was traced to the badge showing 0/undefined as a
//     blank pill — fixed by gating on `> 0` only and removing the
//     accidental shadow that bled through.
// ─────────────────────────────────────────────────────────────────────────────

function EntitledPillar({
  isHe,
  pillar,
  pillarState,
  titleHe,
  titleEn,
  subtitleHe,
  subtitleEn,
  description,
  notificationCount,
}: {
  isHe: boolean;
  pillar: PillarKey;
  pillarState: PillarStateOutput;
  titleHe: string;
  titleEn: string;
  subtitleHe?: string;
  subtitleEn?: string;
  description: string;
  notificationCount?: number;
}) {
  const Arrow = isHe ? ArrowLeft : ArrowRight;
  const title = isHe ? titleHe : titleEn;
  const subtitle = subtitleHe || subtitleEn ? (isHe ? subtitleHe : subtitleEn) : null;
  // STRICT > 0 — a falsy / zero / undefined value here used to render an
  // empty pill that white-flashed on first paint. Now the element only
  // renders when there really is a count.
  const hasNotif = typeof notificationCount === "number" && notificationCount > 0;

  // Journey gets a slightly cooler glass treatment (per spec §1.5 — the
  // calm, clinical feel). Other pillars keep the existing fuchsia-tinted
  // glass.
  const surfaceClass =
    pillar === "journey"
      ? "border-slate-300/[0.08] bg-slate-950/40 hover:border-slate-300/[0.18]"
      : "border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.06]";

  return (
    <Link
      href={pillarState.ctaHref}
      className={[
        "group relative flex flex-col justify-between gap-5 overflow-hidden rounded-2xl border p-5 transition",
        surfaceClass,
      ].join(" ")}
      data-pillar={pillar}
    >
      {hasNotif ? (
        <span
          aria-label={
            isHe ? `${notificationCount} חדשים` : `${notificationCount} new`
          }
          className="absolute end-3 top-3 z-10 inline-flex min-w-[22px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white"
        >
          {notificationCount}
        </span>
      ) : null}

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StateBadge state={pillarState.state} isHe={isHe} />
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>
        {subtitle ? (
          <p className="mt-1 text-xs text-white/55">{subtitle}</p>
        ) : null}
        <p className="mt-2 line-clamp-2 text-sm text-white/65">{description}</p>
      </div>

      <span className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-white transition group-hover:gap-2.5">
        {pillarState.ctaLabel}
        <Arrow className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PillarMarketing — compact "you don't have access yet" card.
//
// Same shape as EntitledPillar but with a NOT_PURCHASED badge and a
// CTA to the marketing page. Replaces the bigger ServicePanel that was
// designed for the homepage; on the dashboard we want all three pillar
// cards to look uniform.
// ─────────────────────────────────────────────────────────────────────────────

function PillarMarketing({
  isHe,
  pillar,
  pillarState,
  titleHe,
  titleEn,
  subtitleHe,
  subtitleEn,
  tagline,
}: {
  isHe: boolean;
  pillar: PillarKey;
  pillarState: PillarStateOutput;
  titleHe: string;
  titleEn: string;
  subtitleHe?: string;
  subtitleEn?: string;
  tagline: string;
}) {
  const Arrow = isHe ? ArrowLeft : ArrowRight;
  const title = isHe ? titleHe : titleEn;
  const subtitle = subtitleHe || subtitleEn ? (isHe ? subtitleHe : subtitleEn) : null;

  const surfaceClass =
    pillar === "journey"
      ? "border-slate-300/[0.06] bg-slate-950/30 hover:border-slate-300/[0.16]"
      : "border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]";

  return (
    <Link
      href={pillarState.ctaHref}
      className={[
        "group relative flex flex-col justify-between gap-5 overflow-hidden rounded-2xl border p-5 transition",
        surfaceClass,
      ].join(" ")}
      data-pillar={pillar}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StateBadge state={pillarState.state} isHe={isHe} />
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>
        {subtitle ? (
          <p className="mt-1 text-xs text-white/45">{subtitle}</p>
        ) : null}
        <p className="mt-2 line-clamp-3 text-sm text-white/55">{tagline}</p>
      </div>

      <span className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-white/85 transition group-hover:gap-2.5 group-hover:text-white">
        {pillarState.ctaLabel}
        <Arrow className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}
