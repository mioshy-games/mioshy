import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { unstable_noStore as noStore } from "next/cache";
import { Link } from "@/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth/admin";
import { fetchGameSettings } from "@/lib/settings-queries";
import type { GameRow, WheelConfigRow } from "@/lib/types/database";
import type { GameSettings } from "@/lib/types/settings";
import type { WheelSegment } from "@/components/Wheel";
import {
  ArrowRight,
  Gamepad2,
  HeartHandshake,
  Sparkles,
  Shield,
  Users,
} from "lucide-react";
import { AdminThumbnailEdit } from "@/components/games/AdminThumbnailEdit";
// Lazy wrapper: code-splits LiveDemoHero (which embeds the full Wheel +
// framer-motion + sound effects) out of the initial /games bundle. The
// wrapper renders a sized skeleton during initial paint, then hydrates
// the real interactive demo on the client. Big win on TTI for visitors
// who never spin the wheel.
import { LazyLiveDemoHero } from "@/components/marketing/v2/LazyLiveDemoHero";
import { MediaSlider } from "@/components/marketing/v2/MediaSlider";
import { Counter } from "@/components/marketing/v2/Counter";
import { RevealOnScroll } from "@/components/marketing/v2/RevealOnScroll";

/**
 * /games - the games category landing page.
 *
 * Sections (top → bottom):
 *  1. Hero (dark, animated aurora)
 *  2. Why Mioshy (light bg, big cards)
 *  3. Benefits - "מה זה עושה לכם" (dark editorial spread, 4 emotion words)
 *  4. Press mentions (light bg)
 *  5. Catalogue - all active wheel games + virtual snakes card (light bg)
 *  6. Personas - "למי זה מתאים" (light bg, 3 magazine chapters)
 */

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://mioshy.com").replace(
    /\/+$/,
    "",
  );
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const { locale } = params;
  const base = siteUrl();
  const t = await getTranslations({ locale, namespace: "gamesHub" });
  const title = `Mioshy - ${t("title")}`;
  const description = t("subtitle");
  const canonical = `${base}/${locale}/games`;
  return {
    title,
    description,
    keywords:
      locale === "he"
        ? [
            "משחקי זוגיות",
            "אמת או חובה",
            "משחקים לזוגות",
            "שאלות לזוגות",
            "סולמות ונחשים",
            "משחק זוגי בדפדפן",
          ]
        : [
            "couples games",
            "truth or dare for couples",
            "relationship games",
            "date night games",
            "couples questions",
            "snakes and ladders couples",
          ],
    alternates: {
      canonical,
      languages: {
        en: `${base}/en/games`,
        he: `${base}/he/games`,
        "x-default": `${base}/en/games`,
      },
    },
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
      siteName: "Mioshy",
    },
  };
}

export default async function GamesHubPage({
  params,
}: {
  params: { locale: string };
}) {
  noStore();
  const locale = params.locale;
  const isHe = locale === "he";
  const t = await getTranslations({ locale, namespace: "gamesHub" });

  const supabase = await createServerSupabaseClient();

  // Auth gate — same pattern as /adults: members skip the marketing
  // wrap and see just the catalog. Anonymous visitors get the full
  // story below.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthed = !!user;

  const { data } = await supabase
    .from("games")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  const games = (data ?? []) as GameRow[];

  // ─── Logged-in catalog-only view ──────────────────────────────────────
  // Per Itzik 2026-05-02: returning members shouldn't re-read the same
  // marketing page on every visit. They land on a clean, dense grid
  // of every active game with a section title.
  if (isAuthed) {
    return (
      <div
        dir={isHe ? "rtl" : "ltr"}
        className="relative min-h-[100dvh] bg-[#0E0810] text-white"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[60vh]"
          style={{
            background:
              "radial-gradient(900px 500px at 20% 0%, rgba(196,68,86,0.18), transparent 65%), " +
              "radial-gradient(800px 440px at 80% 10%, rgba(139,38,56,0.15), transparent 65%)",
          }}
        />
        <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-12 sm:pt-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/30 bg-rose-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-100">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
            {isHe ? "כל המשחקים" : "All Games"}
          </div>
          <h1 className="mt-3 font-heading text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {t("catalogueTitle")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            {isHe
              ? "בחרו משחק, פתחו על הטלפון, ומתחילים. בלי הורדות, בלי הכנות."
              : "Pick one, open it on your phone, and start. No downloads, no prep."}
          </p>

          {games.length === 0 ? (
            <p className="mt-12 text-white/60">
              {isHe ? "עדיין אין משחקים פעילים." : "No active games yet."}
            </p>
          ) : (
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {games.map((g) => {
                const name = isHe ? g.name_he : g.name_en;
                const desc = isHe ? g.description_he : g.description_en;
                return (
                  <li key={g.id}>
                    <Link
                      href={`/games/${g.slug}`}
                      className="group block overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 shadow-xl backdrop-blur transition hover:border-rose-300/40 hover:from-white/20"
                    >
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-rose-500/30 to-fuchsia-500/20">
                        {g.thumbnail_url ? (
                          <Image
                            src={g.thumbnail_url}
                            alt={name ?? ""}
                            width={640}
                            height={400}
                            className="h-full w-full object-cover transition group-hover:scale-105"
                            unoptimized
                          />
                        ) : null}
                        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
                      </div>
                      <div className="p-5">
                        <h3 className="text-xl font-bold text-white group-hover:text-rose-100">
                          {name}
                        </h3>
                        {desc ? (
                          <p className="mt-2 line-clamp-2 text-sm text-white/70">
                            {desc}
                          </p>
                        ) : null}
                        <div className="mt-5 flex items-center justify-between">
                          <span className="text-sm text-rose-200 group-hover:text-white">
                            {isHe ? "פתחו את המשחק" : "Open the game"} →
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}

              {/* ── Virtual snakes & ladders card (authenticated view) ──
                  Same hardcoded card the marketing page renders alongside
                  DB-backed wheel games. The board game isn't a row in
                  `games`, it's a standalone /game route — but logged-in
                  members expect to see EVERY active product in their
                  catalogue, not just the wheel-based ones. */}
              <li>
                <Link
                  href="/game"
                  className="group block overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 shadow-xl backdrop-blur transition hover:border-rose-300/40 hover:from-white/20"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-rose-500/30 via-fuchsia-500/25 to-violet-500/20">
                    <div className="absolute inset-0 flex items-center justify-center gap-3">
                      <span className="text-5xl drop-shadow-md">🐍</span>
                      <span className="text-4xl drop-shadow-md">🌈</span>
                    </div>
                    <span className="absolute end-3 top-3 rounded-full bg-gradient-to-r from-rose-400 to-fuchsia-400 px-3 py-1 text-xs font-bold text-white shadow-lg">
                      {isHe ? "חדש 🔥" : "New 🔥"}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
                  </div>
                  <div className="p-5">
                    <h3 className="text-xl font-bold text-white group-hover:text-rose-100">
                      {isHe ? "נחשים וסולמות" : "Snakes & Ladders"}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm text-white/70">
                      {isHe
                        ? "לוח קלאסי עם שאלות ואתגרים זוגיים — שחקו על מכשיר אחד או על שני מכשירים שונים."
                        : "Classic board with couples questions & challenges — play on one device or remotely."}
                    </p>
                    <div className="mt-5 flex items-center justify-between">
                      <span className="text-sm text-rose-200 group-hover:text-white">
                        {isHe ? "פתחו את המשחק" : "Open the game"} →
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            </ul>
          )}

        </main>
      </div>
    );
  }

  // ── Demo wheel data - fetch the live wheel_configs row of the
  //    "honesty-or-challenge" game so the hero's demo wheel uses
  //    the EXACT same slices/colours as the real production game.
  //    Falls back to wine-palette defaults inside LiveDemoHero if
  //    this lookup returns nothing. ───────────────────────────────
  const demoGame = games.find((g) => g.slug === "honesty-or-challenge") ?? null;
  let demoSlices: WheelSegment[] | null = null;
  let demoWheel: WheelConfigRow | null = null;
  let demoSettings: GameSettings | null = null;
  if (demoGame) {
    const [{ data: wheelData }, settings] = await Promise.all([
      supabase
        .from("wheel_configs")
        .select("*")
        .eq("game_id", demoGame.id)
        .maybeSingle(),
      fetchGameSettings(supabase, demoGame.id),
    ]);
    demoWheel = wheelData as WheelConfigRow | null;
    demoSettings = settings;
    if (demoWheel?.slices?.length) {
      demoSlices = demoWheel.slices.map((s) => ({
        type: s.question_type,
        label: isHe ? s.label_he : s.label_en,
        color: s.color,
      }));
    }
  }

  // Admin check - show image-edit overlay only to admins.
  const adminSession = await getAdminSession().catch(() => null);
  const isAdmin = !!adminSession;

  const base = siteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: t("breadcrumbHome"),
            item: `${base}/${locale}`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: t("breadcrumbGames"),
            item: `${base}/${locale}/games`,
          },
        ],
      },
      {
        "@type": "CollectionPage",
        name: t("title"),
        description: t("subtitle"),
        url: `${base}/${locale}/games`,
      },
      {
        "@type": "ItemList",
        itemListElement: games.map((g, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${base}/${locale}/games/${g.slug}`,
          name: isHe ? g.name_he : g.name_en,
        })),
      },
    ],
  };

  const whyItems = [0, 1, 2, 3].map((i) => ({
    h: t(`whyItems.${i}.h`),
    p: t(`whyItems.${i}.p`),
  }));

  // V2 unified palette - same card treatment for all 4, only icons differentiated.
  // No more rainbow. Warm cream bg + accent top-bar + warm-toned icon backgrounds.
  const whyMeta = [
    {
      Icon: Gamepad2,
      iconBg: "bg-[#B83C4D]",     // accent
      stat: isHe ? "10+ משחקים" : "10+ games",
    },
    {
      Icon: HeartHandshake,
      iconBg: "bg-[#8B2638]",     // accent-deep
      stat: isHe ? "מאות זוגות" : "Hundreds of couples",
    },
    {
      Icon: Sparkles,
      iconBg: "bg-[#4A1721]",     // wine
      stat: isHe ? "ללא התקנה" : "No install",
    },
    {
      Icon: Shield,
      iconBg: "bg-[#3D1F3D]",     // purple
      stat: isHe ? "פרטי ומאובטח" : "Private & secure",
    },
  ];

  const trust: { icon: "sparkles" | "heart" | "zap" | "infinity"; label: string }[] = [
    { icon: "sparkles", label: isHe ? "התנסות"          : "Try it"          },
    { icon: "heart",    label: isHe ? "לשני בני הזוג"   : "Built for couples" },
    { icon: "zap",      label: isHe ? "ללא התקנה"       : "No install"        },
    { icon: "infinity", label: isHe ? "זוגות מכל העולם" : "Couples worldwide" },
  ];

  // V2 wine palette - three subtle warm gradients for tile hover glows
  const accents = [
    "from-[#B83C4D]/30 via-[#8B2638]/20 to-[#4A1721]/20",
    "from-[#8B2638]/30 via-[#4A1721]/20 to-[#3D1F3D]/20",
    "from-[#4A1721]/30 via-[#3D1F3D]/20 to-[#1E0F1E]/20",
  ];

  // Editorial benefits - light cream spread, 3 focused emotion words.
  // Roman numerals + serif italic. Was 5; trimmed to תשוקה / חברות / כיף.
  const benefits = [
    {
      numeral: "I",
      title: isHe ? "תשוקה" : "Passion",
      body: isHe
        ? "השאלות הנכונות מחזירות את ההתרגשות הראשונית. בלי לדבר על זה. בלי תרגילים."
        : "The right questions bring back that early thrill. Without talking about it. Without 'exercises.'",
    },
    {
      numeral: "II",
      title: isHe ? "חברות" : "Friendship",
      body: isHe
        ? "תגלו על בני הזוג שלכם דברים שלא ידעתם - ועל החברים, דברים שלא חשבתם לשאול."
        : "Discover things about your partner - and your friends - you'd never have thought to ask.",
    },
    {
      numeral: "III",
      title: isHe ? "כיף" : "Fun",
      body: isHe
        ? "הנאה אמיתית, בלי תירוצים. ערב שמתחיל בקליק והופך למשחק שלא רוצים לסיים."
        : "Real enjoyment, no excuses. An evening that starts with a click and turns into a game you don't want to end.",
    },
  ];

  // Personas - magazine chapters on light. Three couple archetypes; tag = the
  // *promise* this game-line gives that persona (curiosity / reminder / surprise).
  const personas = [
    {
      num: "01",
      title: isHe ? "הזוגות החדשים" : "The new couples",
      tag: isHe ? "סקרנות" : "Curiosity",
      body: isHe
        ? "אתם רוצים לדעת הכל - אבל \"מה הכי הפחיד אותך כילד?\" לא נשאלת בקפה השני. אנחנו שואלים את זה בשבילכם, באופן שצוחק על הרצינות."
        : "You want to know everything - but \"what scared you most as a kid?\" doesn't fly on date two. We ask it for you - in a way that laughs at the seriousness of it.",
      quote: isHe
        ? "להכיר מישהו לעומק לא דורש שנים. רק את השאלה הנכונה."
        : "Knowing someone deeply doesn't take years. Just the right question.",
    },
    {
      num: "02",
      title: isHe ? "הזוגות באמצע" : "Couples in the middle",
      tag: isHe ? "תזכורת" : "Reminder",
      body: isHe
        ? "אתם לא איבדתם את הזוגיות. רק את הזמן לזכור אותה. מיאושי דוחס בחצי שעה את מה שמסעדה רומנטית עושה בשלוש."
        : "You haven't lost the relationship. Only the time to remember it. Mioshy compresses into thirty minutes what a romantic dinner does in three hours.",
      quote: isHe
        ? "חצי שעה במקום הנכון - זה לא מעט. זה הכל."
        : "Thirty minutes in the right place - isn't a little. It's everything.",
    },
    {
      num: "03",
      title: isHe ? "הזוגות הוותיקים" : "The veterans",
      tag: isHe ? "הפתעה" : "Surprise",
      body: isHe
        ? "אתם מסיימים אחד לשני את המשפטים. עכשיו רק צריך משפטים חדשים להתחיל. אנחנו לא נספר לכם משהו שלא ידעתם - רק נשאל את השאלה שלא חשבתם לשאול."
        : "You finish each other's sentences. Now you just need new sentences to start. We won't tell you something you didn't know - we'll just ask the question you didn't think to ask.",
      quote: isHe
        ? "מי שחושב שהוא יודע הכל - שואל את השאלות הלא נכונות."
        : "Anyone who thinks they know it all - is asking the wrong questions.",
    },
  ];

  return (
    <div
      className="relative min-h-[100dvh] overflow-hidden text-white"
      dir={isHe ? "rtl" : "ltr"}
    >
      {/* ── Dark hero backdrop (covers only the first viewport) - V2 wine palette ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-20 h-[110vh] bg-[linear-gradient(180deg,#0E0810_0%,#1A0B14_55%,#1E0F1E_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[80vh]"
        style={{
          background:
            "radial-gradient(1100px 600px at 12% 0%, rgba(196,68,86,0.22), transparent 62%), " +
            "radial-gradient(900px 520px at 88% 12%, rgba(139,38,56,0.18), transparent 60%), " +
            "radial-gradient(700px 460px at 50% 38%, rgba(74,23,33,0.18), transparent 65%)",
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="relative">

        {/* ════════════════════════════════════════════════════════════
            1. HERO - dark, animated
        ════════════════════════════════════════════════════════════ */}
        <section className="relative">
          <nav
            aria-label="breadcrumb"
            className="relative z-20 mx-auto hidden max-w-6xl items-center gap-2 px-4 pt-8 text-xs text-white/60 sm:flex"
          >
            <Link href="/" className="transition hover:text-white/90">
              {t("breadcrumbHome")}
            </Link>
            <span aria-hidden>/</span>
            <span className="text-white/80">{t("breadcrumbGames")}</span>
          </nav>

          <LazyLiveDemoHero
            isHe={isHe}
            title={t("h1")}
            lede={t("lede")}
            ctaPrimary={t("ctaPrimary")}
            ctaPrimaryHref="#catalogue"
            ctaSecondary={isHe ? "למה מיאושי?" : "Why Mioshy?"}
            ctaSecondaryHref="#why"
            badge={isHe ? "טעימה חיה · Mioshy" : "Live taste · Mioshy"}
            trust={trust}
            gameHref={demoGame ? `/games/${demoGame.slug}` : "#catalogue"}
            sampleQuestionType={isHe ? "אמת" : "Truth"}
            sampleQuestion={
              isHe
                ? "מה הרגע איתי שלא יוצא לך מהראש - ולמה דווקא הוא?"
                : "What moment with me can't you stop replaying - and why that one?"
            }
            slices={demoSlices}
            wheelConfig={demoWheel}
            gameSettings={demoSettings}
            gameSlug={demoGame?.slug ?? "honesty-or-challenge"}
            gameBgValue={demoGame?.bg_value ?? null}
          />
          {/* /LazyLiveDemoHero - the underlying LiveDemoHero is loaded via
              next/dynamic with ssr:false; see LazyLiveDemoHero.tsx. */}
        </section>

        {/* ════════════════════════════════════════════════════════════
            LIGHT SECTIONS - #why + #press + #catalogue
        ════════════════════════════════════════════════════════════ */}
        <div className="bg-[#FAF6F7] pb-[60px] text-slate-900">

          {/* ── Transition: dark → light wave divider ── */}
          <div className="pointer-events-none -mt-16 h-16 bg-[linear-gradient(to_bottom,transparent,#FAF6F7)]" />

          {/* ════════════════════════════════════════════════════════════
              2. WHY MIOSHY - light bg, big cards with stat chips
          ════════════════════════════════════════════════════════════ */}
          <section id="why" className="relative bg-[#FAF6F7] px-4 pb-14 pt-10 sm:pb-20 sm:pt-16">
            <div className="mx-auto max-w-6xl">
              <div className="mx-auto max-w-3xl text-center">
                {/* Eyebrow — bumped to 14px on mobile (16px equivalent
                    once you account for letter-spacing). */}
                <span className="inline-flex items-center gap-2.5 text-[14px] font-semibold uppercase tracking-[0.18em] text-[#170E14] sm:text-[13px]">
                  <span className="h-[7px] w-[7px] rounded-sm bg-[#B83C4D] shadow-[0_0_0_3px_rgba(184,60,77,0.18)]" />
                  {isHe ? "למה מיאושי" : "Why Mioshy"}
                </span>
                <h2 className="mt-4 font-heading text-3xl font-bold leading-[1.05] tracking-[-0.02em] text-[#170E14] sm:text-4xl lg:text-5xl">
                  {t("whyTitle")}
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-[17px] leading-[1.55] text-[#2A1B25] sm:mt-5 sm:text-[19px] sm:leading-[1.6]">
                  {isHe
                    ? "עזרנו למאות זוגות לשפר את הקשר שלהם - בדרך הכי כיפית שיש"
                    : "We've helped hundreds of couples improve their connection - in the most fun way possible"}
                </p>
              </div>

              {/* Unified card design — mobile tightened: padding 20px,
                  icon + stat chip on the same row (saves a wasted block
                  of vertical space), title 18px, body 16px to keep
                  every card scannable on a single phone scroll. */}
              <div className="mt-8 grid gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
                {whyItems.map((it, i) => {
                  const { Icon, iconBg, stat } = whyMeta[i]!;
                  return (
                    <div
                      key={i}
                      className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#EAE0E3] bg-[#FBF5F2] p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-md sm:rounded-3xl sm:p-7"
                    >
                      {/* Accent top-bar - same color for all cards (V2 brand) */}
                      <div
                        aria-hidden
                        className="absolute inset-x-0 top-0 h-[3px] origin-right scale-x-0 rounded-t-3xl bg-[#B83C4D] transition-transform duration-400 group-hover:scale-x-100"
                      />
                      {/* Mobile: icon + stat chip share a row (RTL: icon
                          on right, chip on left); desktop: stacked. */}
                      <div className="flex items-center justify-between gap-3 sm:block">
                        <div
                          className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${iconBg} text-white shadow-md sm:h-14 sm:w-14 sm:rounded-2xl`}
                        >
                          <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
                        </div>
                        <span className="inline-block rounded-full border border-[#EAE0E3] bg-[#FBE9EC] px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.05em] text-[#8B2638] sm:mt-4 sm:self-start">
                          {stat}
                        </span>
                      </div>
                      <h3 className="mt-3 font-heading text-[18px] font-bold leading-snug text-[#170E14] sm:mt-4 sm:text-xl">
                        {it.h}
                      </h3>
                      <p className="mt-1.5 flex-1 text-[18px] leading-[1.55] text-[#4A3A45] sm:mt-2 sm:leading-[1.6]">
                        {it.p}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Social proof - editorial pull-quote.
                  The numbers ARE the story: each one set in serif italic accent
                  inside a flowing magazine-style sentence, instead of a sterile
                  data row. Decorative em-dashes flank a small italic kicker line. */}
              <div className="mx-auto mt-16 max-w-3xl text-center">
                <span className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.32em] text-[#170E14]">
                  <span className="h-[7px] w-[7px] rounded-sm bg-[#B83C4D] shadow-[0_0_0_3px_rgba(184,60,77,0.18)]" />
                  {isHe ? "המספרים" : "By the numbers"}
                </span>

                {/* Main pull-quote - clean line breaks, no awkward wrapping. */}
                <p
                  className="mt-7 text-[30px] leading-[1.35] text-[#170E14] sm:text-[30px] lg:text-[34px]"
                  style={{
                    fontFamily: "'Frank Ruhl Libre', serif",
                    fontWeight: 500,
                  }}
                >
                  {isHe ? (
                    <>
                      כבר{" "}
                      <em
                        className="text-[#B83C4D]"
                        style={{ fontStyle: "italic", fontWeight: 700 }}
                      >
                        +<Counter to={500} /> זוגות מרחבי העולם
                      </em>
                      <br />
                      שיחקו ב
                      <em
                        className="text-[#B83C4D]"
                        style={{ fontStyle: "italic", fontWeight: 700 }}
                      >
                        משחקים המקוריים של מיאושי
                      </em>
                      .
                    </>
                  ) : (
                    <>
                      Already{" "}
                      <em
                        className="text-[#B83C4D]"
                        style={{ fontStyle: "italic", fontWeight: 700 }}
                      >
                        <Counter to={500} suffix="+" /> couples worldwide
                      </em>
                      <br />
                      have played{" "}
                      <em
                        className="text-[#B83C4D]"
                        style={{ fontStyle: "italic", fontWeight: 700 }}
                      >
                        Mioshy&apos;s original games
                      </em>
                      .
                    </>
                  )}
                </p>

                {/* Trial line - its own line, black italic, smaller weight.
                    Honest, qualified "free" framing: explicit no-credit-card
                    promise so the 6-spin paywall later doesn't feel like a
                    trap. */}
                <p
                  className="mt-4 text-[22px] leading-[1.4] text-[#170E14] sm:text-[24px] lg:text-[28px]"
                  style={{
                    fontFamily: "'Frank Ruhl Libre', serif",
                    fontStyle: "italic",
                    fontWeight: 500,
                  }}
                >
                  {isHe
                    ? "התחילו חינם - בלי כרטיס אשראי."
                    : "Start free - no credit card required."}
                </p>

                {/* Italic kicker line, flanked by decorative hairlines */}
                <div className="mt-10 flex items-center justify-center gap-4">
                  <span
                    aria-hidden
                    className="h-px w-16 bg-[#B83C4D]/40"
                  />
                  <p
                    className="text-[14px] uppercase tracking-[0.22em] text-[#8B2638]"
                    style={{
                      fontFamily: "'Frank Ruhl Libre', serif",
                      fontStyle: "italic",
                      fontWeight: 500,
                    }}
                  >
                    {isHe
                      ? "בקליק אחד מתחילים"
                      : "one click - and you're in"}
                  </p>
                  <span
                    aria-hidden
                    className="h-px w-16 bg-[#B83C4D]/40"
                  />
                </div>

                {/* CTA - delivers on the kicker's promise: one click → game */}
                <div className="mt-7">
                  <Link
                    href={
                      demoGame ? `/games/${demoGame.slug}` : "#catalogue"
                    }
                    className="group relative inline-flex min-h-[52px] items-center justify-center overflow-hidden rounded-full px-9 text-[16px] font-semibold text-white shadow-lg shadow-[#B83C4D]/30 transition hover:brightness-110"
                  >
                    <span
                      aria-hidden
                      className="absolute inset-0 bg-[linear-gradient(110deg,#B83C4D_0%,#8B2638_55%,#3D1F3D_100%)]"
                    />
                    <span className="relative z-10 inline-flex items-center">
                      {isHe ? "התחילו לשחק עכשיו" : "Start playing now"}
                      <ArrowRight
                        className={`ms-2 h-5 w-5 transition group-hover:translate-x-1 ${
                          isHe ? "rotate-180 group-hover:-translate-x-1" : ""
                        }`}
                      />
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════
              3. PRESS - Hebrew-only. The press logos are all Israeli
              outlets (ישראל היום, walla, מגזין החיים, TLD), and we don't
              have English-language press to swap in for the EN locale,
              so we hide the whole block entirely outside Hebrew rather
              than show foreign-language logos that confuse the reader.
              Mobile padding tightened to remove the dead air the user
              flagged between the CTA above and the press headline.
          ════════════════════════════════════════════════════════════ */}
          {isHe ? (
            <section
              id="press"
              className="relative overflow-hidden bg-[#FAF6F7] px-4 py-8 sm:py-20"
            >
              {/* Drifting peach blob - heavy blur, enters from screen-left */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-0 overflow-hidden"
              >
                <div
                  className="absolute top-[18%] -left-[12%] h-[620px] w-[620px] rounded-full mio-press-blob"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(232,193,177,0.6), rgba(232,193,177,0.3) 45%, transparent 75%)",
                    filter: "blur(90px)",
                    willChange: "transform",
                  }}
                />
              </div>

              <div
                className="home-v2 relative"
                dir="rtl"
              >
                <MediaSlider />
              </div>
            </section>
          ) : null}

          {/* ════════════════════════════════════════════════════════════
              4. CATALOGUE - all wheel games + snakes virtual card
          ════════════════════════════════════════════════════════════ */}
          <section id="catalogue" className="relative bg-white px-4 pb-24 pt-14">
            {/* Subtle V2-tinted gradient mesh */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 opacity-40"
              style={{
                background:
                  "radial-gradient(800px 600px at 15% 40%, rgba(184,60,77,0.06), transparent 60%), " +
                  "radial-gradient(700px 500px at 85% 60%, rgba(139,38,56,0.05), transparent 60%)",
              }}
            />

            <div className="mx-auto max-w-6xl">
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <span className="inline-flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.2em] text-[#170E14]">
                    <span className="h-[7px] w-[7px] rounded-sm bg-[#B83C4D] shadow-[0_0_0_3px_rgba(184,60,77,0.18)]" />
                    {isHe ? "כל המשחקים" : "All Games"}
                  </span>
                  <h2 className="mt-4 font-heading text-3xl font-bold leading-[1.05] tracking-[-0.02em] text-[#170E14] sm:text-4xl lg:text-5xl">
                    {t("catalogueTitle")}
                  </h2>
                </div>
                <p className="max-w-sm text-[18px] leading-[1.6] text-[#4A3A45]">
                  {isHe
                    ? "בחרו משחק, פתחו על הטלפון, ומתחילים. בלי הורדות, בלי הכנות."
                    : "Pick one, open it on your phone, and start. No downloads, no prep."}
                </p>
              </div>

              {games.length === 0 && (
                <p className="mt-10 text-[#7A6A75]">-</p>
              )}

              <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {/* ── Regular wheel games from DB ── */}
                {games.map((g, idx) => {
                  const name = isHe ? g.name_he : g.name_en;
                  const desc = isHe ? g.description_he : g.description_en;
                  const accent = accents[idx % accents.length]!;
                  return (
                    <li key={g.id} className="group relative">
                      {/* Hover glow */}
                      <div
                        aria-hidden
                        className={`pointer-events-none absolute -inset-px -z-10 rounded-[28px] bg-gradient-to-br ${accent} opacity-0 blur-xl transition duration-500 group-hover:opacity-60`}
                      />
                      <Link
                        href={`/games/${g.slug}`}
                        className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-[#EAE0E3] bg-[#FBF5F2] shadow-md shadow-[#EAE0E3]/40 transition duration-300 hover:-translate-y-1 hover:border-[#E9C4CA] hover:shadow-[#FBE9EC]/60"
                      >
                        {/* Thumbnail */}
                        <div className="relative aspect-[16/10] w-full overflow-hidden">
                          {g.thumbnail_url ? (
                            <>
                              <Image
                                src={g.thumbnail_url}
                                alt={name}
                                fill
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                className="object-cover transition duration-700 group-hover:scale-[1.05]"
                              />
                              <div
                                aria-hidden
                                className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"
                              />
                            </>
                          ) : (
                            <div
                              className={`grid h-full w-full place-items-center bg-gradient-to-br ${accent}`}
                            >
                              <Gamepad2 className="h-12 w-12 text-white/70" />
                            </div>
                          )}
                          {/* Admin image-swap overlay */}
                          {isAdmin && <AdminThumbnailEdit gameId={g.id} />}
                        </div>

                        <div className="flex flex-1 flex-col p-6">
                          <h3 className="font-heading text-xl font-bold leading-tight text-[#170E14]">
                            {name}
                          </h3>
                          {desc ? (
                            <p className="mt-2 line-clamp-3 text-[20px] leading-[1.5] text-[#4A3A45] sm:text-[18px]">
                              {desc}
                            </p>
                          ) : null}
                          <span className="mt-auto inline-flex items-center gap-2 pt-5 text-[18px] font-semibold text-[#B83C4D] transition group-hover:text-[#8B2638]">
                            {t("ctaPrimary")}
                            <ArrowRight
                              className={`h-5 w-5 transition group-hover:translate-x-1 ${
                                isHe ? "rotate-180 group-hover:-translate-x-1" : ""
                              }`}
                            />
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}

                {/* ── Virtual snakes & ladders card - V2 wine palette ── */}
                <li className="group relative">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -inset-px -z-10 rounded-[28px] bg-gradient-to-br from-[#B83C4D]/30 via-[#8B2638]/20 to-[#3D1F3D]/20 opacity-0 blur-xl transition duration-500 group-hover:opacity-60"
                  />
                  <Link
                    href="/game"
                    className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-[#EAE0E3] bg-white shadow-md shadow-[#EAE0E3]/40 transition duration-300 hover:-translate-y-1 hover:border-[#E9C4CA] hover:shadow-[#FBE9EC]/60"
                  >
                    {/* Thumbnail - V2 warm gradient */}
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-[#B83C4D]/20 via-[#8B2638]/15 to-[#3D1F3D]/20">
                      <div className="absolute inset-0 flex items-center justify-center gap-3">
                        <span className="text-5xl drop-shadow-md">🐍</span>
                        <span className="text-4xl drop-shadow-md">🌈</span>
                      </div>
                      {/* New badge */}
                      <span className="absolute end-3 top-3 rounded-full bg-gradient-to-r from-[#B83C4D] to-[#8B2638] px-3 py-1 text-xs font-bold text-white shadow-lg">
                        {isHe ? "חדש 🔥" : "New 🔥"}
                      </span>
                      <div
                        aria-hidden
                        className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent"
                      />
                    </div>

                    <div className="flex flex-1 flex-col p-6">
                      {/* Multi-player badge - V2 accent-bg */}
                      <span className="mb-3 inline-flex items-center gap-1.5 self-start rounded-full border border-[#E9C4CA] bg-[#FBE9EC] px-2.5 py-0.5 text-xs font-semibold text-[#8B2638]">
                        <Users className="h-3 w-3" />
                        {isHe ? "עד 8 שחקנים" : "Up to 8 players"}
                      </span>
                      <h3 className="font-heading text-xl font-bold leading-tight text-[#170E14]">
                        {isHe ? "נחשים וסולמות" : "Snakes & Ladders"}
                      </h3>
                      <p className="mt-2 line-clamp-3 text-[20px] leading-[1.5] text-[#4A3A45] sm:text-[18px]">
                        {isHe
                          ? "לוח קלאסי עם שאלות ואתגרים זוגיים - שחקו על מכשיר אחד או על שני מכשירים שונים"
                          : "Classic board game with couples questions & challenges - play on one device or remotely"}
                      </p>
                      <span className="mt-auto inline-flex items-center gap-2 pt-5 text-[18px] font-semibold text-[#B83C4D] transition group-hover:text-[#8B2638]">
                        {isHe ? "שחקו עכשיו" : "Play now"}
                        <ArrowRight
                          className={`h-5 w-5 transition group-hover:translate-x-1 ${
                            isHe ? "rotate-180 group-hover:-translate-x-1" : ""
                          }`}
                        />
                      </span>
                    </div>
                  </Link>
                </li>
              </ul>

            </div>
          </section>
          {/* ════════════════════════════════════════════════════════════
              5. PERSONAS - "למי זה מתאים" (magazine chapters on cream)
                  3 cards w/ giant chapter number, persona title, italic
                  tag, body, and italic quote at the bottom.
          ════════════════════════════════════════════════════════════ */}
          <section
            id="personas"
            className="relative overflow-hidden bg-[#FAF6F7] px-4 py-[80px]"
          >
            {/* Soft accent glow at top */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-0"
              style={{
                background:
                  "radial-gradient(900px 500px at 50% -10%, rgba(184,60,77,0.07), transparent 60%)",
              }}
            />

            <div className="relative mx-auto max-w-6xl">
              <RevealOnScroll variant="scale-up">
                <div className="mx-auto max-w-2xl text-center">
                  <span className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.32em] text-[#170E14]">
                    <span className="h-[7px] w-[7px] rounded-sm bg-[#B83C4D] shadow-[0_0_0_3px_rgba(184,60,77,0.18)]" />
                    {isHe ? "למי" : "For whom"}
                  </span>
                  <h2
                    className="mt-7 text-[40px] leading-[1.05] tracking-[-0.02em] text-[#170E14] sm:text-5xl lg:text-[58px]"
                    style={{
                      fontFamily: "'Frank Ruhl Libre', serif",
                      fontWeight: 600,
                    }}
                  >
                    {isHe ? (
                      <>
                        אין זוגיות משעממת.
                        <br className="hidden sm:block" />
                        <span
                          className="text-[#B83C4D]"
                          style={{ fontStyle: "italic", fontWeight: 500 }}
                        >
                          רק שאלות שלא נשאלו.
                        </span>
                      </>
                    ) : (
                      <>
                        There are no boring couples.
                        <br className="hidden sm:block" />
                        <span
                          className="text-[#B83C4D]"
                          style={{ fontStyle: "italic", fontWeight: 500 }}
                        >
                          Only questions never asked.
                        </span>
                      </>
                    )}
                  </h2>
                  <p className="mx-auto mt-6 max-w-xl text-[19px] leading-[1.65] text-[#4A3A45]">
                    {isHe
                      ? "בכל שלב בזוגיות מחכות שאלות. אנחנו רק יודעים מתי לשאול אותן."
                      : "Every stage of a relationship has its waiting questions. We just know when to ask them."}
                  </p>
                </div>
              </RevealOnScroll>

              {/* 3 magazine chapters */}
              <div className="mt-[80px] grid gap-8 lg:grid-cols-3 lg:gap-7">
                {personas.map((p, i) => (
                  <RevealOnScroll
                    key={i}
                    variant="fade-up"
                    delay={0.05 + i * 0.1}
                  >
                    <article className="group relative flex h-full flex-col overflow-hidden rounded-[28px] border border-[#EAE0E3] bg-white p-9 shadow-sm transition duration-500 hover:-translate-y-2 hover:border-transparent hover:shadow-[0_28px_56px_-20px_rgba(74,23,33,0.22)] sm:p-10">
                      {/* Hover gradient accent (top-right corner) */}
                      <div
                        aria-hidden
                        className="pointer-events-none absolute -end-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-[#B83C4D]/0 via-[#B83C4D]/0 to-[#B83C4D]/0 opacity-0 blur-3xl transition duration-700 group-hover:from-[#B83C4D]/20 group-hover:via-[#8B2638]/15 group-hover:opacity-100"
                      />

                      {/* Chapter number + animated line */}
                      <div className="relative flex items-baseline gap-4">
                        <span
                          className="text-[72px] leading-none text-[#B83C4D]/25 transition-colors duration-500 group-hover:text-[#B83C4D]/50 sm:text-[80px]"
                          style={{
                            fontFamily: "'Frank Ruhl Libre', serif",
                            fontWeight: 600,
                          }}
                        >
                          {p.num}
                        </span>
                        <span className="h-px flex-1 bg-[#EAE0E3] transition-colors duration-500 group-hover:bg-[#B83C4D]/40" />
                      </div>

                      {/* Italic tag (small, accent) */}
                      <p
                        className="relative mt-6 text-[14px] uppercase tracking-[0.22em] text-[#B83C4D]"
                        style={{
                          fontFamily: "'Frank Ruhl Libre', serif",
                          fontStyle: "italic",
                          fontWeight: 500,
                        }}
                      >
                        {p.tag}
                      </p>

                      {/* Persona title */}
                      <h3
                        className="relative mt-3 text-[30px] leading-[1.1] tracking-[-0.01em] text-[#170E14] sm:text-[34px]"
                        style={{
                          fontFamily: "'Frank Ruhl Libre', serif",
                          fontWeight: 600,
                        }}
                      >
                        {p.title}
                      </h3>

                      {/* Body */}
                      <p className="relative mt-5 text-[18px] leading-[1.7] text-[#4A3A45]">
                        {p.body}
                      </p>

                      {/* Italic quote - bottom */}
                      <div className="relative mt-auto pt-8">
                        <div className="mb-4 h-px w-12 bg-[#B83C4D]/30" />
                        <p
                          className="text-[18px] leading-[1.5] text-[#170E14]/80"
                          style={{
                            fontFamily: "'Frank Ruhl Libre', serif",
                            fontStyle: "italic",
                            fontWeight: 500,
                          }}
                        >
                          {isHe ? "״" : "“"}
                          {p.quote}
                          {isHe ? "״" : "”"}
                        </p>
                      </div>
                    </article>
                  </RevealOnScroll>
                ))}
              </div>
            </div>
          </section>
          {/* ════════════════════════════════════════════════════════════
              BENEFITS - "מה זה עושה לכם" (moved to bottom, above footer)
                   Editorial spread: serif-italic emotion words, hairline rows.
          ════════════════════════════════════════════════════════════ */}
          <section
            id="benefits"
            className="relative mx-4 mt-6 overflow-hidden bg-white px-6 py-[60px] sm:mx-8 sm:px-10 lg:mx-12 lg:px-14"
          >
            <div className="relative mx-auto max-w-4xl">
              {/* Header - right-aligned (RTL natural). Single reading axis, no
                  center→right awkwardness. */}
              <RevealOnScroll variant="scale-up">
                <div className="text-start">
                  <span className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.32em] text-[#170E14]">
                    <span className="h-[7px] w-[7px] rounded-sm bg-[#B83C4D] shadow-[0_0_0_3px_rgba(184,60,77,0.18)]" />
                    {isHe ? "למה זה עובד" : "Why it works"}
                  </span>
                  <h2
                    className="mt-7 text-[40px] leading-[1.05] tracking-[-0.02em] text-[#170E14] sm:text-5xl lg:text-[60px]"
                    style={{
                      fontFamily: "'Frank Ruhl Libre', serif",
                      fontWeight: 600,
                    }}
                  >
                    {isHe ? (
                      <>
                        שאלה אחת.{" "}
                        <span
                          className="text-[#B83C4D]"
                          style={{ fontStyle: "italic", fontWeight: 500 }}
                        >
                          ערב שלם אחר.
                        </span>
                      </>
                    ) : (
                      <>
                        One question.{" "}
                        <span
                          className="text-[#B83C4D]"
                          style={{ fontStyle: "italic", fontWeight: 500 }}
                        >
                          An entirely different evening.
                        </span>
                      </>
                    )}
                  </h2>
                  <p className="mt-6 max-w-2xl text-[19px] leading-[1.65] text-[#4A3A45]">
                    {isHe
                      ? "לא טיפול. לא קורס. לא 'כלים לזוגיות'. משחק. אבל אחד שעובד."
                      : "Not therapy. Not a course. Not 'tools for relationships.' A game - but one that works."}
                  </p>
                </div>
              </RevealOnScroll>

              {/* Editorial benefit rows - 2-column structure */}
              <ul className="mt-[60px] space-y-2">
                {benefits.map((b, i) => (
                  <RevealOnScroll
                    key={i}
                    variant="fade-up"
                    delay={0.1 + i * 0.1}
                  >
                    <li className="group grid gap-y-4 border-t border-[#EAE0E3] pt-8 transition-colors duration-300 hover:border-[#B83C4D]/40 lg:grid-cols-[240px_1fr] lg:items-baseline lg:gap-x-[45px] lg:pt-9">
                      {/* Title cluster - numeral + word inline, baseline-aligned */}
                      <div className="flex items-baseline gap-3">
                        <span
                          className="text-[22px] tracking-[0.08em] text-[#B83C4D] transition-colors duration-300 group-hover:text-[#8B2638] sm:text-[24px]"
                          style={{
                            fontFamily: "'Frank Ruhl Libre', serif",
                            fontStyle: "italic",
                            fontWeight: 500,
                          }}
                        >
                          {b.numeral}
                        </span>
                        <h3
                          className="text-[36px] leading-[1] tracking-[-0.02em] text-[#170E14] sm:text-[40px]"
                          style={{
                            fontFamily: "'Frank Ruhl Libre', serif",
                            fontStyle: "italic",
                            fontWeight: 500,
                          }}
                        >
                          {b.title}
                        </h3>
                      </div>

                      {/* Body */}
                      <p className="text-[18px] leading-[1.65] text-[#4A3A45] lg:-mt-[5px]">
                        {b.body}
                      </p>
                    </li>
                  </RevealOnScroll>
                ))}
                {/* Final hairline so the last row has bottom delimiter symmetry */}
                <li
                  aria-hidden
                  className="!mt-2 h-px w-full bg-[#EAE0E3]"
                />
              </ul>

              {/* Closing italic - kept right-aligned to match the new axis */}
              <RevealOnScroll variant="fade" delay={0.4}>
                <p
                  className="mt-10 max-w-xl text-[18px] text-[#7A6A75] lg:mt-12"
                  style={{
                    fontFamily: "'Frank Ruhl Libre', serif",
                    fontStyle: "italic",
                  }}
                >
                  {isHe
                    ? "- לפעמים שינוי לא דורש מהפכה. רק התחלה."
                    : "- sometimes change doesn't need a revolution. Just a start."}
                </p>
              </RevealOnScroll>
            </div>
          </section>
        </div>
        {/* ── end light sections ── */}

      </main>
    </div>
  );
}
