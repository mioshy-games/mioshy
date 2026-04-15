import { getTranslations } from "next-intl/server";
import { Paywall } from "@/components/Paywall";

export default async function PaywallPage() {
  const t = await getTranslations("paywall");

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-950 via-fuchsia-950 to-rose-950 font-[family-name:var(--font-geist-sans)]">
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-center text-3xl font-bold text-white sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-white/75">
          {t("subtitle")}
        </p>
        <Paywall />
      </main>
    </div>
  );
}
