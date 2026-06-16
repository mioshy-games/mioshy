/**
 * /my/games — couples-games gallery, wrapped in the post-login shell.
 *
 * Replaces the standalone /my/games page (previously under
 * app/[locale]/my/games/page.tsx) so it renders INSIDE the shell layout
 * — same sidebar, mobile tabs, PageHeader as every other /my/* surface.
 *
 * Behaviour preserved from the prior page:
 *   • Auth + entitlements gate (no games access → /games marketing).
 *   • Reads active games from the `games` table.
 *   • Appends the hardcoded "Snakes & Ladders" card (it has its own
 *     /game route, not /games/:slug, so the table query never returns it).
 *
 * Removed from the prior page:
 *   • Custom dark gradient wrapper (the shell supplies the backdrop).
 *   • Manual breadcrumb ("חזרה למיאושי שלי") — PageHeader renders this.
 *   • Eyebrow chip + headline — page identity now lives in PageHeader.
 *
 * Added 2026-05-30 (post-launch shell migration).
 */

import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { Link } from "@/navigation";
import { Gamepad2, Play } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getShellData } from "@/lib/shell/getShellData";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";
import { pickGameThumbnail } from "@/lib/games-thumbnail";
import { FreeBadge } from "@/components/games/FreeBadge";
import { CmsText } from "@/components/cms/CmsText";
import type { GameRow } from "@/lib/types/database";

// `dynamic = "force-dynamic"` is inherited from the (shell) layout.

export default async function ShellMyGamesPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  setRequestLocale(locale);
  const isHe = locale === "he";

  // Auth gate — shell layout also gates, but a direct hit on the page
  // works the same as any sibling shell page.
  const shell = await getShellData({ locale: isHe ? "he" : "en" });
  if (!shell) redirect(`/${locale}/auth`);

  // Entitlement gate — if the user doesn't own the games pillar, send
  // them to the marketing surface where they can purchase.
  const entitlements = await getUserEntitlements();
  if (!entitlements) redirect(`/${locale}/auth`);
  if (!entitlements.games) redirect(`/${locale}/games`);

  // Page strings — namespace 'myGames' already exists in cms_texts +
  // messages, so we keep using it here. Shell crumb label comes from
  // appShell.rootCrumb to stay aligned with the other shell pages.
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
  const t = await getCmsTranslations({
    locale: tLoc,
    namespace: "myGames",
    page: "my",
  });

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("games")
    .select("*")
    // A.9 — free game(s) first (admin-controlled via is_free), then newest.
    .order("is_free", { ascending: false })
    .order("created_at", { ascending: false });
  const games = (data ?? []) as GameRow[];

  return (
    <>
      <PageHeader
        rootLabel={tShell("rootCrumb")}
        pageLabel={tNav("games")}
        subLine={null}
        bellCount={shell.notificationCount}
      />

      <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-5 px-5 py-6">
        {/* Lede — single line of context under the page header. The
            marketing-style eyebrow + Frank Ruhl headline are intentionally
            dropped: inside the shell, the page already wears its own
            identity via PageHeader. */}
        <CmsText
          cmsKey="myGames.lede"
          as="p"
          className="m-0 text-[15px] leading-relaxed"
          style={{ color: "var(--shell-text-3)" }}
        />

        {/* Games grid — 2-up on sm+, single column on mobile. */}
        {games.length === 0 ? (
          <p
            className="m-0 text-[14px]"
            style={{ color: "var(--shell-text-3)" }}
          >
            <CmsText cmsKey="myGames.noGamesAvailable" />
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2">
            {games.map((g) => {
              const name = isHe ? g.name_he : g.name_en;
              const desc = isHe ? g.description_he : g.description_en;
              const thumb = pickGameThumbnail(g, locale);
              return (
                <li key={g.id}>
                  <Link
                    href={`/games/${g.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-[18px] border transition hover:-translate-y-0.5"
                    style={{
                      background: "rgba(29,14,54,0.42)",
                      borderColor: "rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/30">
                      {thumb ? (
                        <Image
                          src={thumb}
                          alt={name}
                          fill
                          sizes="(max-width: 640px) 100vw, 50vw"
                          className="object-cover transition duration-500 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-gradient-to-br from-fuchsia-900/40 to-violet-900/40">
                          <Gamepad2 className="h-12 w-12 text-white/40" />
                        </div>
                      )}
                      {/* H — free-game marker. No "דרוש מנוי" tag here: /my/games
                          is gated to games-entitled members, so it'd be wrong. */}
                      {g.is_free ? (
                        <FreeBadge className="absolute start-3 top-3 z-10" />
                      ) : null}
                      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h3
                        className="m-0 text-[20px] font-bold leading-snug"
                        style={{ color: "var(--shell-text-1)" }}
                      >
                        {name}
                      </h3>
                      {desc ? (
                        <p
                          className="m-0 mt-2 line-clamp-3 text-[14px] leading-relaxed"
                          style={{ color: "var(--shell-text-3)" }}
                        >
                          {desc}
                        </p>
                      ) : null}
                      <span
                        className="mt-5 inline-flex items-center gap-2 text-[14px] font-semibold transition group-hover:opacity-90"
                        style={{ color: "var(--shell-pink-text)" }}
                      >
                        <Play className="h-4 w-4" />
                        <CmsText cmsKey="myGames.playNow" />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}

            {/* Virtual snakes & ladders card — itzik 2026-05-05.
                The board game isn't a row in the `games` table (it has
                its own /game route, not /games/:slug), so the DB query
                above never returns it. Hardcoded card kept here so paid
                users see every active product on their personal gallery. */}
            <li>
              <Link
                href="/game"
                className="group flex h-full flex-col overflow-hidden rounded-[18px] border transition hover:-translate-y-0.5"
                style={{
                  background: "rgba(29,14,54,0.42)",
                  borderColor: "rgba(255,255,255,0.06)",
                }}
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-rose-500/30 via-fuchsia-500/25 to-violet-500/20">
                  <Image
                    src="/images/snakes-couples.webp"
                    alt={t("snakesAndLadders")}
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-cover transition duration-500 group-hover:scale-[1.04]"
                  />
                  <span className="absolute end-3 top-3 rounded-full bg-gradient-to-r from-rose-400 to-fuchsia-400 px-3 py-1 text-xs font-bold text-white shadow-lg">
                    <CmsText cmsKey="myGames.newBadge" />
                  </span>
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <CmsText
                    cmsKey="myGames.snakesAndLadders"
                    as="h3"
                    className="m-0 text-[20px] font-bold leading-snug"
                    style={{ color: "var(--shell-text-1)" }}
                  />
                  <CmsText
                    cmsKey="myGames.snakesDescription"
                    as="p"
                    className="m-0 mt-2 line-clamp-3 text-[14px] leading-relaxed"
                    style={{ color: "var(--shell-text-3)" }}
                  />
                  <span
                    className="mt-5 inline-flex items-center gap-2 text-[14px] font-semibold transition group-hover:opacity-90"
                    style={{ color: "var(--shell-pink-text)" }}
                  >
                    <Play className="h-4 w-4" />
                    <CmsText cmsKey="myGames.playNow" />
                  </span>
                </div>
              </Link>
            </li>
          </ul>
        )}
      </div>
    </>
  );
}
