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
import { loadAssessmentQuestions } from "@/lib/assessments/questions-db";
import { AssessmentClient } from "@/components/assessments/AssessmentClient";
import { getOtpConsentCopy } from "@/lib/auth/otp-consent";
import { CmsTextProvider } from "@/components/cms/CmsTextProvider";
import { loadCmsTextsForPage } from "@/lib/cms/server";
import { listAllPrices } from "@/lib/billing/pricing-queries";
import type { CadenceOption } from "@/lib/billing/pricing-validations";
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

  // Live questions from the DB (admin-editable); falls back to the static bank.
  const questions = await loadAssessmentQuestions(supabase, assessmentId);

  // Journey subscription cadences for the post-assessment upsell picker
  // (C2.4). Display-only: the picker renders enabled cadences; the weekly
  // row stays the savings baseline. Falls back to [] on error → no picker.
  const journeyCadences: CadenceOption[] = (await listAllPrices())
    .filter((p) => p.product === "journey")
    .map(
      ({
        cadence,
        price_ils,
        price_usd,
        coaching_cost_ils,
        coaching_cost_usd,
        enabled,
        is_default,
      }) => ({
        cadence,
        price_ils,
        price_usd,
        coaching_cost_ils,
        coaching_cost_usd,
        enabled,
        is_default,
      }),
    );

  // CMS rows for the post-assessment journey upsell value-points
  // (admin-editable via /admin/content, page='journey'). Falls back to
  // messages when a row is absent.
  const cmsRows = await loadCmsTextsForPage("journey");

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
      style={{
        // Brand-warm backdrop (not flat near-black): deep wine/purple base
        // with a soft gold glow top-start, wine glow top-end and a violet
        // wash at the bottom. CSS-only, paint-once. Itzik 2026-06-07.
        background:
          "radial-gradient(1200px 760px at 12% -10%, rgba(252,202,101,0.18), transparent 58%)," +
          "radial-gradient(1000px 700px at 92% 2%, rgba(184,60,77,0.38), transparent 60%)," +
          "radial-gradient(980px 780px at 50% 110%, rgba(168,85,247,0.32), transparent 66%)," +
          "linear-gradient(180deg, #2a1730 0%, #221334 48%, #271637 100%)",
      }}
    >
      <div className="relative z-10 flex justify-center pt-6 pb-2">
        <a href={`/${locale}`} aria-label="Mioshy home" className="inline-flex transition-opacity hover:opacity-80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mioshy-white.svg" alt="Mioshy" width={150} height={48} className="h-auto w-[150px]" />
        </a>
      </div>
      <CmsTextProvider rows={cmsRows}>
        <AssessmentClient
          locale={locale as Locale}
          assessmentId={def.id}
          assessmentTitleHe={def.he_title}
          assessmentTitleEn={def.en_title}
          questions={questions}
          total={questions.length}
          authenticated={!!user}
          subscriptionActive={subscriptionActive}
          initialStep={initialStep}
          initialAnswers={initialAnswers}
          journeyCadences={journeyCadences}
          consent={await getOtpConsentCopy(locale === "en" ? "en" : "he")}
        />
      </CmsTextProvider>
    </div>
  );
}
