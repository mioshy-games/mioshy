/**
 * /[locale]/assessments/[assessmentId]
 *
 * Runs a single standalone assessment. Isolated from the Journey funnel:
 * reads/writes only assessment_* tables, no pact gate, no /my/journey
 * redirect. Restores anonymous progress via the device_id cookie (same
 * pattern as Journey) and authenticated progress via the user's session row.
 */

import { setRequestLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { getAssessment } from "@/lib/assessments/catalog";
import { AssessmentClient } from "@/components/assessments/AssessmentClient";
import type { AnswerValue, Locale } from "@/lib/assessments/types";

export const dynamic = "force-dynamic";

export default async function AssessmentRunnerPage({
  params,
}: {
  params: { locale: string; assessmentId: string };
}) {
  const { locale, assessmentId } = params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound();
  setRequestLocale(locale);

  const def = getAssessment(assessmentId);
  if (!def || !def.live) notFound();

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  let initialStep = 0;
  let subscriptionActive = false;
  const initialAnswers: Record<string, AnswerValue> = {};

  const admin = createServiceRoleClient();

  if (user) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    subscriptionActive = !!sub;

    if (admin) {
      const { data: session } = await admin
        .from("assessment_sessions")
        .select("id, current_step")
        .eq("user_id", user.id)
        .eq("assessment_id", assessmentId)
        .order("last_activity_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (session) {
        initialStep = session.current_step ?? 0;
        const { data: rows } = await admin
          .from("assessment_responses")
          .select("question_id, answer")
          .eq("session_id", session.id);
        for (const r of rows ?? []) initialAnswers[r.question_id as string] = r.answer as AnswerValue;
      }
    }
  } else {
    const deviceId = cookies().get("mioshy_device_id")?.value;
    if (deviceId && admin) {
      const { data: session } = await admin
        .from("assessment_sessions")
        .select("id, current_step")
        .eq("device_id", deviceId)
        .eq("assessment_id", assessmentId)
        .is("user_id", null)
        .order("last_activity_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (session && (session.current_step ?? 0) > 0) {
        initialStep = session.current_step ?? 0;
        const { data: rows } = await admin
          .from("assessment_responses")
          .select("question_id, answer")
          .eq("session_id", session.id);
        for (const r of rows ?? []) initialAnswers[r.question_id as string] = r.answer as AnswerValue;
      }
    }
  }

  return (
    <div
      className="relative isolate min-h-screen"
      style={{ background: "linear-gradient(180deg, #0b0712 0%, #0e0913 50%, #100a17 100%)" }}
    >
      <div className="relative z-10 flex justify-center pt-6 pb-2">
        <a href={`/${locale}`} aria-label="Mioshy home" className="inline-flex transition-opacity hover:opacity-80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mioshy-white.svg" alt="Mioshy" width={150} height={48} className="h-auto w-[150px]" />
        </a>
      </div>
      <AssessmentClient
        locale={locale as Locale}
        assessmentId={def.id}
        assessmentTitleHe={def.he_title}
        assessmentTitleEn={def.en_title}
        questions={def.questions}
        total={def.total}
        authenticated={!!user}
        subscriptionActive={subscriptionActive}
        initialStep={initialStep}
        initialAnswers={initialAnswers}
      />
    </div>
  );
}
