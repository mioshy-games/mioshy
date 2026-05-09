/**
 * /[locale]/journey/assessment
 *
 * Questionnaire (assessment) entry. Pre-fetches progress + subscription
 * status and hands off to the client orchestrator.
 *
 * Anonymous progress: answers are always persisted server-side via the
 * device_id cookie. On return/refresh we restore current_step so the user
 * continues from where they left off - even before creating an account.
 *
 * Previously lived at /[locale]/journey/page.tsx - moved here as part of
 * the Journey Content System carve-out (Phase 0). /journey now routes
 * between marketing / resume-assessment / timeline based on state.
 * See docs/journey-content-system-design.md §9.
 */

import { setRequestLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { getCurrentUserPact } from "@/lib/journey/pacts";
import { JourneyClient } from "@/components/journey/JourneyClient";
import { JourneyAmbience } from "@/components/journey/JourneyAmbience";
import { AssessmentDiagProbe } from "@/components/journey/AssessmentDiagProbe";
import { totalQuestions } from "@/lib/journey/questions";
import type { Locale } from "@/lib/journey/types";

// Force fresh render on EVERY request - never cache. Critical for an
// auth-aware page: we don't want a stale Cookie+user pair to be served
// to a different visitor.
export const dynamic = "force-dynamic";

export default async function JourneyAssessmentPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);

  // ⚠️ BUILD MARKER - bumped 2026-04-30 with the Phase-A post-payment
  // guard. If a paid+completed user hits this page, we redirect them
  // to /my/journey instead of letting them re-enter the assessment.
  // Look for the redirect log line below to confirm the guard fired.
  console.log("[/journey/assessment] BUILD=2026-04-30-phaseA-guard v1");

  const cookieStoreForLog = cookies();
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Layer-1 pact gate: an authenticated user with NO pact AND no
  // existing progress sees the intro screen first. Mid-flow users
  // (progress > 0) skip the gate so we don't yank them out of a
  // questionnaire they're already in. Anonymous users skip too —
  // they need to enter the funnel first; the pact is captured after
  // sign-up via the same intro page (which getCurrentUserPact will
  // route them to once they're authenticated).
  if (user) {
    const existingPact = await getCurrentUserPact();
    if (!existingPact) {
      // Primary lookup — journeys owned by THIS user via the session
      // client (RLS-aware).
      const { data: existingJourney } = await supabase
        .from("journeys")
        .select("current_step")
        .eq("user_id", user.id)
        .order("last_activity_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      let startedAlready =
        ((existingJourney as { current_step: number } | null)?.current_step ??
          0) > 0;

      // F10 — fallback for the post-signup race. After the inline-auth
      // step the journey link RPC sometimes hasn't propagated to RLS by
      // the time this server component runs (cookie set, but auth.uid
      // hasn't reached the new row yet). Without this fallback the user
      // gets redirected to /intro as if they never started — even
      // though they just completed all 29 questions as anon.
      // We check the device_id cookie via service-role: if there's an
      // anonymous (or freshly-linked) journey on this device with
      // progress, treat them as "started" and let them through.
      if (!startedAlready) {
        const deviceId = cookieStoreForLog.get("mioshy_device_id")?.value;
        if (deviceId) {
          const adminProbe = createServiceRoleClient();
          if (adminProbe) {
            const { data: anonJ } = await adminProbe
              .from("journeys")
              .select("current_step")
              .eq("device_id", deviceId)
              .order("last_activity_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            const anonProgress =
              ((anonJ as { current_step: number } | null)?.current_step ?? 0) > 0;
            if (anonProgress) {
              startedAlready = true;
              console.log(
                "[/journey/assessment] device_id fallback found progress, skipping /intro redirect",
                { deviceId, anonProgress },
              );
            }
          }
        }
      }

      if (!startedAlready) {
        console.log(
          "[/journey/assessment] no pact + no progress → /journey/assessment/intro",
        );
        redirect(`/${locale}/journey/assessment/intro`);
      }
    }
  }

  console.log("[/journey/assessment] entry", {
    user_id: user?.id ?? null,
    user_email: user?.email ?? null,
    isAuthed: !!user,
  });

  let initialProgress: { current_step: number; status: string; language: Locale } | null = null;
  let subscriptionActive = false;
  // Prior answers, keyed by question_id. Hydrated below for both
  // authenticated + anon journeys so the client can pre-fill the
  // selected answer when the user navigates back to a previously-
  // answered question. UX feedback 2026-05-05: "כשחוזרים אחורה צריך
  // לראות את מה שנבחר מקודם".
  const initialAnswers: Record<string, unknown> = {};

  const deviceIdForLog = cookieStoreForLog.get("mioshy_device_id")?.value ?? null;

  if (user) {
    // F10 — self-heal: if the user has no journey under their id but
    // the device cookie points at an anonymous one, link it now. The
    // inline-signup action does this in the same request, but on slow
    // connections / mobile flakes the cookie can land before the RPC
    // result, so we make the page idempotent and re-link if needed.
    {
      const { data: hasOwnJourney } = await supabase
        .from("journeys")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (!hasOwnJourney && deviceIdForLog) {
        const adminLink = createServiceRoleClient();
        if (adminLink) {
          const { data: linked } = await adminLink
            .from("journeys")
            .update({
              user_id: user.id,
              last_activity_at: new Date().toISOString(),
            })
            .eq("device_id", deviceIdForLog)
            .is("user_id", null)
            .select("id")
            .maybeSingle();
          if (linked) {
            console.log(
              "[/journey/assessment] self-heal: linked anon journey to user",
              { user_id: user.id, journey_id: linked.id },
            );
          }
        }
      }
    }

    // ── Authenticated user: restore progress + check subscription ────────
    const { data: journey } = await supabase
      .from("journeys")
      .select("id, current_step, status, language, last_activity_at, device_id")
      .eq("user_id", user.id)
      .order("last_activity_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (journey) {
      initialProgress = {
        current_step: journey.current_step,
        status: journey.status,
        language: (journey.language ?? locale) as Locale,
      };

      // Pull all prior responses so the client can pre-fill answers when
      // the user navigates back. RLS allows the user to read their own
      // journey_responses; no admin client needed here.
      const { data: rows } = await supabase
        .from("journey_responses")
        .select("question_id, answer")
        .eq("journey_id", journey.id);
      if (rows) {
        for (const row of rows) {
          initialAnswers[row.question_id as string] = row.answer;
        }
      }
    } else if (deviceIdForLog) {
      // No user-owned journey - possibly the resume call didn't link the
      // anon row. Probe for an orphan anon journey under the same device
      // and surface it on the page log so we can see what should have
      // been linked.
      const admin = createServiceRoleClient();
      if (admin) {
        const { data: orphan } = await admin
          .from("journeys")
          .select("id, current_step, status, user_id, last_activity_at")
          .eq("device_id", deviceIdForLog)
          .order("last_activity_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        console.warn(
          "[/journey/assessment] NO journey for this user - possible unlinked anon row:",
          orphan,
        );
      }
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    subscriptionActive = !!sub;

    // ── Post-purchase guard ─────────────────────────────────────────────────
    // Per spec §4 + §6.0: a user with an active subscription should NEVER
    // re-encounter the assessment. They've paid; they're done; their seat
    // is in /my/journey. Without this guard the post-payment redirect path
    // can dump them right back here on refresh / browser back, which was
    // the worst UX issue reported.
    //
    // Edge case we're tolerant to: completed=true but no subscription -
    // that's the natural state of an anon → registered user who hasn't
    // paid yet. We let them see AnalysisSummary with the CTA, as designed.
    const completed =
      !!journey && journey.current_step >= totalQuestions();
    console.log("[/journey/assessment] guard check", {
      subscriptionActive,
      hasJourneyRow: !!journey,
      currentStep: journey?.current_step ?? null,
      totalQuestions: totalQuestions(),
      completed,
      willRedirect: subscriptionActive && completed,
    });
    if (subscriptionActive && completed) {
      console.log(
        "[/journey/assessment] ✅ Phase A guard fired - redirecting to /my/journey",
        { user_id: user.id },
      );
      redirect(`/${locale}/my/journey`);
    }
  } else {
    // ── Anonymous user: restore progress from device_id cookie ───────────
    // Answers are already being saved by /api/journey/answer (via admin
    // client) using the device_id from the x-device-id header. On refresh
    // or return we read the same cookie server-side to resume the journey.
    const cookieStore = cookies();
    const deviceId = cookieStore.get("mioshy_device_id")?.value;

    if (deviceId) {
      // Use service-role to bypass RLS (anonymous rows have no auth.uid())
      const admin = createServiceRoleClient();
      if (admin) {
        const { data: journey } = await admin
          .from("journeys")
          .select("id, current_step, status, language")
          .eq("device_id", deviceId)
          .is("user_id", null)          // only anonymous rows
          .in("status", ["in_progress", "paywall", "completed"])
          .order("last_activity_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (journey && journey.current_step > 0) {
          initialProgress = {
            current_step: journey.current_step,
            status: journey.status,
            language: (journey.language ?? locale) as Locale,
          };

          // Hydrate prior anon answers (admin client - anon rows have no
          // auth.uid() to drive RLS).
          const { data: rows } = await admin
            .from("journey_responses")
            .select("question_id, answer")
            .eq("journey_id", journey.id);
          if (rows) {
            for (const row of rows) {
              initialAnswers[row.question_id as string] = row.answer;
            }
          }
        }
      }
    }
  }

  return (
    <div
      className="relative isolate min-h-screen bg-[#070b18]"
      data-testid="assessment-bg-base"
    >
      <AssessmentDiagProbe />
      <JourneyAmbience />
      <JourneyClient
        locale={locale as Locale}
        initialProgress={initialProgress}
        initialAnswers={initialAnswers}
        subscriptionActive={subscriptionActive}
        authenticated={!!user}
      />
    </div>
  );
}
