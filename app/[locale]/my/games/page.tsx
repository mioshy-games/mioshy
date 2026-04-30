import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Image from "next/image";
import { Link } from "@/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Dices,
  Gamepad2,
  Play,
  Sparkles,
} from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import type { GameRow } from "@/lib/types/database";

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
        <section className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-300/40 bg-fuchsia-500/10 px-3 py-1 text-xs backdrop-blur">
              <Gamepad2 className="h-3.5 w-3.5 text-fuchsia-200" />
              <span className="font-semibold text-fuchsia-100">
                {isHe ? "המשחקים שלכם" : "Your games"}
              </span>
            </div>
            <h1 className="mt-3 flex items-center gap-3 text-4xl font-bold tracking-tight sm:text-5xl">
              <Gamepad2 className="h-8 w-8 text-fuchsia-300 sm:h-10 sm:w-10" />
              {isHe ? "משחקים" : "Games"}
            </h1>
            <p className="mt-3 max-w-2xl text-white/70">
              {isHe
                ? "משחקי גלגל ואמת או חובה, נחשים ושלבים - בוחרים ומתחילים בערב אחד."
                : "Truth wheel and snakes & ladders - pick one and play tonight."}
            </p>
          </div>
        </section>

        {/* Quick start tiles */}
        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          <QuickStartTile
            isHe={isHe}
            href="/games"
            titleHe="לכל המשחקים"
            titleEn="All games"
            subHe="עיון בקטלוג המלא"
            subEn="Browse the full catalogue"
            accent="from-violet-500 via-fuchsia-500 to-cyan-500"
            Icon={Sparkles}
          />
          <QuickStartTile
            isHe={isHe}
            href="/game/local"
            titleHe="נחשים ושלבים"
            titleEn="Snakes & Ladders"
            subHe="משחק לוח בשני מכשירים"
            subEn="Board game across two devices"
            accent="from-emerald-400 via-teal-500 to-sky-500"
            Icon={Dices}
          />
        </section>

        {/* Games grid */}
        <section className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold text-white/95">
              {isHe ? "כל המשחקים" : "All games"}
              <span className="ms-2 text-sm font-normal text-white/55">
                {games.length}
              </span>
            </h2>
          </div>

          {games.length === 0 ? (
            <p className="mt-6 text-white/60">-</p>
          ) : (
            <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {games.map((g) => {
                const name = isHe ? g.name_he : g.name_en;
                const desc = isHe ? g.description_he : g.description_en;
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
                        {g.thumbnail_url ? (
                          <Image
                            src={g.thumbnail_url}
                            alt={name}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
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
                          {isHe ? "להפעלה" : "Play now"}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function QuickStartTile({
  isHe,
  href,
  titleHe,
  titleEn,
  subHe,
  subEn,
  accent,
  Icon,
}: {
  isHe: boolean;
  href: string;
  titleHe: string;
  titleEn: string;
  subHe: string;
  subEn: string;
  accent: string;
  Icon: typeof Sparkles;
}) {
  const Arrow = isHe ? ArrowLeft : ArrowRight;
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-white/25"
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute -end-8 -top-8 h-40 w-40 rounded-full bg-gradient-to-br ${accent} opacity-25 blur-3xl transition group-hover:opacity-50`}
      />
      <div className="relative flex items-center justify-between gap-4">
        <div>
          <div
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${accent} shadow-lg shadow-black/40`}
          >
            <Icon className="h-5 w-5 text-white" />
          </div>
          <h3 className="mt-4 text-lg font-bold">{isHe ? titleHe : titleEn}</h3>
          <p className="mt-1 text-sm text-white/70">{isHe ? subHe : subEn}</p>
        </div>
        <Arrow className="h-5 w-5 text-white/60 transition group-hover:text-white" />
      </div>
    </Link>
  );
}
