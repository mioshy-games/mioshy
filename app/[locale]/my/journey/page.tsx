/**
 * /[locale]/my/journey
 *
 * The entitled-user surface for the ליווי עם מיאושי pillar.
 * Pre-fetches current journey + hands off to the existing JourneyClient so
 * users who bought the subscription drop straight into their questionnaire.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/navigation";
import { ArrowLeft, ArrowRight, Compass, Sparkles } from "lucide-react";
import { routing } from "@/i18n/routing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import { JourneyClient } from "@/components/journey/JourneyClient";
import type { Locale } from "@/lib/journey/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const isHe = params.locale === "he";
  return {
    title: `Mioshy — ${isHe ? "ליווי עם מיאושי · הגלריה" : "Journey with Mioshy · Gallery"}`,
    description: isHe
      ? "האבחון, ההתקדמות והתובנות שלכם — במקום אחד."
      : "Your diagnostic, progress, and insights — all in one place.",
  };
}

export default async function MyJourneyGalleryPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);

  const isHe = locale === "he";

  const entitlements = await getUserEntitlements();
  if (!entitlements) redirect(`/${locale}/auth`);
  if (!entitlements.journey) redirect(`/${locale}/journey`);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth`);

  const { data: journey } = await supabase
    .from("journeys")
    .select("current_step, status, language")
    .eq("user_id", user.id)
    .order("last_activity_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const initialProgress = journey
    ? {
        current_step: journey.current_step as number,
        status: journey.status as string,
        language: ((journey.language as string) ?? locale) as Locale,
      }
    : null;

  const Arrow = isHe ? ArrowLeft : ArrowRight;

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="min-h-[100dvh] bg-gradient-to-b from-[#050f1a] via-[#0a1326] to-[#020610] text-white"
    >
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:pt-14">
        <Link
          href="/my"
          className="inline-flex items-center gap-1 text-xs font-medium text-white/55 transition hover:text-white/90"
        >
          <Arrow className="h-3 w-3 rotate-180" />
          {isHe ? "חזרה למיאושי שלי" : "Back to My Mioshy"}
        </Link>

        <section className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-300/40 bg-indigo-500/10 px-3 py-1 text-xs backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-indigo-200" />
              <span className="font-semibold text-indigo-100">
                {isHe ? "הליווי שלכם" : "Your journey"}
              </span>
            </div>
            <h1 className="mt-3 flex items-center gap-3 text-4xl font-bold tracking-tight sm:text-5xl">
              <Compass className="h-8 w-8 text-indigo-300 sm:h-10 sm:w-10" />
              {isHe ? "ליווי עם מיאושי" : "Journey with Mioshy"}
            </h1>
            <p className="mt-3 max-w-2xl text-white/70">
              {isHe
                ? "ממשיכים בדיוק מאיפה שהפסקתם. כל תובנה, כל שאלה — שמורות."
                : "Continue exactly where you left off — every insight and answer is kept for you."}
            </p>
          </div>
        </section>

        <section className="mt-10">
          <JourneyClient
            locale={locale as Locale}
            initialProgress={initialProgress}
            subscriptionActive={true}
            authenticated={true}
          />
        </section>
      </main>
    </div>
  );
}
