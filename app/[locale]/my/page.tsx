import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Link } from "@/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  Gamepad2,
  Heart,
  Library,
  Receipt,
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
import { getProfileGate } from "@/lib/auth/profile-gate";
import { PairCodeWidget } from "@/components/between-us/PairCodeWidget";
import { RedeemCodeButton } from "@/components/between-us/RedeemCodeButton";
import { InvitePartnerByEmail } from "@/components/between-us/InvitePartnerByEmail";
import { ServicePanel } from "@/components/marketing/ServicePanel";
import type { PillarKey } from "@/lib/entitlements/getUserEntitlements";

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

  // ── DIAGNOSTIC LOGS ────────────────────────────────────────────────────
  // Dump everything the page reads from the DB so we can see exactly why
  // a paying user is getting routed into the marketing-panel branch.
  // Goes to the server console (Vercel logs / `next dev` terminal).
  // Remove once routing is verified.
  if (typeof window === "undefined") {
    const { createServiceRoleClient } = await import("@/lib/supabase-admin");
    const admin = createServiceRoleClient();
    if (admin) {
      const { data: allSubs } = await admin
        .from("subscriptions")
        .select(
          "id, user_id, email, product, plan, status, current_period_end, stripe_subscription_id, created_at",
        )
        .eq("user_id", ctx.user_id)
        .order("created_at", { ascending: false });
      const { data: allCharges } = await admin
        .from("subscription_charges")
        .select("id, status, amount, currency, created_at")
        .eq("user_id", ctx.user_id)
        .order("created_at", { ascending: false })
        .limit(5);
      const { data: coupleEnts } = ctx.couple_id
        ? await admin
            .from("couple_entitlements")
            .select("id, game_id, created_at")
            .eq("couple_id", ctx.couple_id)
        : { data: [] };
      console.log("[/my] DEBUG", {
        userId: ctx.user_id,
        email: entitlements.email,
        coupleId: ctx.couple_id,
        coupleRole: ctx.role,
        partnerCount: ctx.partner_count,
        // RAW SUB ROWS — every column, every status
        allSubscriptions: allSubs,
        // last 5 charges so we can correlate
        recentCharges: allCharges,
        // adults entitlements (couple-level)
        coupleEntitlements: coupleEnts,
        // computed flags
        entitlements: {
          games: entitlements.games,
          journey: entitlements.journey,
          adults: entitlements.adults,
          pillarCount: entitlements.pillarCount,
        },
      });
    }
  }
  // ── /DIAGNOSTIC LOGS ───────────────────────────────────────────────────

  // Coaching pillar notification badge — count unlocked items the user
  // hasn't opened or completed yet. Cheap query (≤ 4 round-trips, gated
  // on having any active assignment).
  const unreadJourneyCount = await countUnreadJourneyItems({
    userId: ctx.user_id,
    coupleId: ctx.couple_id,
  }).catch(() => 0);

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

  // Log the rendering decision per pillar so we can see what the user actually sees.
  console.log("[/my] PILLAR DECISIONS", {
    games: {
      branch: entitlements.games ? "EntitledPillar" : "ServicePanel(marketing)",
      href: entitlements.games ? "/my/games" : "/games",
    },
    journey: {
      branch: entitlements.journey ? "EntitledPillar" : "ServicePanel(marketing)",
      href: entitlements.journey
        ? journeyStatus.hasActiveAssignments
          ? "/journey/timeline"
          : journeyStatus.hasInProgressAssessment
            ? "/journey/assessment"
            : "/journey"
        : "/journey",
      journeyStatus: {
        hasActiveAssignments: journeyStatus.hasActiveAssignments,
        hasInProgressAssessment: journeyStatus.hasInProgressAssessment,
      },
      unreadCount: unreadJourneyCount,
    },
    adults: {
      branch: entitlements.adults ? "EntitledPillar" : "ServicePanel(marketing)",
      href: entitlements.adults ? "/my/adults" : "/adults",
      ownedCount,
    },
  });

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

          <div className="flex items-center gap-2">
            <Link
              href="/account/invoices"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <Receipt className="h-4 w-4" />
              {isHe ? "חשבוניות" : "Invoices"}
            </Link>
            <Link
              href="/account"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <Users className="h-4 w-4" />
              {isHe ? "חשבון" : "Account"}
            </Link>
          </div>
        </section>

        {/* (Adults purchase celebration removed — users are redirected
            straight to /my/adults at the top of this page now.) */}

        {/* ─────── Always-visible invite-code panel ─────── */}
        {!hasCouple ? (
          <section className="mt-8">
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-fuchsia-300/30 bg-fuchsia-500/10 p-5 backdrop-blur">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-fuchsia-300/40 bg-fuchsia-500/20">
                <Heart className="size-5 text-fuchsia-200" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">
                  {isHe ? "קיבלתם קוד מבן/בת הזוג?" : "Got a code from your partner?"}
                </p>
                <p className="mt-0.5 text-xs text-white/65">
                  {isHe
                    ? "הזינו את הקוד והחשבון שלכם יתחבר אליהם מיד — בלי להמתין, בלי רענון."
                    : "Enter the code and your account links to theirs instantly — no waiting, no refresh."}
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
        <section className="mt-10 grid gap-6 lg:grid-cols-3">
          {/* Games pillar */}
          {entitlements.games ? (
            <EntitledPillar
              isHe={isHe}
              pillar="games"
              titleHe="משחקים"
              titleEn="Games"
              Icon={Gamepad2}
              description={
                isHe
                  ? "גלגל האמת, נחשים ושלבים - והחברים שלהם."
                  : "Truth wheel, snakes & ladders - and their friends."
              }
              galleryHref="/my/games"
              accent="from-violet-500 via-fuchsia-500 to-cyan-500"
            />
          ) : (
            <ServicePanel
              isHe={isHe}
              pillar="games"
              titleHe="משחקים לזוגות"
              titleEn="Games for couples"
              tagline={
                isHe
                  ? "גלגל האמת, נחשים ושלבים - משחקים לזוגות שמרעננים את הקשר, בערב אחד."
                  : "Truth wheel, snakes & ladders, and more - couples games that refresh your connection in a single evening."
              }
              bullets={
                isHe
                  ? ["+5 משחקים", "עברית ואנגלית", "שני מכשירים"]
                  : ["5+ games", "Hebrew & English", "Two devices"]
              }
              badge="🎮"
              ctaHref="/games"
              ctaLabel={isHe ? "לגילוי המשחקים" : "Discover games"}
              compact
            />
          )}

          {/* Journey pillar */}
          {entitlements.journey ? (
            <EntitledPillar
              isHe={isHe}
              pillar="journey"
              titleHe="ליווי עם מיאושי"
              titleEn="Journey with Mioshy"
              Icon={Compass}
              description={
                journeyStatus.hasActiveAssignments
                  ? isHe
                    ? "המסלול הפעיל שלכם ממתין - המשיכו מאיפה שעצרתם."
                    : "Your live journey is waiting - pick up where you left off."
                  : journeyStatus.hasInProgressAssessment
                    ? isHe
                      ? "האבחון שלכם באמצע - חזרו להשלים אותו."
                      : "Your assessment is in progress - come back and finish it."
                    : isHe
                      ? "האבחון האישי שלכם + שלבים להמשך."
                      : "Your personal diagnostic + next steps."
              }
              galleryHref={
                journeyStatus.hasActiveAssignments
                  ? "/journey/timeline"
                  : journeyStatus.hasInProgressAssessment
                    ? "/journey/assessment"
                    : "/journey"
              }
              ctaLabelHe={
                journeyStatus.hasActiveAssignments
                  ? "לציר הזמן"
                  : journeyStatus.hasInProgressAssessment
                    ? "להמשך האבחון"
                    : "לגלריה"
              }
              ctaLabelEn={
                journeyStatus.hasActiveAssignments
                  ? "Open timeline"
                  : journeyStatus.hasInProgressAssessment
                    ? "Resume assessment"
                    : "Open gallery"
              }
              accent="from-teal-400 via-indigo-500 to-purple-500"
              notificationCount={unreadJourneyCount}
            />
          ) : (
            <ServicePanel
              isHe={isHe}
              pillar="journey"
              titleHe="ליווי עם מיאושי"
              titleEn="Journey with Mioshy"
              tagline={
                isHe
                  ? "אבחון מקצועי + תובנות אישיות לקשר שלכם - ליווי שמבוסס על שבעת עקרונות הקשר הבריא."
                  : "Professional diagnostic + personal insights for your relationship - guidance built on seven principles of healthy partnership."
              }
              bullets={
                isHe
                  ? ["40 שאלות", "דוח אישי", "המלצות מעשיות"]
                  : ["40 questions", "Personal report", "Practical guidance"]
              }
              badge="🧭"
              ctaHref="/journey"
              ctaLabel={isHe ? "להתחלת האבחון" : "Start the journey"}
              compact
            />
          )}

          {/* Adults pillar */}
          {entitlements.adults ? (
            <EntitledPillar
              isHe={isHe}
              pillar="adults"
              titleHe="למבוגרים בלבד"
              titleEn="Adults Only"
              Icon={Heart}
              description={
                isHe
                  ? `${ownedCount} ${
                      ownedCount === 1 ? "משחק" : "משחקים"
                    } פתוחים לשניכם.`
                  : `${ownedCount} game${ownedCount === 1 ? "" : "s"} unlocked for the two of you.`
              }
              galleryHref="/my/adults"
              ctaLabelHe="הרכישות שלי"
              ctaLabelEn="My purchases"
              accent="from-rose-500 via-red-500 to-amber-500"
            />
          ) : (
            <ServicePanel
              isHe={isHe}
              pillar="adults"
              titleHe="למבוגרים בלבד"
              titleEn="Adults Only"
              tagline={
                isHe
                  ? "משחקי זוגיות יותר אינטימיים - שלושה שלבי עוצמה, תכנים מותאמים, פרטיות מלאה."
                  : "More intimate couples games - three intensity tiers, curated content, full privacy."
              }
              bullets={
                isHe
                  ? ["מרגש", "מעורר", "18+"]
                  : ["Moving", "Exciting", "18+"]
              }
              badge="💜"
              ctaHref="/adults"
              ctaLabel={isHe ? "צפה במשחקים שלנו" : "View our games"}
              compact
            />
          )}
        </section>

        {/* ─────── Couple status card (adults pillar context) ─────── */}
        {hasCouple ? (
          <section className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/55">
                  <Users className="h-3.5 w-3.5" />
                  {isHe ? "החלל הזוגי שלכם" : "Your couple space"}
                </div>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  {ctx.partner_count === 2
                    ? isHe
                      ? "מצומדים לפרטנר/ית"
                      : "Paired with your partner"
                    : isHe
                      ? "מחכים לפרטנר/ית"
                      : "Waiting for your partner"}
                </h3>
                {ctx.pair_code ? (
                  <div className="mt-3">
                    <p className="text-xs text-white/55">
                      {isHe
                        ? "קוד משחק (למכשיר שני)"
                        : "Game session code (second device)"}
                    </p>
                    <div className="mt-1">
                      <PairCodeWidget
                        pairCode={ctx.pair_code}
                        isHe={isHe}
                        compact
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              {needsPartner ? (
                <div className="w-full max-w-md">
                  <p className="text-sm font-semibold text-white">
                    {isHe ? "הזמינו את הפרטנר/ית" : "Invite your partner"}
                  </p>
                  <p className="mt-1 text-xs text-white/65">
                    {isHe
                      ? "שלחו מייל וכל מה שיש לכם יחכה גם להם."
                      : "Send an email - everything you own will be waiting for them too."}
                  </p>
                  <div className="mt-3">
                    <InvitePartnerByEmail
                      locale={isHe ? "he" : "en"}
                      isHe={isHe}
                      invitation={pendingInvitation}
                      canInvite={isOwner}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <RedeemCodeButton
                    isHe={isHe}
                    variant="pill"
                    label={isHe ? "הזנת קוד" : "Redeem code"}
                  />
                </div>
              )}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EntitledPillar - the "you have access" card
// ─────────────────────────────────────────────────────────────────────────────

function EntitledPillar({
  isHe,
  pillar,
  titleHe,
  titleEn,
  Icon,
  description,
  galleryHref,
  accent,
  ctaLabelHe,
  ctaLabelEn,
  notificationCount,
}: {
  isHe: boolean;
  pillar: PillarKey;
  titleHe: string;
  titleEn: string;
  Icon: typeof Gamepad2;
  description: string;
  galleryHref: string;
  accent: string;
  /** Optional per-pillar override of the "Open gallery / לגלריה" CTA. */
  ctaLabelHe?: string;
  ctaLabelEn?: string;
  /** Coaching pillar shows a red dot + counter when the expert has
   *  prescribed new content the user hasn't opened yet (derived in
   *  lib/journey-content/unread.ts). Other pillars omit the prop. */
  notificationCount?: number;
}) {
  const Arrow = isHe ? ArrowLeft : ArrowRight;
  const title = isHe ? titleHe : titleEn;
  const ctaLabel = isHe
    ? (ctaLabelHe ?? "לגלריה")
    : (ctaLabelEn ?? "Open gallery");
  const hasNotif = (notificationCount ?? 0) > 0;

  return (
    <Link
      href={galleryHref}
      className="group relative flex min-h-[420px] flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-8 transition hover:border-white/25 hover:bg-white/[0.06]"
      data-pillar={pillar}
    >
      {/* Subtle accent orb */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -top-20 end-[-40px] h-56 w-56 rounded-full bg-gradient-to-br ${accent} opacity-30 blur-3xl transition group-hover:opacity-50`}
      />

      {/* Notification badge — red dot + counter, top-end corner. Pulse
          animation matches the homepage hero's "dot" eyebrow so the
          surface reads as one visual family. */}
      {hasNotif ? (
        <span
          aria-label={isHe ? `${notificationCount} חדשים` : `${notificationCount} new`}
          className="absolute end-4 top-4 z-10 inline-flex min-w-[26px] items-center justify-center gap-1 rounded-full bg-rose-500 px-2 py-1 text-[11px] font-bold text-white shadow-lg shadow-rose-500/40 ring-2 ring-rose-300/30"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-300 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-100" />
          </span>
          {notificationCount}
        </span>
      ) : null}

      <div className="relative">
        <div
          className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} shadow-xl shadow-black/40 ring-1 ring-white/20`}
        >
          <Icon className="h-7 w-7 text-white" />
        </div>
        <h3 className="mt-5 text-2xl font-bold text-white">{title}</h3>
        <p className="mt-2 text-sm text-white/70">{description}</p>
      </div>

      <div className="relative mt-8 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">
          <Sparkles className="h-3 w-3" />
          {isHe ? "פעיל" : "Active"}
        </span>
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-white transition group-hover:gap-3">
          {ctaLabel}
          <Arrow className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
