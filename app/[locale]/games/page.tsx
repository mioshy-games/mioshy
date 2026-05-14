import type { Metadata } from "next";
import Image from "next/image";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";
import { loadCmsTextsForPage } from "@/lib/cms/server";
import { CmsTextProvider } from "@/components/cms/CmsTextProvider";
import { CmsText } from "@/components/cms/CmsText";
import { unstable_noStore as noStore } from "next/cache";
import { safeJsonLd } from "@/lib/seo/jsonLd";
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
import { pickGameThumbnail } from "@/lib/games-thumbnail";
import { GamesPageAtmosphere } from "@/components/games/GamesPageAtmosphere";

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
  const t = await getCmsTranslations({
    locale: locale === "he" ? "he" : "en",
    namespace: "gamesHub",
    page: "games",
  });
  const title = `Mioshy - ${t("title")}`;
  const description = t("subtitle");
  const canonical = `${base}/${locale}/games`;
  return {
    title,
    description,
    keywords:
      locale === "he"
        ? [
            "משחקי זוגות אונליין",
            "אמת או חובה",
            "משחקי זוגות",
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

// Build marker - bumped when we ship significant changes to /games so
// we can correlate "I don't see the change" reports with the actual
// build the visitor's browser fetched. Surfaces in both server logs
// and the client console (see <script> at end of each return tree).
const GAMES_PAGE_BUILD = "2026-05-06-dark-ambient-v1";

export default async function GamesHubPage({
  params,
}: {
  params: { locale: string };
}) {
  noStore();
  const locale = params.locale;
  const isHe = locale === "he";
  // CMS-backed translator — retained for raw-string slots (metadata,
  // JSON-LD, alt props, sub-component string props). JSX-child
  // consumers below render via <CmsText> so they pick up is_rich
  // from each row and render <em>/<strong> via the .cms-rich CSS rule.
  // Bug fix 2026-05-13: pre-CmsTextProvider rendering ignored is_rich
  // and printed admin-entered <em> tags as literal text in the DOM.
  const t = await getCmsTranslations({
    locale: isHe ? "he" : "en",
    namespace: "gamesHub",
    page: "games",
  });
  const cmsRows = await loadCmsTextsForPage("games");

  const supabase = await createServerSupabaseClient();

  // Auth gate - same pattern as /adults: members skip the marketing
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

  // Diagnostic log - Itzik 2026-05-06 reported "I don't see the change".
  // Most common cause: signed-in users hit the AUTHED catalog (line 132)
  // not the marketing return at the bottom. This print tells us which
  // path executed and which build was deployed when the request landed.
  // Visible in `vercel logs <deployment>` and in the local dev console.
  console.log("[GamesHubPage]", JSON.stringify({
    build: GAMES_PAGE_BUILD,
    locale,
    isAuthed,
    userId: user?.id ?? null,
    view: isAuthed ? "authed-catalog" : "marketing",
    games: games.length,
  }));

  // ─── Logged-in catalog-only view ──────────────────────────────────────
  // Per Itzik 2026-05-02: returning members shouldn't re-read the same
  // marketing page on every visit. They land on a clean, dense grid
  // of every active game with a section title.
  if (isAuthed) {
    // No bg-color on the wrapper - GamesPageAtmosphere supplies the
    // base gradient via a child layer. A solid bg here would create a
    // stacking opaque surface that paints OVER negative-z children
    // (the gradient at -z-30, the radial wash at -z-20, the floating
    // blobs/orbits at -z-10) and the whole atmosphere would be
    // invisible. Itzik 2026-05-06: this is exactly the bug that
    // made "I don't see the change" reproducible.
    return (
      <CmsTextProvider rows={cmsRows}>
      <div
        dir={isHe ? "rtl" : "ltr"}
        className="relative min-h-[100dvh] overflow-hidden text-white"
      >
        {/* Build marker - visible in browser console so we can confirm
            the new build landed for this visitor. Itzik 2026-05-06. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `console.log("[GamesHub/client]", { build: ${JSON.stringify(GAMES_PAGE_BUILD)}, view: "authed-catalog" });`,
          }}
        />
        <GamesPageAtmosphere />
        <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-12 sm:pt-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/30 bg-rose-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-100">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
            {isHe ? "הקטלוג" : "Catalogue"}
          </div>
          <CmsText
            cmsKey="gamesHub.catalogueTitle"
            as="h1"
            className="mt-3 font-heading text-3xl font-bold leading-tight tracking-tight sm:text-4xl"
          />
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
            // Catalogue grid — 2 per row (was 3) per Itzik 2026-05-07.
            // Bigger card footprint reads as fewer "products" and more
            // "experiences".
            <ul className="mt-10 grid gap-7 sm:grid-cols-2">
              {games.map((g) => {
                const name = isHe ? g.name_he : g.name_en;
                const desc = isHe ? g.description_he : g.description_en;
                const thumb = pickGameThumbnail(g, locale);
                return (
                  <li key={g.id}>
                    <Link
                      href={`/games/${g.slug}`}
                      className="group block overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 shadow-xl backdrop-blur transition hover:border-rose-300/40 hover:from-white/20"
                    >
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-rose-500/30 to-fuchsia-500/20">
                        {thumb ? (
                          <Image
                            src={thumb}
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
                          <p className="mt-2 line-clamp-2 text-sm text-white/70 transition-[max-height,color] duration-500 ease-in-out group-hover:line-clamp-none">
                            {desc}
                          </p>
                        ) : null}
                        <div className="mt-5 flex items-center justify-between">
                          <span className="text-sm text-rose-200 group-hover:text-white">
                            {isHe ? "שחקו עכשיו ←" : "Play the game →"}
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
                  `games`, it's a standalone /game route - but logged-in
                  members expect to see EVERY active product in their
                  catalogue, not just the wheel-based ones. */}
              <li>
                <Link
                  href="/game"
                  className="group block overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 shadow-xl backdrop-blur transition hover:border-rose-300/40 hover:from-white/20"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-rose-500/30 via-fuchsia-500/25 to-violet-500/20">
                    {/* Thumbnail - drop the image at
                        /public/images/snakes-couples.webp (16:10 ratio
                        recommended, e.g. 1280×800). */}
                    <Image
                      src="/images/snakes-couples.webp"
                      alt={isHe ? "נחשים וסולמות" : "Snakes & Ladders"}
                      fill
                      sizes="(max-width: 640px) 100vw, 50vw"
                      className="object-cover transition duration-500 group-hover:scale-[1.02]"
                    />
                    <span className="absolute end-3 top-3 rounded-full bg-gradient-to-r from-rose-400 to-fuchsia-400 px-3 py-1 text-xs font-bold text-white shadow-lg">
                      {isHe ? "חדש 🔥" : "New 🔥"}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
                  </div>
                  <div className="p-5">
                    <h3 className="text-xl font-bold text-white group-hover:text-rose-100">
                      {isHe ? "נחשים וסולמות" : "Snakes & Ladders"}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm text-white/70 transition-[max-height,color] duration-500 ease-in-out group-hover:line-clamp-none">
                      {isHe
                        ? "לוח קלאסי עם שאלות ואתגרים זוגיים - שחקו על מכשיר אחד או על שני מכשירים שונים."
                        : "Classic board with couples questions & challenges - play on one device or remotely."}
                    </p>
                    <div className="mt-5 flex items-center justify-between">
                      <span className="text-sm text-rose-200 group-hover:text-white">
                        {isHe ? "שחקו עכשיו ←" : "Play the game →"}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            </ul>
          )}

        </main>
      </div>
      </CmsTextProvider>
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
    <CmsTextProvider rows={cmsRows}>
    <div
      className="relative min-h-[100dvh] overflow-hidden text-white"
      dir={isHe ? "rtl" : "ltr"}
    >
      {/* Build marker - visible in browser console so we can confirm
          the new build landed. Itzik 2026-05-06. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `console.log("[GamesHub/client]", { build: ${JSON.stringify(GAMES_PAGE_BUILD)}, view: "marketing" });`,
        }}
      />

      {/* ── Dark hero backdrop (covers ONLY the first viewport - 110vh).
          Per Itzik 2026-05-06: revert of the page-wide dark treatment.
          The dark atmosphere belongs to the hero + the #catalogue section
          only; the marketing copy in between (Why / Press / Personas /
          Benefits) reads on the cream surface like the original design. */}
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
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <main className="relative">

        {/* ════════════════════════════════════════════════════════════
            1. HERO - dark, animated
        ════════════════════════════════════════════════════════════ */}
        <section className="relative">
          {/* Breadcrumb sits over the hero gradient — no separate band.
              Padding tightened (pt-8 → pt-4) and opacity lowered so it
              integrates into the atmosphere instead of reading as its own
              row. Per Itzik 2026-05-07. */}
          <nav
            aria-label="breadcrumb"
            className="relative z-20 mx-auto hidden max-w-6xl items-center gap-2 px-4 pt-4 text-[13px] text-white/45 sm:flex"
          >
            <Link href="/" className="transition hover:text-white/75">
              <CmsText cmsKey="gamesHub.breadcrumbHome" />
            </Link>
            <span aria-hidden className="text-white/30">/</span>
            <CmsText
              cmsKey="gamesHub.breadcrumbGames"
              as="span"
              className="text-white/65"
            />
          </nav>

          {/* Per Itzik 2026-05-07: secondary CTA "למה מיאושי?" removed
              from the hero — the section "Why Mioshy" lives just below
              and is reached by scrolling. The hero now has one primary
              CTA only ("All games") for less visual noise. */}
          <LazyLiveDemoHero
            isHe={isHe}
            title={t("h1")}
            lede={t("lede")}
            ctaPrimary={t("ctaPrimary")}
            ctaPrimaryHref="#catalogue"
            ctaSecondary={undefined}
            ctaSecondaryHref={undefined}
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
            LIGHT SECTIONS - #why + #press + #catalogue + #personas
            Itzik 2026-05-06 revert: the marketing copy below the hero
            reads on a cream surface (original design). Only the
            #catalogue section inside this wrapper opts back into a dark
            surface - see its own bg/style block.
        ════════════════════════════════════════════════════════════ */}
        <div className="bg-[#FAF6F7] pb-[60px] text-slate-900">

          {/* ── Transition: dark → light wave divider ── */}
          <div className="pointer-events-none -mt-16 h-16 bg-[linear-gradient(to_bottom,transparent,#FAF6F7)]" />

          {/* ════════════════════════════════════════════════════════════
              2. WHY MIOSHY - light bg, big cards with stat chips
          ════════════════════════════════════════════════════════════ */}
          {/* #why bottom padding tightened (sm:pb-20 → sm:pb-[60px])
              per Itzik 2026-05-07 — combined with press's pt-[60px]
              below, the gap from "Why" content to "במילים שלהם" is
              exactly 60+60=120px on desktop instead of 160px. */}
          <section id="why" className="relative bg-[#FAF6F7] px-4 pb-12 pt-10 sm:pb-[60px] sm:pt-16">
            <div className="mx-auto max-w-6xl">
              <div className="mx-auto max-w-3xl text-center">
                {/* Eyebrow - bumped to 14px on mobile (16px equivalent
                    once you account for letter-spacing). */}
                <span className="inline-flex items-center gap-2.5 text-[14px] font-semibold uppercase tracking-[0.18em] text-[#170E14] sm:text-[13px]">
                  <span className="h-[7px] w-[7px] rounded-sm bg-[#B83C4D] shadow-[0_0_0_3px_rgba(184,60,77,0.18)]" />
                  {isHe ? "למה מיאושי" : "Why Mioshy"}
                </span>
                <CmsText
                  cmsKey="gamesHub.whyTitle"
                  as="h2"
                  className="mt-4 font-heading text-3xl font-bold leading-[1.05] tracking-[-0.02em] text-[#170E14] sm:text-4xl lg:text-5xl"
                />
                <p className="mx-auto mt-4 max-w-xl text-[17px] leading-[1.55] text-[#2A1B25] sm:mt-5 sm:text-[19px] sm:leading-[1.6]">
                  {isHe
                    ? "עזרנו למאות זוגות לשפר את הקשר שלהם - בדרך הכי כיפית שיש"
                    : "We've helped hundreds of couples improve their connection - in the most fun way possible"}
                </p>
              </div>

              {/* Unified card design - mobile tightened: padding 20px,
                  icon + stat chip on the same row (saves a wasted block
                  of vertical space), title 18px, body 16px to keep
                  every card scannable on a single phone scroll. */}
              <div className="mt-8 grid gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => {
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
                      <CmsText
                        cmsKey={`gamesHub.whyItems.${i}.h`}
                        as="h3"
                        className="mt-3 font-heading text-[18px] font-bold leading-snug text-[#170E14] sm:mt-4 sm:text-xl"
                      />
                      <CmsText
                        cmsKey={`gamesHub.whyItems.${i}.p`}
                        as="p"
                        className="mt-1.5 flex-1 text-[18px] leading-[1.55] text-[#4A3A45] sm:mt-2 sm:leading-[1.6]"
                      />
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
              className="relative overflow-hidden bg-[#FAF6F7] px-4 py-8 sm:py-[60px]"
            >
              {/* Drifting peach blob - heavy blur, enters from screen-left */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-0 overflow-hidden"
              >
                <div
                  className="absolute top-[18%] -left-[12%] h-[620px] w-[620px] rounded-full mio-press-blob"
                  style={{
                    /* Peach glow restored - the press section is back on
                       a cream surface so the original soft-peach drift
                       fits the editorial mood again (Itzik 2026-05-06
                       revert). */
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
          <section
            id="catalogue"
            className="relative overflow-hidden bg-[#0E0810] px-4 pb-24 pt-14 text-white"
          >
            {/* ── Animated atmosphere ──────────────────────────────────────
                Dark wine gradient base + drifting blobs + floating glow +
                12 small orbit dots. Mirrors the inner-page (journey)
                animation language but in the catalogue's wine/burgundy
                palette so the section feels stitched into the wider site.
                Lifted from -z-10 to z-0; content above sets z-10. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
            >
              {/* Aurora wash */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(900px 600px at 18% 25%, rgba(184,60,77,0.18), transparent 60%), " +
                    "radial-gradient(800px 540px at 82% 75%, rgba(61,31,61,0.22), transparent 60%), " +
                    "linear-gradient(160deg, #1A0A14 0%, #0E0810 60%, #1A0A14 100%)",
                }}
              />
              {/* Converging blobs - wine red ↔ deep burgundy */}
              <div className="catalogue-blob catalogue-blob-1" />
              <div className="catalogue-blob catalogue-blob-2" />
              {/* Soft floating circle */}
              <div className="catalogue-floating-circle" />
              {/* 12 drifting orbit dots */}
              <span className="catalogue-orbit catalogue-orbit-1" />
              <span className="catalogue-orbit catalogue-orbit-2" />
              <span className="catalogue-orbit catalogue-orbit-3" />
              <span className="catalogue-orbit catalogue-orbit-4" />
              <span className="catalogue-orbit catalogue-orbit-5" />
              <span className="catalogue-orbit catalogue-orbit-6" />
              <span className="catalogue-orbit catalogue-orbit-7" />
              <span className="catalogue-orbit catalogue-orbit-8" />
              <span className="catalogue-orbit catalogue-orbit-9" />
              <span className="catalogue-orbit catalogue-orbit-10" />
              <span className="catalogue-orbit catalogue-orbit-11" />
              <span className="catalogue-orbit catalogue-orbit-12" />
            </div>

            <div className="relative z-10 mx-auto max-w-6xl">
              {/* Stacked header - eyebrow + title + lead description.
                  Per Itzik 2026-05-06: lead reads BELOW the title (not on
                  the side) so the catalogue copy flows top-to-bottom. */}
              <div className="flex flex-col items-start gap-4">
                <span className="inline-flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.2em] text-rose-200">
                  <span className="h-[7px] w-[7px] rounded-sm bg-[#B83C4D] shadow-[0_0_0_3px_rgba(184,60,77,0.28)]" />
                  {isHe ? "הקטלוג" : "Catalogue"}
                </span>
                <CmsText
                  cmsKey="gamesHub.catalogueTitle"
                  as="h2"
                  className="font-heading text-3xl font-bold leading-[1.05] tracking-[-0.02em] text-white sm:text-4xl lg:text-5xl"
                />
                <p className="max-w-2xl text-[18px] leading-[1.6] text-white/70">
                  {isHe
                    ? "בחרו משחק, פתחו על הטלפון, ומתחילים. בלי הורדות, בלי הכנות."
                    : "Pick one, open it on your phone, and start. No downloads, no prep."}
                </p>
              </div>

              {games.length === 0 && (
                <p className="mt-10 text-white/60">-</p>
              )}

              {/* Catalogue grid — 2 per row (was 3) per Itzik 2026-05-07.
                Bigger card footprint reads as fewer "products" and more
                "experiences". */}
            <ul className="mt-10 grid gap-7 sm:grid-cols-2">
                {/* ── Regular wheel games from DB ── */}
                {games.map((g, idx) => {
                  const name = isHe ? g.name_he : g.name_en;
                  const desc = isHe ? g.description_he : g.description_en;
                  const accent = accents[idx % accents.length]!;
                  const thumb = pickGameThumbnail(g, locale);
                  return (
                    <li key={g.id} className="group relative">
                      {/* Hover glow */}
                      <div
                        aria-hidden
                        className={`pointer-events-none absolute -inset-px -z-10 rounded-[28px] bg-gradient-to-br ${accent} opacity-0 blur-xl transition duration-500 group-hover:opacity-60`}
                      />
                      <Link
                        href={`/games/${g.slug}`}
                        className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-xl shadow-black/30 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-rose-300/40 hover:bg-white/[0.07]"
                      >
                        {/* Thumbnail */}
                        <div className="relative aspect-[16/10] w-full overflow-hidden">
                          {thumb ? (
                            <>
                              <Image
                                src={thumb}
                                alt={name}
                                fill
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                className="object-cover transition duration-700 group-hover:scale-[1.05]"
                              />
                              <div
                                aria-hidden
                                className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"
                              />
                            </>
                          ) : (
                            <div
                              className={`grid h-full w-full place-items-center bg-gradient-to-br ${accent}`}
                            >
                              <Gamepad2 className="h-12 w-12 text-white/70" />
                            </div>
                          )}
                          {/* Admin image-swap overlay - pre-fills with the
                              current per-locale URLs so the admin can edit
                              either or both. */}
                          {isAdmin && (
                            <AdminThumbnailEdit
                              gameId={g.id}
                              initialHe={g.thumbnail_url_he}
                              initialEn={g.thumbnail_url_en}
                            />
                          )}
                        </div>

                        <div className="flex flex-1 flex-col p-6">
                          {/* Per Itzik 2026-05-07: game card titles in
                              the catalogue serif (Frank Ruhl Libre) so
                              they read as named things, not labels. */}
                          <h3
                            className="text-[26px] font-bold leading-[1.15] tracking-[-0.01em] text-white"
                            style={{ fontFamily: "var(--font-frank-ruhl), 'Frank Ruhl Libre', serif" }}
                          >
                            {name}
                          </h3>
                          {desc ? (
                            <p className="mt-2 line-clamp-3 text-[20px] leading-[1.5] text-white/70 transition-[max-height,color] duration-500 ease-in-out group-hover:line-clamp-none sm:text-[18px]">
                              {desc}
                            </p>
                          ) : null}
                          <span className="mt-auto inline-flex items-center gap-2 pt-5 text-[18px] font-semibold text-rose-200 transition group-hover:text-white">
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

                {/* ── Virtual snakes & ladders card - dark wine palette ── */}
                <li className="group relative">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -inset-px -z-10 rounded-[28px] bg-gradient-to-br from-[#B83C4D]/40 via-[#8B2638]/30 to-[#3D1F3D]/30 opacity-0 blur-xl transition duration-500 group-hover:opacity-70"
                  />
                  <Link
                    href="/game"
                    className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-xl shadow-black/30 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-rose-300/40 hover:bg-white/[0.07]"
                  >
                    {/* Thumbnail - see /public/images/snakes-couples.webp */}
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-[#B83C4D]/30 via-[#8B2638]/25 to-[#3D1F3D]/30">
                      <Image
                        src="/images/snakes-couples.webp"
                        alt={isHe ? "נחשים וסולמות" : "Snakes & Ladders"}
                        fill
                        sizes="(max-width: 640px) 100vw, 50vw"
                        className="object-cover transition duration-500 group-hover:scale-[1.02]"
                      />
                      {/* New badge */}
                      <span className="absolute end-3 top-3 rounded-full bg-gradient-to-r from-[#B83C4D] to-[#8B2638] px-3 py-1 text-xs font-bold text-white shadow-lg">
                        {isHe ? "חדש 🔥" : "New 🔥"}
                      </span>
                      <div
                        aria-hidden
                        className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"
                      />
                    </div>

                    <div className="flex flex-1 flex-col p-6">
                      {/* Multi-player badge - on-dark variant */}
                      <span className="mb-3 inline-flex items-center gap-1.5 self-start rounded-full border border-rose-300/30 bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-100">
                        <Users className="h-3 w-3" />
                        {isHe ? "עד 8 שחקנים" : "Up to 8 players"}
                      </span>
                      <h3
                        className="text-[26px] font-bold leading-[1.15] tracking-[-0.01em] text-white"
                        style={{ fontFamily: "var(--font-frank-ruhl), 'Frank Ruhl Libre', serif" }}
                      >
                        {isHe ? "נחשים וסולמות" : "Snakes & Ladders"}
                      </h3>
                      <p className="mt-2 line-clamp-3 text-[20px] leading-[1.5] text-white/70 transition-[max-height,color] duration-500 ease-in-out group-hover:line-clamp-none sm:text-[18px]">
                        {isHe
                          ? "לוח קלאסי עם שאלות ואתגרים זוגיים - שחקו על מכשיר אחד או על שני מכשירים שונים"
                          : "Classic board game with couples questions & challenges - play on one device or remotely"}
                      </p>
                      <span className="mt-auto inline-flex items-center gap-2 pt-5 text-[18px] font-semibold text-rose-200 transition group-hover:text-white">
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

            {/* Inline keyframes/styles for the catalogue atmosphere - kept
                local so the new pattern doesn't bleed into other dark
                sections that might want their own palette. */}
            <style
              dangerouslySetInnerHTML={{
                __html: `
                  /* Large drifting blobs - soft, slow, atmospheric. */
                  .catalogue-blob {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(110px);
                    opacity: 0.55;
                    pointer-events: none;
                    will-change: transform;
                  }
                  .catalogue-blob-1 {
                    width: 620px; height: 620px;
                    top: -160px;
                    inset-inline-start: -120px;
                    background: radial-gradient(circle, rgba(184,60,77,0.7) 0%, rgba(184,60,77,0) 70%);
                    animation: catalogue-blob-1-converge 56s ease-in-out infinite;
                  }
                  .catalogue-blob-2 {
                    width: 560px; height: 560px;
                    bottom: -140px;
                    inset-inline-end: -100px;
                    background: radial-gradient(circle, rgba(139,38,56,0.6) 0%, rgba(139,38,56,0) 70%);
                    animation: catalogue-blob-2-converge 56s ease-in-out infinite;
                  }
                  @keyframes catalogue-blob-1-converge {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    50%      { transform: translate(140px, 100px) scale(1.06); }
                  }
                  @keyframes catalogue-blob-2-converge {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    50%      { transform: translate(-140px, -100px) scale(1.06); }
                  }

                  /* Soft floating circle */
                  .catalogue-floating-circle {
                    position: absolute;
                    width: 220px; height: 220px;
                    top: 38%;
                    left: 48%;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(232,131,148,0.45) 0%, rgba(184,60,77,0) 70%);
                    filter: blur(40px);
                    opacity: 0.5;
                    animation: catalogue-floating-circle-move 32s ease-in-out infinite;
                    pointer-events: none;
                  }
                  @keyframes catalogue-floating-circle-move {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    25%      { transform: translate(-30px, 40px) scale(1.05); }
                    50%      { transform: translate(40px, -20px) scale(1.1); }
                    75%      { transform: translate(20px, 30px) scale(1); }
                  }

                  /* 12 small drifting orbit dots - wine palette, soft halos.
                     Single smooth fade gradient so the dots feather into
                     the background instead of looking outlined. */
                  .catalogue-orbit {
                    position: absolute;
                    border-radius: 50%;
                    pointer-events: none;
                    will-change: transform, opacity;
                  }
                  .catalogue-orbit-1  { width: 8px;  height: 8px;  left: 12%; top: 22%; background: radial-gradient(circle, rgba(232,131,148,0.85) 0%, rgba(232,131,148,0) 70%); box-shadow: 0 0 10px rgba(232,131,148,0.25); animation: catalogue-orbit-a 26s ease-in-out infinite; }
                  .catalogue-orbit-2  { width: 6px;  height: 6px;  left: 24%; top: 68%; background: radial-gradient(circle, rgba(184,60,77,0.85) 0%, rgba(184,60,77,0) 70%);   box-shadow: 0 0 8px  rgba(184,60,77,0.22);   animation: catalogue-orbit-b 32s ease-in-out infinite; animation-delay: 1s; }
                  .catalogue-orbit-3  { width: 10px; height: 10px; left: 38%; top: 18%; background: radial-gradient(circle, rgba(251,200,210,0.8)  0%, rgba(251,200,210,0)  70%); box-shadow: 0 0 12px rgba(251,200,210,0.22); animation: catalogue-orbit-c 30s ease-in-out infinite; animation-delay: 2s; }
                  .catalogue-orbit-4  { width: 5px;  height: 5px;  left: 48%; top: 74%; background: radial-gradient(circle, rgba(245,158,177,0.85) 0%, rgba(245,158,177,0) 70%); box-shadow: 0 0 8px  rgba(245,158,177,0.22); animation: catalogue-orbit-d 36s ease-in-out infinite; animation-delay: 3s; }
                  .catalogue-orbit-5  { width: 7px;  height: 7px;  left: 62%; top: 30%; background: radial-gradient(circle, rgba(184,60,77,0.8)  0%, rgba(184,60,77,0)  70%);   box-shadow: 0 0 10px rgba(184,60,77,0.22);   animation: catalogue-orbit-e 28s ease-in-out infinite; animation-delay: .8s; }
                  .catalogue-orbit-6  { width: 7px;  height: 7px;  left: 74%; top: 66%; background: radial-gradient(circle, rgba(139,38,56,0.85) 0%, rgba(139,38,56,0) 70%);   box-shadow: 0 0 10px rgba(139,38,56,0.22);   animation: catalogue-orbit-a 34s ease-in-out infinite; animation-delay: 3.6s; }
                  .catalogue-orbit-7  { width: 9px;  height: 9px;  left: 86%; top: 24%; background: radial-gradient(circle, rgba(232,131,148,0.85) 0%, rgba(232,131,148,0) 70%); box-shadow: 0 0 12px rgba(232,131,148,0.22); animation: catalogue-orbit-b 30s ease-in-out infinite; animation-delay: 4.2s; }
                  .catalogue-orbit-8  { width: 6px;  height: 6px;  left: 18%; top: 46%; background: radial-gradient(circle, rgba(245,158,177,0.85) 0%, rgba(245,158,177,0) 70%); box-shadow: 0 0 8px  rgba(245,158,177,0.22); animation: catalogue-orbit-c 38s ease-in-out infinite; animation-delay: 1.6s; }
                  .catalogue-orbit-9  { width: 8px;  height: 8px;  left: 54%; top: 54%; background: radial-gradient(circle, rgba(184,60,77,0.8)  0%, rgba(184,60,77,0)  70%);   box-shadow: 0 0 10px rgba(184,60,77,0.22);   animation: catalogue-orbit-d 32s ease-in-out infinite; animation-delay: 5s; }
                  .catalogue-orbit-10 { width: 7px;  height: 7px;  left: 80%; top: 48%; background: radial-gradient(circle, rgba(251,200,210,0.85) 0%, rgba(251,200,210,0) 70%); box-shadow: 0 0 10px rgba(251,200,210,0.22); animation: catalogue-orbit-e 34s ease-in-out infinite; animation-delay: 2.4s; }
                  .catalogue-orbit-11 { width: 5px;  height: 5px;  left: 30%; top: 38%; background: radial-gradient(circle, rgba(245,158,177,0.8)  0%, rgba(245,158,177,0)  70%); box-shadow: 0 0 8px  rgba(245,158,177,0.2);  animation: catalogue-orbit-a 28s ease-in-out infinite; animation-delay: 4s; }
                  .catalogue-orbit-12 { width: 8px;  height: 8px;  left: 68%; top: 8%;  background: radial-gradient(circle, rgba(232,131,148,0.8)  0%, rgba(232,131,148,0)  70%); box-shadow: 0 0 10px rgba(232,131,148,0.22); animation: catalogue-orbit-b 30s ease-in-out infinite; animation-delay: .5s; }

                  /* Drift ranges - ambient, not propelled. */
                  @keyframes catalogue-orbit-a { 0%,100% { transform: translate(0,0); opacity: .25; } 50% { transform: translate(30px,-40px);  opacity: .65; } }
                  @keyframes catalogue-orbit-b { 0%,100% { transform: translate(0,0); opacity: .25; } 50% { transform: translate(-40px,30px); opacity: .65; } }
                  @keyframes catalogue-orbit-c { 0%,100% { transform: translate(0,0); opacity: .2; }  33% { transform: translate(40px,18px);  opacity: .55; } 66% { transform: translate(-25px,-30px); opacity: .7; } }
                  @keyframes catalogue-orbit-d { 0%,100% { transform: translate(0,0); opacity: .25; } 50% { transform: translate(-30px,-45px); opacity: .65; } }
                  @keyframes catalogue-orbit-e { 0%,100% { transform: translate(0,0); opacity: .25; } 50% { transform: translate(45px,35px);   opacity: .65; } }

                  @media (prefers-reduced-motion: reduce) {
                    .catalogue-blob,
                    .catalogue-floating-circle,
                    .catalogue-orbit {
                      animation: none !important;
                    }
                  }
                `,
              }}
            />
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
    </CmsTextProvider>
  );
}
