import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getShellData } from "@/lib/shell/getShellData";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";
import { PageHeader } from "@/components/shell/PageHeader";
import { PollDashboardLanding } from "@/components/survey/PollDashboardLanding";

export const dynamic = "force-dynamic";

/**
 * Dashboard home for "סקר הזוגיות של ישראל". A signed-in user experiences the
 * WHOLE survey — landing, question, reveal, history — INSIDE the dashboard body
 * (the shell), crowned by the dashboard PageHeader + the sticky right sidebar.
 * NOT the public marketing header (/he/survey redirects signed-in users here).
 */
export default async function MySurveyPage({ params }: { params: { locale: string } }) {
  const { locale } = params;
  const isHe = locale === "he";

  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/${locale}/auth`);

  // Shell identity for the PageHeader (crumb + bell) — React.cache'd, free on
  // the hit the (shell) layout already warmed.
  const shellPage = await getCmsTranslations({ locale: isHe ? "he" : "en", namespace: "appShell", page: "app-shell" });
  const shell = await getShellData({ locale: isHe ? "he" : "en" });

  const admin = await createAdminClient();
  const [{ data: sub }, { data: profile }, { data: journeyRows }] = await Promise.all([
    admin.from("poll_subscriptions").select("subscribed").eq("user_id", auth.user.id).maybeSingle(),
    admin.from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle(),
    // Has the user already done the short assessment? Any journey past the
    // assessment (paywall / complete / completed) suppresses the invite popup.
    admin
      .from("journeys")
      .select("status")
      .eq("user_id", auth.user.id)
      .in("status", ["paywall", "complete", "completed"])
      .limit(1),
  ]);
  const subscribed = sub?.subscribed ?? false;
  // First name only for a friendlier invite ("דנה מזמינה אותך…").
  const userName = (profile?.full_name ?? "").trim().split(/\s+/)[0] || null;
  const hasShortAssessment = (journeyRows?.length ?? 0) > 0;

  return (
    <>
      <PageHeader
        rootLabel={shellPage("rootCrumb")}
        pageLabel="סקר הזוגיות של ישראל"
        bellCount={shell?.notificationCount ?? 0}
      />
      {/* Light survey canvas — same cream + soft-pink radial as the public
          /he/survey page (survey.module.css .page), so the survey area reads
          light inside the dark dashboard shell (per Itzik). Only this page. */}
      <div
        style={{
          minHeight: "100dvh",
          background:
            "radial-gradient(900px 500px at 50% -8%, rgba(236, 72, 153, 0.06), transparent 60%), #fffdfc",
        }}
      >
        <PollDashboardLanding
          initialSubscribed={subscribed}
          userName={userName}
          locale={locale}
          hasShortAssessment={hasShortAssessment}
        />
      </div>
    </>
  );
}
