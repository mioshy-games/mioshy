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

          {/* Account + invoices intentionally moved to a quiet quick-links
              row at the BOTTOM of the page. Per spec §5.3: the dashboard is
              about products, not admin chrome. Admin lives in /my/account. */}
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
        <section className="mt-10 grid gap-6 lg:grid-cols-3">
          {/* Games pillar */}
          {entitlements.games ? (
            <EntitledPillar
              isHe={isHe}
              pillar="games"
              titleHe="משחקים לזוגות"
              titleEn="Games for couples"
              description={
                isHe
                  ? "כנות ואתגר, גלגל הזוגיות, סולמות ונחשים."
                  : "Truth or dare, wheel, snakes & ladders."
              }
              galleryHref="/my/games"
              ctaLabelHe="המשחקים שלי"
              ctaLabelEn="My games"
            />
          ) : (
            <ServicePanel
              isHe={isHe}
              pillar="games"
              titleHe="משחקים לזוגות"
              titleEn="Games for couples"
              tagline={
                isHe
                  ? "כנות ואתגר, גלגל הזוגיות, סולמות ונחשים — משחקים שמרעננים את הקשר, בערב אחד."
                  : "Truth & dare, the wheel, snakes & ladders — couples games that refresh your connection in a single evening."
              }
              bullets={[]}
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
              description={
                isHe
                  ? "החדר הפרטי שלכם — תוכן שהמומחים שלנו מעלים עבורכם."
                  : "Your private space — content our experts curate for you."
              }
              // Per spec §6.0 — paying user lands directly in /my/journey;
              // they should never see the marketing /journey or the
              // assessment again (Phase A guard takes care of that case).
              galleryHref="/my/journey"
              ctaLabelHe="כניסה לחדר הפרטי"
              ctaLabelEn="Enter your private space"
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
                  ? "אבחון אישי חינם + ליווי מומחים מבוסס על שבעת עקרונות הקשר הבריא."
                  : "Free personal assessment + expert guidance built on seven principles of healthy partnership."
              }
              // Bullets removed per spec — "40 questions / personal report"
              // is pre-purchase marketing; on the dashboard it's noise.
              bullets={[]}
              badge="🧭"
              ctaHref="/journey/assessment"
              ctaLabel={isHe ? "להתחיל אבחון חינם" : "Start free assessment"}
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
            />
          ) : (
            <ServicePanel
              isHe={isHe}
              pillar="adults"
              titleHe="למבוגרים בלבד"
              titleEn="Adults Only"
              tagline={
                isHe
                  ? "משחקי זוגיות יותר אינטימיים — תכנים מותאמים, פרטיות מלאה."
                  : "More intimate couples games — curated content, full privacy."
              }
              bullets={[]}
              badge="💜"
              ctaHref="/adults"
              ctaLabel={isHe ? "צפה במשחקים" : "View games"}
              compact
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
// EntitledPillar — compact "you have access" card (per spec §5.1).
//
// Rewritten 2026-Q2 from the old ~420px hero-style card. Per user feedback:
//   - HALF the size (~190px tall instead of 420px+)
//   - NO leading icon block — title speaks for itself
//   - Active badge moved inline into the header
//   - CTA copy is product-aware ("כניסה לחדר הפרטי" for journey, etc.)
// ─────────────────────────────────────────────────────────────────────────────

function EntitledPillar({
  isHe,
  pillar,
  titleHe,
  titleEn,
  description,
  galleryHref,
  ctaLabelHe,
  ctaLabelEn,
  notificationCount,
}: {
  isHe: boolean;
  pillar: PillarKey;
  titleHe: string;
  titleEn: string;
  description: string;
  galleryHref: string;
  ctaLabelHe?: string;
  ctaLabelEn?: string;
  notificationCount?: number;
}) {
  const Arrow = isHe ? ArrowLeft : ArrowRight;
  const title = isHe ? titleHe : titleEn;
  const ctaLabel = isHe
    ? (ctaLabelHe ?? "כניסה לחדר הפרטי")
    : (ctaLabelEn ?? "Enter your private space");
  const hasNotif = (notificationCount ?? 0) > 0;

  return (
    <Link
      href={galleryHref}
      className="group relative flex flex-col justify-between gap-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-white/25 hover:bg-white/[0.06]"
      data-pillar={pillar}
    >
      {hasNotif ? (
        <span
          aria-label={
            isHe ? `${notificationCount} חדשים` : `${notificationCount} new`
          }
          className="absolute end-3 top-3 z-10 inline-flex min-w-[22px] items-center justify-center gap-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md shadow-rose-500/40"
        >
          {notificationCount}
        </span>
      ) : null}

      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
            {isHe ? "פעיל" : "Active"}
          </span>
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm text-white/65">{description}</p>
      </div>

      <span className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-white transition group-hover:gap-2.5">
        {ctaLabel}
        <Arrow className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}
