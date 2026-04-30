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
  const t = await getTranslations({ locale, namespace: "pricing" });
  const title = `Mioshy - ${t("title")}`;
  const description = t("subtitle");

  return {
    title,
    description,
    alternates: {
      canonical: `${base}/${locale}/pricing`,
      languages: {
        en: `${base}/en/pricing`,
        he: `${base}/he/pricing`,
        "x-default": `${base}/en/pricing`,
      },
    },
    openGraph: {
      type: "website",
      url: `${base}/${locale}/pricing`,
      title,
      description,
      siteName: "Mioshy",
    },
  };
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricing" });
  const currency = locale === "he" ? "₪" : "$";

  const plans =
    locale === "he"
      ? [
          { id: "weekly", name: "Weekly", price: "9", note: "/week" },
          { id: "monthly", name: "Monthly", price: "37", note: "/month", recommended: true },
          { id: "annual", name: "Annual", price: "369", note: "/year" },
        ]
      : [
          { id: "weekly", name: "Weekly", price: "3", note: "/week" },
          { id: "monthly", name: "Monthly", price: "9", note: "/month", recommended: true },
          { id: "annual", name: "Annual", price: "123", note: "/year" },
        ];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{t("title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Link href="/account" className="text-sm font-semibold underline underline-offset-4">
          {t("account")}
        </Link>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.id}
            className={
              p.recommended
                ? "rounded-2xl border border-fuchsia-500/40 bg-fuchsia-500/5 p-5"
                : "rounded-2xl border p-5"
            }
          >
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-lg font-semibold">{p.name}</div>
              {p.recommended ? (
                <span className="rounded-full bg-fuchsia-600/20 px-2 py-0.5 text-xs font-semibold text-fuchsia-700 dark:text-fuchsia-200">
                  {t("recommended")}
                </span>
              ) : null}
            </div>
            <div className="mt-2 text-3xl font-extrabold">
              {currency}
              {p.price}
              <span className="ml-1 text-sm font-semibold text-muted-foreground">{p.note}</span>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>{t("feature1")}</li>
              <li>{t("feature2")}</li>
              <li>{t("feature3")}</li>
            </ul>
            <a
              href="#"
              className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-fuchsia-500 to-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm"
            >
              {t("cta")}
            </a>
          </div>
        ))}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">{t("disclaimer")}</p>
    </main>
  );
}

