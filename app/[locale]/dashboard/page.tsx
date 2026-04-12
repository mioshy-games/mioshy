import { getTranslations } from "next-intl/server";
import { DashboardClient } from "@/components/DashboardClient";
import { SiteHeader } from "@/components/SiteHeader";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-zinc-950 via-fuchsia-950 to-rose-950 font-[family-name:var(--font-geist-sans)]">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-center text-3xl font-bold text-white sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-center text-white/70">
          {t("subtitle")}
        </p>
        <div className="mt-10">
          <DashboardClient />
        </div>
      </main>
    </div>
  );
}
