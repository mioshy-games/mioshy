/**
 * /my/adults — Adults gallery, wrapped in the post-login shell.
 *
 * Replaces the standalone page at app/[locale]/my/adults/page.tsx so the
 * Adults catalogue lives inside the same shell as every other /my/*
 * surface (sidebar, mobile tabs, PageHeader).
 *
 * Behaviour preserved:
 *   • Auth + entitlements gate (no Adults pillar → /adults marketing).
 *   • Lists OWNED games from listOwnedGamesForCouple().
 *   • Lists "more games" (active catalogue minus owned) at the bottom.
 *   • Surfaces the journey-bundle informational banner for Journey subs.
 *
 * Removed:
 *   • AdultsAmbience drifting-fog component — the shell layout has its
 *     own brand backdrop; layering two fog systems looked muddy.
 *   • EmptyGallery rose-gradient card — Itzik flagged this was visual
 *     duplication next to the shell's own page surface. When the user
 *     has no owned games, we now render a single inline message and let
 *     the "More games" section do the merchandising work.
 *   • Manual breadcrumb + headline chip — PageHeader covers both.
 *   • Custom <body-font> wrapper — the shell's font stack carries.
 *
 * Added 2026-05-30 (post-launch shell migration).
 */

import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { Link } from "@/navigation";
import {
  ArrowRight,
  Flame,
  Heart,
  MessageCircleHeart,
  Play,
  Sparkles,
} from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { getShellData } from "@/lib/shell/getShellData";
import {
  getCurrentCoupleContext,
  listOwnedGamesForCouple,
  type OwnedGame,
} from "@/lib/between-us/couples";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import { listActiveGameCards } from "@/lib/between-us/queries";
import type { ExperienceGame } from "@/lib/between-us/types";
import { CmsText } from "@/components/cms/CmsText";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";

// `dynamic = "force-dynamic"` is inherited from the (shell) layout.

export default async function ShellMyAdultsPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  setRequestLocale(locale);
  const isHe = locale === "he";

  // Shell auth — layout also enforces this, page-level check kept for
  // direct entries.
  const shell = await getShellData({ locale: isHe ? "he" : "en" });
  if (!shell) redirect(`/${locale}/auth`);

  const ctx = await getCurrentCoupleContext();
  if (!ctx) redirect(`/${locale}/auth`);

  const entitlements = await getUserEntitlements(ctx.user_id);
  if (!entitlements) redirect(`/${locale}/auth`);

  // No Adults pillar (and no Journey bundling adults) → kick to the
  // marketing page where they can purchase.
  if (!entitlements.adults) redirect(`/${locale}/adults`);

  const hasCouple = !!ctx.couple_id;
  const [owned, activeCards] = await Promise.all([
    hasCouple
      ? listOwnedGamesForCouple(ctx.couple_id as string)
      : Promise.resolve([] as OwnedGame[]),
    listActiveGameCards().catch(() => []),
  ]);

  // "More games" = active catalogue minus already-owned ids.
  const ownedIds = new Set(owned.map((g) => g.id));
  const moreGames: ExperienceGame[] = activeCards
    .map((c) => c.game)
    .filter((g) => !ownedIds.has(g.id));

  // 2026-05-22 — Journey subscription bundles full Adults access; the
  // banner stays informational (no monthly slot mechanic remains).
  const journeyBundlesAdults = entitlements.journey;

  const tLoc = isHe ? "he" : "en";
  const tShell = await getCmsTranslations({
    locale: tLoc,
    namespace: "appShell",
    page: "app-shell",
  });
  const tNav = await getCmsTranslations({
    locale: tLoc,
    namespace: "appShell.nav",
    page: "app-shell",
  });

  return (
    <>
      <PageHeader
        rootLabel={tShell("rootCrumb")}
        pageLabel={tNav("adults")}
        subLine={null}
        bellCount={shell.notificationCount}
      />

      <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-5 px-5 py-6">
        {/* Lede — sits under PageHeader as the page's single intro line.
            Same tonal weight as the lede on the lessons page. */}
        <CmsText
          cmsKey="myAdults.heroLede"
          as="p"
          className="m-0 text-[15px] leading-relaxed"
          style={{ color: "var(--shell-text-3)" }}
        />

        {/* Journey-bundle informational banner — replaces the legacy
            "monthly slots" widget. Renders only when the user has an
            active Journey sub. */}
        {journeyBundlesAdults ? (
          <div
            className="flex flex-wrap items-center gap-3 rounded-[14px] border p-4"
            style={{
              background:
                "linear-gradient(135deg, rgba(245,158,11,0.10) 0%, rgba(184,60,77,0.06) 70%, transparent 100%)",
              borderColor: "rgba(245,158,11,0.28)",
            }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
              style={{
                background: "rgba(245,158,11,0.16)",
                borderColor: "rgba(245,158,11,0.32)",
                color: "var(--shell-amber)",
              }}
              aria-hidden
            >
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <CmsText
                cmsKey="myAdults.journeyBundleTitle"
                as="p"
                className="m-0 text-[14px] font-semibold"
                style={{ color: "var(--shell-text-1)" }}
              />
              <CmsText
                cmsKey="myAdults.journeyBundleBody"
                as="p"
                className="m-0 mt-0.5 text-[13px]"
                style={{ color: "var(--shell-text-3)" }}
              />
            </div>
          </div>
        ) : null}

        {/* Owned games — section header + grid. When there are none, we
            render a single inline message instead of a separate empty-
            state card. The "More games" section below does the
            merchandising lift. */}
        {owned.length > 0 ? (
          <section className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between pt-1">
              <h3
                className="m-0 text-[18px] font-extrabold tracking-tight"
                style={{ color: "var(--shell-text-1)" }}
              >
                <CmsText cmsKey="myAdults.yourGames" />
              </h3>
              <span
                className="text-[14px]"
                style={{ color: "var(--shell-text-3)" }}
              >
                {owned.length}
              </span>
            </div>
            <ul className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {owned.map((g) => (
                <OwnedGameCard key={g.id} game={g} isHe={isHe} />
              ))}
            </ul>
          </section>
        ) : (
          <p
            className="m-0 text-[14px]"
            style={{ color: "var(--shell-text-3)" }}
          >
            <CmsText cmsKey="myAdults.noGamesYet" />
          </p>
        )}

        {/* More games — full active catalogue minus already-owned. */}
        {moreGames.length > 0 ? (
          <section className="mt-2 flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between pt-1">
              <h3
                className="m-0 text-[18px] font-extrabold tracking-tight"
                style={{ color: "var(--shell-text-1)" }}
              >
                <CmsText cmsKey="myAdults.moreGames" />
              </h3>
              <span
                className="text-[14px]"
                style={{ color: "var(--shell-text-3)" }}
              >
                {moreGames.length}
              </span>
            </div>
            <CmsText
              cmsKey="myAdults.moreGamesLede"
              as="p"
              className="m-0 text-[14px] leading-relaxed"
              style={{ color: "var(--shell-text-3)" }}
            />
            <ul className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {moreGames.map((g) => (
                <AvailableGameCard key={g.id} game={g} isHe={isHe} />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────

function OwnedGameCard({ game, isHe }: { game: OwnedGame; isHe: boolean }) {
  const title = isHe ? game.title_he : game.title_en || game.title_he;
  const desc = isHe
    ? game.short_desc_he
    : game.short_desc_en || game.short_desc_he;

  return (
    <li>
      <Link
        href={`/mioshy-sex/${game.slug}/play`}
        className="group flex h-full flex-col overflow-hidden rounded-[18px] border transition hover:-translate-y-0.5"
        style={{
          background: "rgba(29,14,54,0.42)",
          borderColor: "rgba(255,255,255,0.06)",
        }}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-rose-500/30 via-fuchsia-500/20 to-violet-500/20">
          {game.cover_image_url ? (
            <Image
              src={game.cover_image_url}
              alt={title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition duration-500 group-hover:scale-[1.06]"
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
          <span
            className="absolute end-3 top-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-950 shadow-lg shadow-emerald-500/30"
          >
            <Sparkles className="h-3 w-3" />
            <CmsText cmsKey="myAdults.ownedBadge" />
          </span>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <h3
            className="m-0 text-[20px] font-bold leading-snug"
            style={{ color: "var(--shell-text-1)" }}
          >
            {title}
          </h3>
          {desc ? (
            <p
              className="m-0 mt-2 line-clamp-2 text-[14px] leading-relaxed"
              style={{ color: "var(--shell-text-3)" }}
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

          <div
            className="mt-5 flex items-center justify-between border-t pt-4"
            style={{ borderColor: "var(--shell-line-soft)" }}
          >
            <span
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold transition group-hover:opacity-90"
              style={{ color: "var(--shell-pink-text)" }}
            >
              <Play className="h-4 w-4" />
              <CmsText cmsKey="myAdults.openGame" />
            </span>
            <span
              aria-hidden
              className="inline-flex h-7 w-7 items-center justify-center rounded-full transition group-hover:bg-rose-500/40 group-hover:text-white"
              style={{ background: "rgba(255,255,255,0.08)", color: "var(--shell-text-3)" }}
            >
              <ArrowRight
                className={`h-3.5 w-3.5 ${isHe ? "rotate-180" : ""}`}
              />
            </span>
          </div>
        </div>
      </Link>
    </li>
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
    <li>
      <Link
        href={`/mioshy-sex/${game.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-[18px] border transition hover:-translate-y-0.5"
        style={{
          background: "rgba(29,14,54,0.30)",
          borderColor: "rgba(255,255,255,0.05)",
        }}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-rose-500/20 via-fuchsia-500/15 to-violet-500/15">
          {game.cover_image_url ? (
            <Image
              src={game.cover_image_url}
              alt={title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover opacity-90 transition duration-500 group-hover:scale-[1.05] group-hover:opacity-100"
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
          <span className="absolute end-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/30 bg-black/40 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur">
            <Sparkles className="h-3 w-3" />
            <CmsText cmsKey="myAdults.unlockBadge" />
          </span>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <h3
            className="m-0 text-[20px] font-bold leading-snug"
            style={{ color: "var(--shell-text-1)" }}
          >
            {title}
          </h3>
          {desc ? (
            <p
              className="m-0 mt-2 line-clamp-2 text-[14px] leading-relaxed"
              style={{ color: "var(--shell-text-3)" }}
            >
              {desc}
            </p>
          ) : null}

          <div
            className="mt-5 flex items-center justify-between border-t pt-4"
            style={{ borderColor: "var(--shell-line-soft)" }}
          >
            <span
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold transition group-hover:opacity-90"
              style={{ color: "var(--shell-pink-text)" }}
            >
              <Sparkles className="h-4 w-4" />
              <CmsText cmsKey="myAdults.detailsAndUnlock" />
            </span>
            <span
              aria-hidden
              className="inline-flex h-7 w-7 items-center justify-center rounded-full transition group-hover:bg-rose-500/40 group-hover:text-white"
              style={{ background: "rgba(255,255,255,0.08)", color: "var(--shell-text-3)" }}
            >
              <ArrowRight
                className={`h-3.5 w-3.5 ${isHe ? "rotate-180" : ""}`}
              />
            </span>
          </div>
        </div>
      </Link>
    </li>
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
    <div className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-white/10"
      style={{ background: "rgba(255,255,255,0.05)" }}>
      {icon}
      <span
        className="text-[11px] font-semibold"
        style={{ color: "var(--shell-text-2)" }}
      >
        {level}/5
      </span>
    </div>
  );
}
