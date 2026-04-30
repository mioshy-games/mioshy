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
import { getCurrentCoupleContext } from "@/lib/between-us/couples";
import { PairCodeWidget } from "@/components/between-us/PairCodeWidget";
import { RedeemCodeButton } from "@/components/between-us/RedeemCodeButton";
import { InvitePartnerByEmail } from "@/components/between-us/InvitePartnerByEmail";
import { Heart, KeyRound } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const isHe = params.locale === "he";
  return {
    title: `Mioshy - ${isHe ? "ליווי עם מיאושי · הגלריה" : "Journey with Mioshy · Gallery"}`,
    description: isHe
      ? "האבחון, ההתקדמות והתובנות שלכם - במקום אחד."
      : "Your diagnostic, progress, and insights - all in one place.",
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

  // Couple context — used to show the pair code if this user already has a
  // couple, or to surface the partner-invite + redeem-code section if they
  // don't. Either flow lives at the top of /my/journey so the partner who
  // arrives via an invite link knows immediately where to enter the code,
  // and the registrant knows how to bring their partner in.
  const couple = await getCurrentCoupleContext();
  const isOwner = couple?.role === "owner";
  const needsPartner = !!couple?.couple_id && couple.partner_count < 2;
  const isSolo = !couple?.couple_id;

  const Arrow = isHe ? ArrowLeft : ArrowRight;

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="min-h-[100dvh] text-white"
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
                ? "ממשיכים בדיוק מאיפה שהפסקתם. כל תובנה, כל שאלה - שמורות."
                : "Continue exactly where you left off - every insight and answer is kept for you."}
            </p>
          </div>
        </section>

        {/* Partner pairing surface — appears as one of three states:
              1) Solo user → "Got a code from your partner?" + invite-by-email
              2) Owner of a couple, partner not paired yet → show pair code
                 + invite UI so the registrant can bring their partner in
              3) Both partners paired → quiet badge confirming the link
            Always sits ABOVE the assessment so the invited partner sees
            the code-entry the moment they land here. */}
        <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
          {isSolo ? (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-fuchsia-300/40 bg-fuchsia-500/15">
                <KeyRound className="size-5 text-fuchsia-200" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">
                  {isHe ? "קיבלתם קוד מבן/בת הזוג?" : "Got a code from your partner?"}
                </p>
                <p className="mt-0.5 text-xs text-white/65">
                  {isHe
                    ? "הזינו את הקוד כדי להצטרף לאותו ליווי. תמשיכו עם האבחון משלב 1 - מהצד שלכם."
                    : "Enter their code to join the same coaching couple. You'll then take the assessment from your side."}
                </p>
              </div>
              <RedeemCodeButton
                isHe={isHe}
                variant="primary"
                redirectTo={`/${locale}/my/journey`}
              />
            </div>
          ) : needsPartner ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Heart className="size-4 text-fuchsia-200" />
                  {isHe ? "הקוד שלכם" : "Your code"}
                </div>
                <p className="mt-1 text-xs text-white/65">
                  {isHe
                    ? "שלחו את הקוד הזה לבן/בת הזוג. הם יזינו אותו לאחר ההתחברות וימשיכו את האבחון מהצד שלהם."
                    : "Share this code with your partner. They enter it after signing in to join the same coaching couple, and continue the assessment from their side."}
                </p>
                {couple?.pair_code ? (
                  <div className="mt-3">
                    <PairCodeWidget pairCode={couple.pair_code} isHe={isHe} compact />
                  </div>
                ) : null}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {isHe ? "או שלחו הזמנה במייל" : "Or send an email invite"}
                </p>
                <p className="mt-1 text-xs text-white/65">
                  {isHe
                    ? "הזינו את כתובת המייל שלהם וכל מה שכאן יחכה גם להם."
                    : "Drop their email — everything you have here will be waiting for them."}
                </p>
                <div className="mt-3">
                  <InvitePartnerByEmail
                    locale={isHe ? "he" : "en"}
                    isHe={isHe}
                    invitation={null}
                    canInvite={isOwner}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm text-white/80">
              <Heart className="size-4 text-rose-300" />
              {isHe
                ? `מחוברים לבן/בת הזוג${couple?.display_name ? ` (${couple.display_name})` : ""}.`
                : `Paired with your partner${couple?.display_name ? ` (${couple.display_name})` : ""}.`}
            </div>
          )}
        </section>

        <section className="mt-8">
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
