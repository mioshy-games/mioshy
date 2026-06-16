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
// `JourneyAmbience` (21 animated particles + fog blobs) removed
// 2026-05-19 per Itzik — the per-frame animation cost on the question
// stages was the main suspect for the "Chrome slows the whole machine"
// pattern. Gradient/warmth is now applied ONLY on the signup gate +
// analysis summary inside JourneyClient (`isDone === true`), so the
// question pages stay visually quiet and the per-frame budget drops
// to zero. Component kept on disk for possible later use.
import { AssessmentDiagProbe } from "@/components/journey/AssessmentDiagProbe";
import {
  totalQuestions,
  QUESTIONS as STATIC_QUESTIONS,
  QUESTIONNAIRE,
} from "@/lib/journey/questions";
import { resolveJourneyFlow } from "@/lib/journey/phase";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import type { Locale } from "@/lib/journey/types";
import { listAllPrices } from "@/lib/billing/pricing-queries";
import type { CadenceOption } from "@/lib/billing/pricing-validations";

// Force fresh render on EVERY request - never cache. Critical for an
// auth-aware page: we don't want a stale Cookie+user pair to be served
// to a different visitor.
export const dynamic = "force-dynamic";

export default async function JourneyAssessmentPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams?: { summary?: string };
}) {
  const { locale } = params;
  // Itzik 2026-06-02: when an authed completed user clicks "האבחון
  // הראשון שלכם" on /my/lessons we route here with ?summary=1 so the
  // Phase A guard below knows the user *wants* the analysis summary
  // surface and shouldn't be silently redirected to /my/journey.
  const explicitSummaryIntent = searchParams?.summary === "1";
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
  // F3.3 — journey-specific entitlement signal for the report. Distinct from
  // `subscriptionActive` (which is any active sub, product-agnostic): the
  // pre-purchase "join now" selling sections in AnalysisSummary must be hidden
  // for users who hold a JOURNEY subscription/entitlement specifically, even
  // before they finish the full assessment (report_phase still 'short'). We
  // read getUserEntitlements().journey (active|grace) as the source of truth.
  let journeySubscribed = false;
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
    //
    // 2026-05-19 fix — `.maybeSingle()` plus `ORDER BY last_activity_at DESC`
    // alone misroutes the user when MULTIPLE journeys exist for the same
    // user_id (which happens whenever `journey-inline-signup` claims an
    // anon `complete` row AND a stray anon `in_progress` row in the same
    // transaction — both get `last_activity_at = NOW()` and Postgres
    // picks one arbitrarily).
    //
    // Picking the wrong row sends a finished user back to question 1.
    // Fix: fetch all rows for the user, then sort: complete first,
    // most-progress next, recency last. Mirrors the same sort in
    // `journey-inline-signup`.
    const { data: allJourneys } = await supabase
      .from("journeys")
      .select("id, current_step, status, language, last_activity_at, device_id")
      .eq("user_id", user.id);

    const journey = (allJourneys ?? [])
      .slice()
      .sort((a, b) => {
        const aComplete = a.status === "complete" ? 1 : 0;
        const bComplete = b.status === "complete" ? 1 : 0;
        if (aComplete !== bComplete) return bComplete - aComplete;
        const stepDiff = (b.current_step ?? 0) - (a.current_step ?? 0);
        if (stepDiff !== 0) return stepDiff;
        const aTs = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
        const bTs = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
        return bTs - aTs;
      })[0] ?? null;

    if (journey) {
      console.log("[/journey/assessment] resolved user journey", {
        chosenId: journey.id,
        chosenStatus: journey.status,
        chosenStep: journey.current_step,
        totalCandidatesForUser: allJourneys?.length ?? 0,
      });
    }

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
      // No user-owned journey under RLS — probe for an orphan anon row
      // under the same device. Two legitimate race cases recover here:
      // (a) the link RPC hasn't propagated yet (user_id still NULL on
      // the row) — claim it. (b) the row IS linked to this user but the
      // JWT hasn't reached PostgREST yet — RLS denies, service-role
      // sees it. In both cases we restore progress instead of dumping
      // the user back to Q1.
      const admin = createServiceRoleClient();
      if (admin) {
        const { data: orphan } = await admin
          .from("journeys")
          .select("id, current_step, status, language, user_id, last_activity_at")
          .eq("device_id", deviceIdForLog)
          .order("last_activity_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (orphan && (orphan.user_id === null || orphan.user_id === user.id)) {
          console.log(
            "[/journey/assessment] post-signup race recovery: restoring progress via service-role",
            { journey_id: orphan.id, current_step: orphan.current_step, user_id: orphan.user_id },
          );

          // 2026-05-19 fix — previously this block only RESTORED the
          // in-memory progress so the user wasn't dumped back to Q1.
          // It did NOT actually link the orphan row to the user, so the
          // /api/journey/analyze POST (which queries WHERE user_id = X)
          // kept returning 404 forever. Now we claim the row right here:
          // a one-shot service-role UPDATE that sets user_id on every
          // anon row for this device. Uniqueness constraint
          // `journeys_user_active_key` (UNIQUE(user_id) WHERE status IN
          // ('in_progress','paywall')) means we can't link multiple
          // in-progress rows — first claim the COMPLETE row(s) (no
          // index conflict), then attempt the in-progress one. We do
          // this as two separate UPDATEs so a conflict on the second
          // doesn't roll back the first.
          if (orphan.user_id === null) {
            // Claim COMPLETE rows first — no unique-index conflict here.
            const { error: claimCompleteErr } = await admin
              .from("journeys")
              .update({ user_id: user.id, last_activity_at: new Date().toISOString() })
              .eq("device_id", deviceIdForLog)
              .is("user_id", null)
              .eq("status", "complete");
            if (claimCompleteErr) {
              console.warn(
                "[/journey/assessment] race recovery: claim COMPLETE failed",
                claimCompleteErr.message,
              );
            } else {
              console.log(
                "[/journey/assessment] race recovery: claimed all COMPLETE anon rows for device",
                { device_id: deviceIdForLog, user_id: user.id },
              );
            }
            // Now claim the most recent in_progress/paywall row (if any).
            // We pick the latest by last_activity_at so the user lands
            // on their newest state. Others stay anon (orphaned) — they
            // can be cleaned up by a separate sweeper if needed.
            const { data: latestInProgress } = await admin
              .from("journeys")
              .select("id")
              .eq("device_id", deviceIdForLog)
              .is("user_id", null)
              .in("status", ["in_progress", "paywall"])
              .order("last_activity_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (latestInProgress?.id) {
              const { error: claimIpErr } = await admin
                .from("journeys")
                .update({ user_id: user.id, last_activity_at: new Date().toISOString() })
                .eq("id", latestInProgress.id);
              if (claimIpErr) {
                console.warn(
                  "[/journey/assessment] race recovery: claim in_progress failed",
                  { journey_id: latestInProgress.id, error: claimIpErr.message },
                );
              } else {
                console.log(
                  "[/journey/assessment] race recovery: claimed latest in_progress",
                  { journey_id: latestInProgress.id, user_id: user.id },
                );
              }
            }
          }

          initialProgress = {
            current_step: orphan.current_step as number,
            status: orphan.status as string,
            language: ((orphan.language as string) ?? locale) as Locale,
          };
          // Hydrate prior answers via the same service-role client
          const { data: rows } = await admin
            .from("journey_responses")
            .select("question_id, answer")
            .eq("journey_id", orphan.id);
          if (rows) {
            for (const row of rows) {
              initialAnswers[row.question_id as string] = row.answer;
            }
          }
        } else {
          console.warn(
            "[/journey/assessment] NO journey for this user - possible unlinked anon row:",
            orphan,
          );
        }
      }
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    subscriptionActive = !!sub;

    // F3.3 — resolve the journey entitlement (active|grace) for this user.
    // getUserEntitlements is request-cached and product-aware, so this is the
    // clean signal for gating the pre-purchase selling sections.
    const entitlements = await getUserEntitlements(user.id);
    journeySubscribed = !!entitlements?.journey;

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
    // Itzik 2026-06-02: was `current_step >= totalQuestions()` only,
    // which broke for legacy users when new questions were added — they
    // got dumped back into the questionnaire on every visit even though
    // their `status` was 'complete' the whole time. The status flag is
    // the durable signal; the step count is a soft signal for in-flight.
    const completed =
      !!journey &&
      (journey.status === "complete" ||
        journey.status === "completed" ||
        journey.current_step >= totalQuestions());
    console.log("[/journey/assessment] guard check", {
      subscriptionActive,
      hasJourneyRow: !!journey,
      currentStep: journey?.current_step ?? null,
      totalQuestions: totalQuestions(),
      completed,
      willRedirect: subscriptionActive && completed,
    });
    if (subscriptionActive && completed) {
      // Defense-in-depth (2026-05-24): only redirect back to the
      // dashboard if the user actually has a resolved priorities
      // row. If completed=true but no priorities row, the user is
      // in the "completed assessment but priorities missing" state
      // (e.g. orphan anonymous flow). Without this check, the
      // /my/journey gate's needs_assessment redirect would bounce
      // them right back here → infinite loop. Falling through lets
      // the user re-run the assessment naturally and persist their
      // priorities via the normal /api/journey/answer trigger.
      const { data: priorityCheck } = await supabase
        .from("journey_user_priorities")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (priorityCheck && !explicitSummaryIntent) {
        console.log(
          "[/journey/assessment] ✅ Phase A guard fired - redirecting to /my/journey",
          { user_id: user.id },
        );
        redirect(`/${locale}/my/journey`);
      }
      if (priorityCheck && explicitSummaryIntent) {
        console.log(
          "[/journey/assessment] explicit summary intent — falling through to JourneyClient (AnalysisSummary)",
          { user_id: user.id },
        );
      }
      // No priorities row → fall through. The questionnaire UI will
      // pick up from where the user left off (their current_step is
      // already at the end), they'll re-answer q_priorities, and
      // /api/journey/answer's trigger will write the priorities row.
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
          // Itzik 2026-05-29 bugfix — api/journey/answer writes status
          // 'complete' (singular). The legacy 'completed' filter here
          // never matched a finished anon row, so an anon user who
          // completed the questionnaire and then logged in would be
          // bumped back to Q1 if the device-id branch was the only
          // restore path. We accept both spellings defensively.
          .in("status", ["in_progress", "paywall", "complete", "completed"])
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

  // Journey subscription cadences for the post-assessment purchase
  // picker (C2.4). Display-only: AnalysisSummary renders enabled cadences
  // with effective-weekly + the actual billed line. [] on error → no picker.
  const journeyCadences: CadenceOption[] = (await listAllPrices())
    .filter((p) => p.product === "journey")
    .map(({ cadence, price_ils, price_usd, enabled, is_default }) => ({
      cadence,
      price_ils,
      price_usd,
      enabled,
      is_default,
    }));

  // F3.2 — resolve the ACTIVE flow (short pre-purchase / full post-purchase /
  // single when unseeded) and serve only the UNANSWERED questions of the
  // active phase. Position is answer-driven (resume = first unanswered), so we
  // never re-ask a short question post-purchase. Falls back to the full static
  // set as a single flow if the service-role client is unavailable.
  const answeredSlugs = new Set(Object.keys(initialAnswers));
  const questionsClient = createServiceRoleClient();
  const flow = questionsClient
    ? await resolveJourneyFlow({
        client: questionsClient,
        subscriptionActive,
        answeredSlugs,
      })
    : {
        mode: "single" as const,
        phaseSet: STATIC_QUESTIONS,
        remaining: STATIC_QUESTIONS.filter((q) => !answeredSlugs.has(q.id)),
        phaseTotal: STATIC_QUESTIONS.length,
        answeredInPhaseCount: STATIC_QUESTIONS.filter((q) => answeredSlugs.has(q.id)).length,
        source: "json" as const,
      };

  return (
    <div
      className="relative isolate min-h-screen"
      data-testid="assessment-bg-base"
      style={{
        // Itzik 2026-06-02: simplified to a single uniform dark backdrop.
        // The previous stack of radial gradients (wine/magenta/violet)
        // created horizontal bands - in particular a dark strip behind
        // the logo that didn't match the body. Single linear gradient
        // ensures the logo sits flush with the body background.
        background:
          "linear-gradient(180deg, #0b0712 0%, #0e0913 50%, #100a17 100%)",
      }}
    >
      {/* Ambient drifting orbs — 2026-05-21 per Itzik. Two huge,
          translucent circles that slowly slide toward each other
          and back over ~55–62s. CSS-only (no JS, no rerenders),
          paint-once via radial-gradient, transform-only animation.
          Sit between the static gradient backdrop above and the
          questionnaire UI in JourneyClient (which renders its own
          z-10 surface). Keyframes + tokens live in globals.css. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0 overflow-hidden"
      >
        <div className="journey-ambient-orb journey-ambient-orb--a" />
        <div className="journey-ambient-orb journey-ambient-orb--b" />
      </div>
      <AssessmentDiagProbe />
      {/* Itzik 2026-06-02: Mioshy logo above the funnel - present on
          EVERY assessment screen (intro/questions/sections/auth/summary)
          via the shared page wrapper. 150px wide, centered, modest top
          padding so it doesn't crowd the first question. Wrapped in an
          anchor so clicking the logo returns to the locale's home page. */}
      <div className="relative z-10 flex justify-center pt-6 pb-2">
        <a
          href={`/${locale}`}
          aria-label="Mioshy home"
          className="inline-flex transition-opacity hover:opacity-80"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mioshy-white.svg"
            alt="Mioshy"
            width={150}
            height={48}
            className="h-auto w-[150px]"
          />
        </a>
      </div>
      {/* a11y (M3): page h1. The funnel UI uses per-question h2s, so the
          overall page title is provided sr-only. */}
      <h1 className="sr-only">{locale === "en" ? "Relationship assessment" : "אבחון הזוגיות שלכם"}</h1>
      <JourneyClient
        locale={locale as Locale}
        initialProgress={initialProgress}
        initialAnswers={initialAnswers}
        subscriptionActive={subscriptionActive}
        journeySubscribed={journeySubscribed}
        authenticated={!!user}
        journeyCadences={journeyCadences}
        questions={flow.remaining}
        likertLabels={QUESTIONNAIRE.likert_labels}
        gating={QUESTIONNAIRE.gating}
        phaseTotal={flow.phaseTotal}
        phaseAnsweredBefore={flow.answeredInPhaseCount}
      />
    </div>
  );
}
