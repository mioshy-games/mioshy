import { getTranslations } from "next-intl/server";
import { Link } from "@/navigation";
import { SiteHeader } from "@/components/SiteHeader";

export default async function ProductsPage() {
  const t = await getTranslations("products");

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-violet-950 via-fuchsia-950 to-rose-950 font-[family-name:var(--font-geist-sans)]">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-center text-3xl font-bold text-white sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-white/75">
          {t("subtitle")}
        </p>
        <div className="mx-auto mt-12 grid max-w-lg gap-6">
          <Link
            href="/games/truth-or-dare"
            className="group block overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-white/15 to-white/5 p-8 shadow-2xl backdrop-blur transition hover:border-fuchsia-300/40 hover:from-white/25"
          >
            <h2 className="text-2xl font-bold text-white">{t("todName")}</h2>
            <p className="mt-2 text-white/80">{t("todBlurb")}</p>
            <span className="mt-6 inline-flex items-center text-sm font-semibold text-fuchsia-200 group-hover:text-white">
              {t("open")} →
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}
