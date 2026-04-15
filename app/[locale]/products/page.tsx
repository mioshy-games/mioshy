import { getTranslations } from "next-intl/server";
import { Link } from "@/navigation";
import type { Metadata } from "next";

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
    openGraph: {
      type: "website",
      url: `${base}/${locale}/products`,
      title,
      description,
      siteName: "Mioshy",
    },
  };
}

export default async function ProductsPage() {
  const t = await getTranslations("products");

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-violet-950 via-fuchsia-950 to-rose-950 font-[family-name:var(--font-geist-sans)]">
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

          <Link
            href="/game"
            className="group block overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-cyan-400/15 to-blue-400/5 p-8 shadow-2xl backdrop-blur transition hover:border-cyan-200/50 hover:from-cyan-300/20"
          >
            <h2 className="text-2xl font-bold text-white">{t("snakesName")}</h2>
            <p className="mt-2 text-white/80">{t("snakesBlurb")}</p>
            <span className="mt-6 inline-flex items-center text-sm font-semibold text-cyan-200 group-hover:text-white">
              {t("open")} →
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}
