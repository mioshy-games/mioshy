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
import type { PillarKey } from "@/lib/entitlements/getUserEntitlements";
import {
  derivePillarState,
  type AssessmentStage,
  type PillarStateOutput,
} from "@/lib/dashboard/pillar-state";
import { StateBadge } from "@/components/ui/StateBadge";
import { JourneyProgressRail } from "@/components/my/JourneyProgressRail";
import {
  JourneyWorkArea,
  type WorkAreaItem,
} from "@/components/my/JourneyWorkArea";
import { getTimelineForOwner } from "@/lib/journey-content/queries";
import { preferCoupleOwner } from "@/lib/journey-content/owner";

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

  // ─── Work-area data — Day 3 (MVP) ──────────────────────────────────
  // Pull the user's journey timeline only if they have Journey access.
  // Maps TimelineEntry → WorkAreaItem. Bounded list — we don't paginate
  // on the dashboard. If the user has more than ~30 items they'll
  // see them all here; we'll add pagination once that becomes a real
  // problem.
  const workAreaItems: WorkAreaItem[] = entitlements.journey
    ? await buildWorkAreaItems({
        userId: ctx.user_id,
        coupleId: ctx.couple_id,
        coupleRole: ctx.role,
        isHe,
      })
    : [];

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

        {/* ─────── Journey progress rail ───────
            Six pills above the cards giving the user a sense of "I am
            in a process". Static order, computed current step from the
            assessment status. Renders for everyone — even users who
            don't yet have Journey access — because seeing the path is
            part of why they'd consider buying. */}
        <section className="mt-8">
          <JourneyProgressRail
            isHe={isHe}
            assessmentStage={assessmentStage}
            hasJourneyEntitlement={entitlements.journey}
            hasActiveAssignments={journeyStatus.hasActiveAssignments}
          />
        </section>

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
                  ? "החדר הפרטי שלכם — תוכן אישי שהמומחים שלנו מכינים עבורכם."
                  : "Your private space — personal content our experts prepare for you."
              }
              notificationCount={unreadJourneyCount}
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

        {/* ─────── Work area — only for Journey users ─────── */}
        {entitlements.journey ? (
          <section className="mt-8">
            <JourneyWorkArea isHe={isHe} items={workAreaItems} />
          </section>
        ) : null}

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

// ─────────────────────────────────────────────────────────────────────────────
// buildWorkAreaItems — turn the Journey timeline into the lighter shape
// the WorkArea tabs consume. Server-side; runs only when the viewer
// has Journey entitlement.
//
// Per docs/my-page-redesign-spec.md §0 day 3 — no new fetches, no
// status engine. Just a thin mapping over the existing helper.
// ─────────────────────────────────────────────────────────────────────────────

async function buildWorkAreaItems(args: {
  userId: string;
  coupleId: string | null | undefined;
  coupleRole: "owner" | "partner" | null | undefined;
  isHe: boolean;
}): Promise<WorkAreaItem[]> {
  try {
    const owner = preferCoupleOwner(args.userId, args.coupleId ?? null);
    const viewerRole =
      args.coupleRole === "owner" || args.coupleRole === "partner"
        ? args.coupleRole
        : null;

    const timeline = await getTimelineForOwner({
      owner,
      viewerUserId: args.userId,
      viewerCoupleRole: viewerRole,
    });

    return timeline.map((entry) => {
      const title = args.isHe
        ? entry.item.title_he
        : entry.item.title_en || entry.item.title_he;
      const category =
        (args.isHe
          ? entry.category.name_he
          : entry.category.name_en || entry.category.name_he) ?? null;

      const status = entry.status; // "completed" | "available" | "locked"

      // Per spec: locked items are read-only here. Completed/available
      // route to the existing item view (the timeline page handles the
      // detail render).
      const href =
        status === "locked"
          ? null
          : `/journey/timeline#item-${entry.scheduled.id}`;

      const whenIso =
        status === "completed"
          ? entry.completion?.completed_at ?? entry.scheduled.unlock_at
          : entry.scheduled.unlock_at;

      return {
        id: entry.scheduled.id,
        title,
        category,
        status,
        href,
        whenIso: whenIso ?? null,
      };
    });
  } catch (err) {
    // The work area must never break the dashboard. If anything
    // throws (RLS, schema drift, etc.) we surface zero items and the
    // EmptyHint takes over.
    console.error("[/my] buildWorkAreaItems failed", err);
    return [];
  }
}

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
