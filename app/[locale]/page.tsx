import { getTranslations } from "next-intl/server";
import { Link } from "@/navigation";
import { SiteHeader } from "@/components/SiteHeader";

export default async function HomePage() {
  const t = await getTranslations("home");
  const tn = await getTranslations("nav");

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-fuchsia-950 via-rose-900 to-amber-900 font-[family-name:var(--font-geist-sans)]">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:pt-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-rose-100 backdrop-blur">
            {t("badge")}
          </p>
          <h1 className="text-balance bg-gradient-to-r from-white via-rose-50 to-amber-100 bg-clip-text text-4xl font-extrabold leading-tight text-transparent sm:text-6xl">
            {t("headline")}
          </h1>
          <p className="mt-6 text-pretty text-lg text-white/85 sm:text-xl">
            {t("sub")}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/products"
              className="inline-flex min-h-[52px] min-w-[200px] items-center justify-center rounded-full bg-white px-8 py-3 text-base font-semibold text-fuchsia-900 shadow-xl shadow-black/25 transition hover:brightness-95"
            >
              {t("ctaSecondary")}
            </Link>
            <Link
              href="/games/truth-or-dare"
              className="inline-flex min-h-[52px] min-w-[200px] items-center justify-center rounded-full border-2 border-white/40 bg-white/10 px-8 py-3 text-base font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              {t("ctaPrimary")}
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-6 sm:grid-cols-2">
          <article className="rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur">
            <h2 className="text-xl font-bold text-white">{t("cardTodTitle")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/80">
              {t("cardTodDesc")}
            </p>
            <Link
              href="/games/truth-or-dare"
              className="mt-4 inline-block text-sm font-semibold text-amber-200 underline-offset-4 hover:underline"
            >
              {tn("play")} →
            </Link>
          </article>
          <article className="rounded-3xl border border-dashed border-white/20 bg-black/10 p-6 opacity-80">
            <h2 className="text-xl font-bold text-white/70">{t("cardSoon")}</h2>
            <p className="mt-2 text-sm text-white/50">{t("cardSoonDesc")}</p>
          </article>
        </div>
      </main>
    </div>
  );
}
