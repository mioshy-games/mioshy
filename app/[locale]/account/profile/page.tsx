import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Link } from "@/navigation";
import { ArrowLeft, ShieldCheck, UserRoundCog } from "lucide-react";
import { getProfileGate } from "@/lib/auth/profile-gate";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ProfileDetailsForm } from "@/components/account/ProfileDetailsForm";
import { SetPasswordForm } from "@/components/account/SetPasswordForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const isHe = params.locale === "he";
  return {
    title: `Mioshy - ${isHe ? "השלמת הפרופיל" : "Complete your profile"}`,
    description: isHe
      ? "מלאו את פרטי הפרופיל כדי לצמד עם בן/בת הזוג ולפתוח את המשחקים."
      : "Add your details to pair with your partner and unlock your games.",
    robots: { index: false, follow: false },
  };
}

export default async function ProfileDetailsPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams?: { next?: string; reason?: string };
}) {
  const { locale } = params;
  const isHe = locale === "he";

  // The `next` value gets passed to ProfileDetailsForm / SetPasswordForm,
  // which call router.push() using the next-intl router. That router
  // AUTO-PREPENDS the current locale, so feeding it "/he/my" produces
  // "/he/he/my" → 404. Strip the leading locale segment if present so
  // the next-intl router can re-prepend it correctly.
  //
  // Bug repro before this fix (Itzik 2026-05-27):
  //   • RedeemCodeButton fails with profile_incomplete
  //   • Sends user to /he/account/profile?next=%2Fhe%2Fmy
  //   • Profile page passes "/he/my" to <ProfileDetailsForm nextHref/>
  //   • Form calls router.push("/he/my") → next-intl re-prefixes
  //   • Browser lands on /he/he/my → 404
  function stripLocalePrefix(path: string): string {
    return path.replace(/^\/(?:he|en)(?=\/|$)/, "") || "/";
  }
  const next = (() => {
    const raw = searchParams?.next;
    if (typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")) {
      return stripLocalePrefix(raw);
    }
    return "/my";
  })();

  const gate = await getProfileGate();
  if (!gate) {
    redirect(
      `/${locale}/auth?next=${encodeURIComponent(`/${locale}/account/profile`)}`,
    );
  }

  // Current WhatsApp consent, so the opt-in checkbox reflects existing state.
  // Self-read via the session client (RLS allows reading your own profile).
  let defaultWhatsappOptIn = false;
  {
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (auth?.user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("whatsapp_opt_in")
        .eq("id", auth.user.id)
        .maybeSingle();
      defaultWhatsappOptIn = !!(prof as { whatsapp_opt_in: boolean } | null)
        ?.whatsapp_opt_in;
    }
  }

  const reason = searchParams?.reason;
  const needsName = gate.missing.includes("full_name");
  const needsMobile = gate.missing.includes("mobile");
  const needsPassword = gate.missing.includes("password");

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="min-h-[100dvh] bg-gradient-to-b from-violet-950 via-fuchsia-950 to-rose-950 text-white"
    >
      <main className="mx-auto max-w-2xl px-4 py-12">
        <Link
          href="/my"
          className="inline-flex items-center gap-1.5 text-sm text-white/70 transition hover:text-white"
        >
          <ArrowLeft
            className={`h-4 w-4 ${isHe ? "rotate-180" : ""}`}
          />
          {isHe ? "חזרה למיאושי שלי" : "Back to My Mioshy"}
        </Link>

        <div className="mt-6 flex items-start gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 via-purple-500 to-pink-500">
            <UserRoundCog className="h-6 w-6 text-white" />
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isHe ? "השלמת הפרופיל" : "Complete your profile"}
            </h1>
            <p className="mt-1 max-w-xl text-white/75">
              {isHe
                ? "כדי לצמד עם בן/בת הזוג, להזין קוד צימוד או להתחיל משחק - אנחנו צריכים שם, נייד וסיסמה. הפרטים נשארים פרטיים ומשמשים רק לחיבור בין השניים שלכם."
                : "Before you pair with your partner, redeem a code, or launch a game, we need your name, mobile and a password. Your details stay private and are only used to tie the two of you together."}
            </p>
          </div>
        </div>

        {reason === "profile_incomplete" ? (
          <div className="mt-6 rounded-2xl border border-amber-300/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            {isHe
              ? "השלימו את הפרטים שלמטה כדי להמשיך - זה לוקח פחות מדקה."
              : "Finish the fields below to continue - it takes less than a minute."}
          </div>
        ) : null}

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="text-lg font-semibold">
            {isHe ? "פרטים אישיים" : "Personal details"}
          </h2>
          <p className="mt-1 text-sm text-white/65">
            {isHe
              ? "שם מלא ונייד - כדי שהפרטנר/ית ידעו עם מי הם מצומדים, ושנוכל ליצור איתכם קשר בנושא חשבון."
              : "Full name and mobile - so your partner can see who they're paired with and we can reach you about account matters."}
          </p>
          <div className="mt-4">
            <ProfileDetailsForm
              isHe={isHe}
              defaultName={gate.full_name ?? ""}
              defaultMobile={gate.mobile ?? ""}
              defaultWhatsappOptIn={defaultWhatsappOptIn}
              highlightMissing={{
                full_name: needsName,
                mobile: needsMobile,
              }}
              nextHref={needsPassword ? undefined : next}
            />
          </div>
        </section>

        {needsPassword ? (
          <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-fuchsia-200" />
              <h2 className="text-lg font-semibold">
                {isHe ? "הגדרת סיסמה" : "Set a password"}
              </h2>
            </div>
            <p className="mt-1 text-sm text-white/65">
              {isHe
                ? "החשבון שלכם נפתח ללא סיסמה (כנראה דרך ספק חיצוני). הגדירו סיסמה כדי שתוכלו להתחבר גם ישירות."
                : "Your account was created without a password (likely via an external provider). Set one so you can sign in directly."}
            </p>
            <div className="mt-4">
              <SetPasswordForm isHe={isHe} nextHref={next} />
            </div>
          </section>
        ) : null}

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/55 backdrop-blur">
          <p>
            {isHe ? "האימייל שלכם" : "Your email"}:{" "}
            <span className="font-mono text-white/80">
              {gate.email ?? "-"}
            </span>
          </p>
        </section>
      </main>
    </div>
  );
}
