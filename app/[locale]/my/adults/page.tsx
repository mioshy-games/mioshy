import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Link } from "@/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Flame,
  Heart,
  Library,
  MessageCircleHeart,
  Play,
  Sparkles,
} from "lucide-react";
import {
  getCurrentCoupleContext,
  listOwnedGamesForCouple,
  type OwnedGame,
} from "@/lib/between-us/couples";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import { getAdultsMonthlyStatus } from "@/lib/entitlements/adults-monthly";
import { listActiveGameCards } from "@/lib/between-us/queries";
import type { ExperienceGame } from "@/lib/between-us/types";
// Same drifting fog + sparkle field used on the /adults marketing
// surface. Reusing this component (instead of forking a "lite" version)
// keeps the post-purchase gallery in the same after-dark world as the
// product pages, so the moment of "this is mine now" still feels cinematic.
import { AdultsAmbience } from "@/components/adults/AdultsAmbience";
import { CmsText } from "@/components/cms/CmsText";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";

// Body-font stack used inside this page. Frank Ruhl Libre is reserved
// for headlines; Assistant (loaded as --font-body-hebrew in layout.tsx)
// is what reads cleanly at 14–18px against a dark ground.
const BODY_FONT =
  "var(--font-body-hebrew), 'Assistant', system-ui, sans-serif";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getCmsTranslations({
    locale: params.locale === "he" ? "he" : "en",
    namespace: "myAdults",
    page: "my",
  });
  return {
    title: `Mioshy - ${t("metaTitle")}`,
    description: t("metaDescription"),
  };
}

export default async function MyAdultsGalleryPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  const isHe = locale === "he";
  const t = await getCmsTranslations({
    locale: isHe ? "he" : "en",
    namespace: "myAdults",
    page: "my",
  });

  const ctx = await getCurrentCoupleContext();
  if (!ctx) redirect(`/${locale}/auth`);

  const entitlements = await getUserEntitlements(ctx.user_id);
  if (!entitlements) redirect(`/${locale}/auth`);

  // If user doesn't have the adults pillar, send them to the marketing page.
  if (!entitlements.adults) redirect(`/${locale}/adults`);

  const hasCouple = !!ctx.couple_id;
  const [owned, activeCards] = await Promise.all([
    hasCouple
      ? listOwnedGamesForCouple(ctx.couple_id as string)
      : Promise.resolve([] as OwnedGame[]),
    listActiveGameCards().catch(() => []),
  ]);

  // "More games" - every active Adults game in the catalogue minus
  // the ones this couple already owns. Rendered inline at the bottom
  // of the page so the user never leaves the gallery to browse.
  const ownedIds = new Set(owned.map((g) => g.id));
  const moreGames: ExperienceGame[] = activeCards
    .map((c) => c.game)
    .filter((g) => !ownedIds.has(g.id));

  // Monthly Adults bundle (spec §8.4) - Journey subscribers get one
  // free game per calendar month. We surface the slot's state at the
  // top of the page so the user knows whether to "use it now" or
  // wait until next month.
  const monthlyStatus = await getAdultsMonthlyStatus(ctx.user_id);

  const Arrow = isHe ? ArrowLeft : ArrowRight;

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      // `isolate` is REQUIRED - without it the AdultsAmbience layer at
      // -z-10 paints behind the wrapper's own gradient (i.e. invisible).
      // Same fix applied across every dark page on the site.
      className="relative isolate min-h-[100dvh] overflow-hidden bg-[#0a0410] text-white"
    >
      {/* Deep base wash - slightly cooler than the marketing /adults page
          so the gallery feels distinct ("home" rather than "store front")
          while staying inside the same after-dark colour family. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-20 h-full bg-[linear-gradient(180deg,#0a0410_0%,#13061a_25%,#1a071f_50%,#15051a_75%,#0a0410_100%)]"
      />
      {/* Drifting fog blobs + floating sparkle particles - same vocabulary
          as /adults and /adults/[slug]. Pure CSS, honours
          prefers-reduced-motion via the component itself. */}
      <AdultsAmbience />

      <main
        className="relative mx-auto max-w-7xl px-4 pb-24 pt-10 sm:pt-14"
        style={{ fontFamily: BODY_FONT }}
      >
        {/* Breadcrumb */}
        <Link
          href="/my"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-white/60 transition hover:text-white/95"
        >
          <Arrow className="h-3 w-3 rotate-180" />
          <CmsText cmsKey="myAdults.backToMyMioshy" />
        </Link>

        {/* Header - eyebrow + display-serif headline + lede + CTA back to
            the marketing page. The headline keeps Frank Ruhl Libre because
            it's display, but the lede and supporting text use Assistant. */}
        <section className="mt-6 flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/40 bg-rose-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] backdrop-blur">
              <Heart className="h-3.5 w-3.5 text-rose-200" />
              <span className="text-rose-100">
                <CmsText cmsKey="myAdults.heading" />
              </span>
            </div>
            <h1
              className="mt-4 flex items-center gap-3 text-balance text-[40px] leading-[1.05] tracking-[-0.02em] sm:text-[52px]"
              style={{
                fontFamily: "'Frank Ruhl Libre', serif",
                fontWeight: 700,
              }}
            >
              <Library className="h-8 w-8 text-rose-300 sm:h-10 sm:w-10" />
              <span className="bg-gradient-to-br from-white via-rose-100 to-amber-200 bg-clip-text text-transparent">
                <CmsText cmsKey="myAdults.eyebrow" />
              </span>
            </h1>
            <CmsText
              cmsKey="myAdults.heroLede"
              as="p"
              className="mt-4 text-[16px] leading-[1.7] text-white/80 sm:text-[17px]"
            />
          </div>

          {moreGames.length > 0 ? (
            <a
              href="#more-games"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur transition hover:border-rose-300/40 hover:bg-white/10 hover:text-white"
            >
              <Sparkles className="h-4 w-4 text-rose-200" />
              <CmsText cmsKey="myAdults.moreGames" />
              <Arrow className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </section>

        {/* ─────── Monthly bundle banner (spec §8.4) ───────
            Visible only when the user has a Journey subscription that
            bundles a free Adults game per calendar month. Two states:
              - available: invite to pick one
              - consumed:  show when the next slot opens */}
        {monthlyStatus.has_bundle_subscription ? (
          <section className="mt-8">
            {monthlyStatus.available ? (
              <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-500/15 via-rose-500/8 to-transparent p-5 backdrop-blur">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-amber-300/40 bg-amber-500/15">
                  <Sparkles className="size-5 text-amber-200" />
                </div>
                <div className="min-w-0 flex-1">
                  <CmsText
                    cmsKey="myAdults.monthlyAvailableTitle"
                    as="p"
                    className="text-sm font-semibold text-white"
                  />
                  <CmsText
                    cmsKey="myAdults.monthlyAvailableBody"
                    as="p"
                    className="mt-0.5 text-xs text-white/70"
                  />
                </div>
                <Link
                  href="/mioshy-sex"
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-300"
                >
                  <CmsText cmsKey="myAdults.pickGame" />
                  <Arrow className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
                <Sparkles className="size-4 shrink-0 text-white/45" />
                <p className="text-xs text-white/60">
                  {t("monthlyConsumedTemplate").replace(
                    "{date}",
                    monthlyStatus.next_available_at
                      ? new Date(
                          monthlyStatus.next_available_at,
                        ).toLocaleDateString(isHe ? "he-IL" : "en-US", {
                          day: "numeric",
                          month: "long",
                        })
                      : t("monthlyNextSoon"),
                  )}
                </p>
              </div>
            )}
          </section>
        ) : null}

        {/* Games grid */}
        {owned.length > 0 ? (
          <section className="mt-12">
            <div className="flex items-baseline gap-3">
              <h2 className="text-[20px] font-semibold text-white sm:text-[22px]">
                <CmsText cmsKey="myAdults.yourGames" />
              </h2>
              <span className="rounded-full border border-white/12 bg-white/5 px-2.5 py-0.5 text-[12px] font-semibold text-white/85 backdrop-blur">
                {owned.length}
              </span>
            </div>

            <div className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {owned.map((g) => (
                <OwnedGameCard key={g.id} game={g} isHe={isHe} />
              ))}
            </div>
          </section>
        ) : (
          <EmptyGallery isHe={isHe} />
        )}

        {/* ─────── More games (inline, below) ───────
            All active catalogue games minus the ones this couple already
            owns. Renders only when there's something to show. The "More
            games" button at the top jumps here via #more-games. */}
        {moreGames.length > 0 ? (
          <section id="more-games" className="mt-16 scroll-mt-24">
            <div className="flex items-baseline gap-3">
              <h2 className="text-[20px] font-semibold text-white sm:text-[22px]">
                <CmsText cmsKey="myAdults.moreGames" />
              </h2>
              <span className="rounded-full border border-white/12 bg-white/5 px-2.5 py-0.5 text-[12px] font-semibold text-white/85 backdrop-blur">
                {moreGames.length}
              </span>
            </div>
            <CmsText
              cmsKey="myAdults.moreGamesLede"
              as="p"
              className="mt-2 max-w-2xl text-[20px] leading-[1.55] text-white/65 sm:text-[15px] sm:leading-[1.65]"
              style={{ fontFamily: BODY_FONT }}
            />

            <div className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {moreGames.map((g) => (
                <AvailableGameCard key={g.id} game={g} isHe={isHe} />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function EmptyGallery({ isHe: _isHe }: { isHe: boolean }) {
  return (
    <section className="mt-14">
      <div className="relative overflow-hidden rounded-[28px] border border-rose-300/25 bg-gradient-to-br from-rose-500/10 via-fuchsia-500/8 to-violet-600/10 p-10 text-center backdrop-blur">
        {/* Inner halo so the empty state still feels like a moment, not
            a void. Pure decoration - pointer-events-none. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-rose-500/15 to-transparent"
        />
        <Sparkles className="relative mx-auto h-10 w-10 text-rose-200" />
        <h2
          className="relative mt-4 text-[26px] font-bold sm:text-[30px]"
          style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 700 }}
        >
          <CmsText cmsKey="myAdults.noGamesYet" />
        </h2>
        <CmsText
          cmsKey="myAdults.emptyGalleryLede"
          as="p"
          className="relative mx-auto mt-3 max-w-xl text-[15px] leading-[1.7] text-white/85"
          style={{ fontFamily: BODY_FONT }}
        />
        <Link
          href="/mioshy-sex"
          className="relative mt-7 inline-flex min-h-[48px] items-center gap-2 overflow-hidden rounded-full px-7 text-sm font-semibold text-white shadow-2xl shadow-rose-600/40 transition hover:brightness-110"
        >
          <span
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(110deg,#f43f5e_0%,#ec4899_45%,#a855f7_100%)] bg-[length:220%_100%] mio-my-adults-cta"
          />
          <span className="relative z-10 inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <CmsText cmsKey="myAdults.exploreContent" />
          </span>
        </Link>

        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes mio-my-adults-cta {
                0%, 100% { background-position: 0% 50%; }
                50%      { background-position: 100% 50%; }
              }
              .mio-my-adults-cta { animation: mio-my-adults-cta 7s ease-in-out infinite; }
            `,
          }}
        />
      </div>
    </section>
  );
}

function OwnedGameCard({ game, isHe }: { game: OwnedGame; isHe: boolean }) {
  const title = isHe ? game.title_he : game.title_en || game.title_he;
  const desc = isHe
    ? game.short_desc_he
    : game.short_desc_en || game.short_desc_he;

  return (
    <Link
      // Owners go straight to the gated play surface, NOT the public
      // marketing page. The play page renders full_desc + role panels
      // with the on-load sparkle burst.
      href={`/mioshy-sex/${game.slug}/play`}
      className="group relative block overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/[0.04] to-white/[0.02] shadow-[0_24px_60px_-25px_rgba(244,63,94,0.45)] backdrop-blur-md transition hover:-translate-y-1 hover:border-rose-300/50 hover:shadow-[0_32px_80px_-20px_rgba(244,63,94,0.6)]"
    >
      {/* Gradient halo on hover - sits behind the card content. The
          rose→fuchsia→violet wash is the same family used by every
          adults CTA, so the card "lights up" in the brand palette
          when it becomes the user's focus. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-px rounded-[24px] opacity-0 transition group-hover:opacity-100"
        style={{
          background:
            "linear-gradient(135deg, rgba(244,63,94,0.55) 0%, rgba(236,72,153,0.4) 50%, rgba(168,85,247,0.45) 100%)",
          padding: "1px",
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />

      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-rose-500/30 via-fuchsia-500/20 to-violet-500/20">
        {game.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.cover_image_url}
            alt={title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/40">
            <Heart className="h-12 w-12" />
          </div>
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 via-black/30 to-transparent"
        />
        {/* "Owned" badge - emerald gradient pill instead of flat fill so
            it reads as a brand mark, not a status sticker. */}
        <span
          className="absolute end-3 top-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-950 shadow-lg shadow-emerald-500/30"
        >
          <Sparkles className="h-3 w-3" />
          <CmsText cmsKey="myAdults.ownedBadge" />
        </span>
      </div>

      <div className="relative p-5">
        <h3
          className="text-[20px] font-bold leading-tight text-white transition group-hover:text-rose-100 sm:text-[22px]"
          style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 700 }}
        >
          {title}
        </h3>
        {desc ? (
          <p
            className="mt-2 line-clamp-2 text-[20px] leading-[1.5] text-white/75 sm:text-[15px] sm:leading-[1.6]"
            style={{ fontFamily: BODY_FONT }}
          >
            {desc}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <MiniLevel
            icon={<Heart className="h-3 w-3 text-rose-300" />}
            level={game.intimacy_level}
          />
          <MiniLevel
            icon={<MessageCircleHeart className="h-3 w-3 text-sky-300" />}
            level={game.communication_level}
          />
          <MiniLevel
            icon={<Flame className="h-3 w-3 text-orange-300" />}
            level={game.heat_level}
          />
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
          <span
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-rose-200 transition group-hover:text-white"
            style={{ fontFamily: BODY_FONT }}
          >
            <Play className="h-4 w-4" />
            <CmsText cmsKey="myAdults.openGame" />
          </span>
          <span
            aria-hidden
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/60 transition group-hover:bg-rose-500/40 group-hover:text-white"
          >
            <ArrowRight
              className={`h-3.5 w-3.5 ${isHe ? "rotate-180" : ""}`}
            />
          </span>
        </div>
      </div>
    </Link>
  );
}

function AvailableGameCard({
  game,
  isHe,
}: {
  game: ExperienceGame;
  isHe: boolean;
}) {
  const title = isHe ? game.title_he : game.title_en || game.title_he;
  const desc = isHe
    ? game.short_desc_he
    : game.short_desc_en || game.short_desc_he;

  return (
    <Link
      // Non-owners go to the public marketing page where they can read
      // the full pitch and purchase. Owners never reach this card.
      href={`/mioshy-sex/${game.slug}`}
      className="group relative block overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-white/[0.05] via-white/[0.03] to-transparent backdrop-blur-md transition hover:-translate-y-1 hover:border-rose-300/40 hover:shadow-[0_24px_60px_-25px_rgba(244,63,94,0.4)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-rose-500/20 via-fuchsia-500/15 to-violet-500/15">
        {game.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.cover_image_url}
            alt={title}
            className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-[1.05] group-hover:opacity-100"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/40">
            <Sparkles className="h-12 w-12" />
          </div>
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 via-black/30 to-transparent"
        />
        {/* "New / Locked" badge - distinct from the emerald "Owned" pill
            on the gallery cards above. Clear visual signal: this is
            still gated. */}
        <span className="absolute end-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/30 bg-black/40 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur">
          <Sparkles className="h-3 w-3" />
          <CmsText cmsKey="myAdults.unlockBadge" />
        </span>
      </div>

      <div className="relative p-5">
        <h3
          className="text-[20px] font-bold leading-tight text-white transition group-hover:text-rose-100 sm:text-[22px]"
          style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 700 }}
        >
          {title}
        </h3>
        {desc ? (
          <p
            className="mt-2 line-clamp-2 text-[20px] leading-[1.5] text-white/70 sm:text-[15px] sm:leading-[1.6]"
            style={{ fontFamily: BODY_FONT }}
          >
            {desc}
          </p>
        ) : null}

        <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
          <span
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-rose-200 transition group-hover:text-white"
            style={{ fontFamily: BODY_FONT }}
          >
            <Sparkles className="h-4 w-4" />
            <CmsText cmsKey="myAdults.detailsAndUnlock" />
          </span>
          <span
            aria-hidden
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/60 transition group-hover:bg-rose-500/40 group-hover:text-white"
          >
            <ArrowRight
              className={`h-3.5 w-3.5 ${isHe ? "rotate-180" : ""}`}
            />
          </span>
        </div>
      </div>
    </Link>
  );
}

function MiniLevel({
  icon,
  level,
}: {
  icon: React.ReactNode;
  level: number;
}) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 ring-1 ring-white/10 backdrop-blur"
      style={{ fontFamily: BODY_FONT }}
    >
      {icon}
      <span className="text-[11px] font-semibold text-white/90">{level}/5</span>
    </div>
  );
}
