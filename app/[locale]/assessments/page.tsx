/**
 * /[locale]/assessments — the assessments hub.
 *
 * Lists every assessment as a card. Live assessments are startable; others
 * render as "בקרוב". For a signed-in user we surface per-assessment status
 * (completed / in progress / not started). Isolated to assessment_* tables.
 */

import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { routing } from "@/i18n/routing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { listAssessments } from "@/lib/assessments/catalog";

export const dynamic = "force-dynamic";

export default async function AssessmentsHubPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound();
  setRequestLocale(locale);
  const isHe = locale === "he";
  const t = (he: string, en: string) => (isHe ? he : en);

  const assessments = listAssessments();

  // Per-assessment status for a signed-in user.
  const statusById: Record<string, "complete" | "in_progress"> = {};
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const admin = createServiceRoleClient();
    if (admin) {
      const { data: sessions } = await admin
        .from("assessment_sessions")
        .select("assessment_id, status, last_activity_at")
        .eq("user_id", user.id)
        .order("last_activity_at", { ascending: false });
      for (const s of sessions ?? []) {
        const id = s.assessment_id as string;
        if (!statusById[id]) statusById[id] = s.status === "complete" ? "complete" : "in_progress";
      }
    }
  }

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="relative isolate min-h-screen"
      style={{ background: "linear-gradient(180deg, #0b0712 0%, #0e0913 50%, #100a17 100%)" }}
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <header className="mb-8 text-center">
          <span className="text-[14px] font-semibold uppercase tracking-wider" style={{ color: "#FCCA65" }}>
            {t("אבחונים זוגיים", "Couple assessments")}
          </span>
          <h1 className="mt-2 font-heading text-[30px] font-extrabold leading-tight text-white sm:text-[36px]">
            {t("איפה הזוגיות שלכם עומדת היום?", "Where is your relationship today?")}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-pretty text-[16px] leading-relaxed text-white/65">
            {t(
              "אבחונים קצרים וממוקדים. כל אחד מראה לכם איפה אתם חזקים ואיפה כדאי להתחיל - ונותן המלצה אישית.",
              "Short, focused assessments. Each shows where you're strong and where to start - with a personal recommendation.",
            )}
          </p>
        </header>

        <div className="flex flex-col gap-4">
          {assessments.map((a) => {
            const status = statusById[a.id];
            const cta = !a.live
              ? t("בקרוב", "Coming soon")
              : status === "complete"
                ? t("צפו בתוצאות", "View results")
                : status === "in_progress"
                  ? t("המשיכו", "Continue")
                  : t("התחילו", "Start");
            const card = (
              <div
                className={`flex items-center justify-between gap-4 rounded-2xl border p-5 transition ${
                  a.live
                    ? "border-white/12 bg-white/[0.04] hover:border-[#FCCA65]/40 hover:bg-white/[0.06]"
                    : "border-white/8 bg-white/[0.02] opacity-60"
                }`}
              >
                <div className="min-w-0">
                  <h2 className="text-balance text-[20px] font-bold text-white sm:text-[22px]">
                    {isHe ? a.he_title : a.en_title}
                  </h2>
                  <p className="mt-1 text-pretty text-[14px] leading-snug text-white/60">
                    {isHe ? a.he_tagline : a.en_tagline}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-4 py-2 text-[14px] font-semibold ${
                    a.live ? "text-black" : "text-white/50 border border-white/15"
                  }`}
                  style={a.live ? { background: "#FCCA65" } : undefined}
                >
                  {cta}
                </span>
              </div>
            );
            return a.live ? (
              <Link key={a.id} href={`/${locale}/assessments/${a.id}`} className="block">
                {card}
              </Link>
            ) : (
              <div key={a.id}>{card}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
