import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Image from "next/image";
import { Link } from "@/navigation";
import { ArrowLeft, ArrowRight, Gamepad2, Play } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import type { GameRow } from "@/lib/types/database";
import { pickGameThumbnail } from "@/lib/games-thumbnail";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const isHe = params.locale === "he";
  return {
    title: `Mioshy - ${isHe ? "משחקים · הגלריה" : "Games · Gallery"}`,
    description: isHe
      ? "גלגל האמת, נחשים ושלבים - כל המשחקים שלכם, מוכנים להפעלה."
      : "Truth wheel, snakes & ladders - all your games, ready to play.",
  };
}

export default async function MyGamesGalleryPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  const isHe = locale === "he";

  const entitlements = await getUserEntitlements();
  if (!entitlements) redirect(`/${locale}/auth`);
  if (!entitlements.games) redirect(`/${locale}/games`);

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("games")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  const games = (data ?? []) as GameRow[];

  const Arrow = isHe ? ArrowLeft : ArrowRight;

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="min-h-[100dvh] text-white"
    >
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:pt-14">
        <Link
          href="/my"
          className="inline-flex items-center gap-1 text-xs font-medium text-white/55 transition hover:text-white/90"
        >
          <Arrow className="h-3 w-3 rotate-180" />
          {isHe ? "חזרה למיאושי שלי" : "Back to My Mioshy"}
        </Link>

        {/* Header */}
        <section className="mt-5">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-300/40 bg-fuchsia-500/10 px-3 py-1 text-xs backdrop-blur">
            <Gamepad2 className="h-3.5 w-3.5 text-fuchsia-200" />
            <span className="font-semibold text-fuchsia-100">
              {isHe ? "המשחקים שלכם" : "Your games"}
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {isHe ? "משחקים לזוגות" : "Games for couples"}
          </h1>
          <p className="mt-2 max-w-2xl text-white/70">
            {isHe
              ? "כנות ואתגר, גלגל הזוגיות, סולמות ונחשים — מוכנים להפעלה."
              : "Truth or dare, the wheel, snakes & ladders — ready to play."}
          </p>
        </section>

        {/* ─────── Games grid — 2 per row per spec §7.2 ───────
            Removed the Quick-start tiles section (it duplicated cards
            from the grid below). Removed the 3-column desktop variant
            in favour of a clean 2-up layout that matches the marketing
            page's grid. */}
        <section className="mt-10">
          {games.length === 0 ? (
            <p className="mt-6 text-white/60">
              {isHe ? "אין כרגע משחקים זמינים." : "No games available."}
            </p>
          ) : (
            <ul className="mt-6 grid gap-5 sm:grid-cols-2">
              {games.map((g) => {
                const name = isHe ? g.name_he : g.name_en;
                const desc = isHe ? g.description_he : g.description_en;
                const thumb = pickGameThumbnail(g, locale);
                return (
                  <li
                    key={g.id}
                    className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-md transition hover:border-fuchsia-300/40 hover:bg-white/[0.06]"
                  >
                    <Link
                      href={`/games/${g.slug}`}
                      className="flex h-full flex-col"
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
                        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
                      </div>
                      <div className="flex flex-1 flex-col p-5">
                        <h3 className="font-heading text-xl font-bold">{name}</h3>
                        {desc ? (
                          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/75">
                            {desc}
                          </p>
                        ) : null}
                        <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-fuchsia-300 transition group-hover:text-white">
                          <Play className="h-4 w-4" />
                          {isHe ? "שחקו עכשיו" : "Play now"}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}

              {/* Virtual snakes & ladders card — Itzik 2026-05-05.
                  The board game isn't a row in the `games` table (it
                  has its own /game route, not /games/:slug), so the DB
                  query above never returns it. Mirror the same hardcoded
                  card the public /games catalogue uses, so paid users
                  see EVERY active product on their personal gallery
                  page too. */}
              <li className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-md transition hover:border-rose-300/40 hover:bg-white/[0.06]">
                <Link href="/game" className="flex h-full flex-col">
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-rose-500/30 via-fuchsia-500/25 to-violet-500/20">
                    {/* Thumbnail — drop the image file at
                        /public/images/snakes-couples.webp (16:10 ratio
                        recommended, e.g. 1280×800). The emoji-gradient
                        underneath stays as a fallback if the file is
                        missing. */}
                    <Image
                      src="/images/snakes-couples.webp"
                      alt={isHe ? "נחשים וסולמות" : "Snakes & Ladders"}
                      fill
                      sizes="(max-width: 640px) 100vw, 50vw"
                      className="object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                    <span className="absolute end-3 top-3 rounded-full bg-gradient-to-r from-rose-400 to-fuchsia-400 px-3 py-1 text-xs font-bold text-white shadow-lg">
                      {isHe ? "חדש 🔥" : "New 🔥"}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-heading text-xl font-bold">
                      {isHe ? "נחשים וסולמות" : "Snakes & Ladders"}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/75">
                      {isHe
                        ? "לוח קלאסי עם שאלות ואתגרים זוגיים — שחקו על מכשיר אחד או על שני מכשירים שונים."
                        : "Classic board with couples questions & challenges — play on one device or remotely."}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-rose-300 transition group-hover:text-white">
                      <Play className="h-4 w-4" />
                      {isHe ? "שחקו עכשיו" : "Play now"}
                    </span>
                  </div>
                </Link>
              </li>
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
