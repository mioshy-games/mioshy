import { getTranslations } from "next-intl/server";
import { Link } from "@/navigation";
import type { Metadata } from "next";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://mioshy.com").replace(/\/+$/, "");
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const { locale } = params;
  const base = siteUrl();
  const t = await getTranslations({ locale, namespace: "products" });
  const title = `Mioshy — ${t("title")}`;
  const description = t("subtitle");
  return {
    title,
    description,
    alternates: {
      canonical: `${base}/${locale}/products`,
      languages: {
        en: `${base}/en/products`,
        he: `${base}/he/products`,
        "x-default": `${base}/en/products`,
      },
    },
    openGraph: { type: "website", url: `${base}/${locale}/products`, title, description, siteName: "Mioshy" },
  };
}

// ── Game card data ────────────────────────────────────────────────────────────

type GameDef = {
  href: string;
  emoji: string;
  accent: string;   // Tailwind gradient
  glow: string;     // shadow color
  badge?: string;
  badgeColor?: string;
};

const GAMES: GameDef[] = [
  {
    href: "/games/truth-or-dare",
    emoji: "🎡",
    accent: "from-violet-600 via-fuchsia-500 to-pink-500",
    glow: "rgba(168,85,247,0.45)",
    badge: "LIVE",
    badgeColor: "bg-fuchsia-500/90",
  },
  {
    href: "/game",
    emoji: "🐍",
    accent: "from-cyan-500 via-teal-500 to-emerald-500",
    glow: "rgba(20,184,166,0.4)",
    badge: "LIVE",
    badgeColor: "bg-teal-500/90",
  },
];

const COMING_SOON = [
  { emoji: "🃏", labelHe: "קלפים לזוגות", labelEn: "Couples Cards", accent: "from-amber-500 to-orange-500", glow: "rgba(245,158,11,0.3)" },
  { emoji: "🎭", labelHe: "תפקידים", labelEn: "Role Play", accent: "from-rose-500 to-pink-500", glow: "rgba(244,63,94,0.3)" },
  { emoji: "🧩", labelHe: "אתגרים", labelEn: "Challenges", accent: "from-indigo-500 to-violet-500", glow: "rgba(99,102,241,0.3)" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default async function ProductsPage({ params }: { params: { locale: string } }) {
  const t = await getTranslations("products");
  const isHe = params.locale === "he";

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="relative min-h-[100dvh] overflow-hidden bg-[#07040f] text-white"
    >
      {/* ── Background layers ─────────────────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -5%, rgba(139,92,246,0.22) 0%, transparent 65%)," +
            "radial-gradient(ellipse 50% 40% at 90% 60%, rgba(20,184,166,0.12) 0%, transparent 60%)," +
            "radial-gradient(ellipse 40% 30% at 10% 80%, rgba(236,72,153,0.1) 0%, transparent 55%)",
        }}
      />
      {/* Subtle grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <header className="mb-16 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-900/30 px-4 py-1.5 text-sm font-semibold text-purple-300 backdrop-blur-md">
            <span>🎮</span>
            <span>{isHe ? "ארסנל המשחקים" : "Games Arsenal"}</span>
          </div>
          <h1 className="font-heading text-balance text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            <span
              style={{
                background: "linear-gradient(135deg, #e879f9 0%, #a855f7 40%, #38bdf8 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {t("title")}
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-balance text-lg text-white/55">
            {t("subtitle")}
          </p>
        </header>

        {/* ── Live games ────────────────────────────────────────────────── */}
        <section className="mb-20">
          <div className="grid gap-6 sm:grid-cols-2">
            {GAMES.map((game, i) => {
              const names = [
                { name: t("todName"), blurb: t("todBlurb") },
                { name: t("snakesName"), blurb: t("snakesBlurb") },
              ];
              const { name, blurb } = names[i]!;
              return (
                <Link
                  key={game.href}
                  href={game.href}
                  className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 transition duration-300 hover:border-white/20 hover:-translate-y-1"
                  style={{ boxShadow: `0 8px 40px -12px ${game.glow}` }}
                >
                  {/* Gradient top bar */}
                  <div
                    className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${game.accent}`}
                  />

                  {/* Live badge */}
                  {game.badge && (
                    <span
                      className={`absolute end-4 top-4 rounded-full px-2.5 py-0.5 text-xs font-black tracking-widest text-white ${game.badgeColor}`}
                    >
                      {game.badge}
                    </span>
                  )}

                  {/* Emoji icon */}
                  <div
                    className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${game.accent} text-3xl shadow-xl`}
                    style={{ boxShadow: `0 8px 20px -4px ${game.glow}` }}
                  >
                    {game.emoji}
                  </div>

                  <h2 className="text-2xl font-bold text-white">{name}</h2>
                  <p className="mt-2 flex-1 text-base leading-relaxed text-white/60">{blurb}</p>

                  <div
                    className={`mt-6 inline-flex items-center gap-2 self-start text-sm font-bold transition-all bg-gradient-to-r ${game.accent} bg-clip-text text-transparent group-hover:gap-3`}
                  >
                    <span>{t("open")}</span>
                    <span className="text-white/50 group-hover:text-white transition-colors">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ── Coming soon ───────────────────────────────────────────────── */}
        <section>
          <div className="mb-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <span className="text-xs font-semibold uppercase tracking-widest text-white/25">
              {isHe ? "בקרוב" : "Coming soon"}
            </span>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {COMING_SOON.map((item) => (
              <div
                key={item.emoji}
                className="relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 opacity-50"
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${item.accent} text-2xl`}
                  style={{ boxShadow: `0 4px 14px -4px ${item.glow}` }}
                >
                  {item.emoji}
                </div>
                <div>
                  <div className="font-semibold text-white">
                    {isHe ? item.labelHe : item.labelEn}
                  </div>
                  <div className="mt-0.5 text-xs text-white/35">
                    {isHe ? "בקרוב..." : "Soon..."}
                  </div>
                </div>
                {/* Lock overlay */}
                <span className="absolute end-4 top-4 text-white/20 text-lg">🔒</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Bottom CTA ────────────────────────────────────────────────── */}
        <div className="mt-20 text-center">
          <p className="text-sm text-white/30">
            {isHe
              ? "כבר יש לך חשבון? "
              : "Already have an account? "}
            <Link
              href="/my"
              className="text-purple-400 underline underline-offset-2 hover:text-purple-300 transition-colors"
            >
              {isHe ? "המיאושי שלך" : "Your Mioshy"}
            </Link>
          </p>
        </div>

      </main>
    </div>
  );
}
