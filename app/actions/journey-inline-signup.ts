"use server";

/**
 * Journey-flow signup - server action used by InlineAuthStep when the user
 * hits the auth gate mid-questionnaire (~q34).
 *
 * Why this exists separately from /actions/auth-actions.ts → signupAction:
 *
 * The legacy InlineAuthStep called `supabase.auth.signUp(...)` from the
 * client, which:
 *   1. Sent a confirmation email every time → hit Supabase's email rate
 *      limit (3-4/hour, free tier) → users got 429 "email rate limit
 *      exceeded" on test runs.
 *   2. Returned no session in projects that have email-confirmation on
 *      → the immediately-following `/api/journey/resume` POST fired
 *      WITHOUT a valid auth cookie → `auth.uid()` was NULL inside the
 *      `link_journey_to_user` RPC → the anon journey was never linked
 *      to the new user → on reload the page restarted from q1.
 *
 * This server action sidesteps both:
 *   - Uses `admin.auth.admin.createUser({ email_confirm: true })` -
 *     no email sent, no rate limit.
 *   - Then signs in via the session client which writes the cookie
 *     server-side BEFORE we return → the cookie is in place by the
 *     time the client reloads.
 *   - Then links the anon journey via the SAME session client, so we
 *     run the RPC under the freshly-set auth context within the same
 *     request and never depend on cookie propagation across requests.
 */

import { cookies, headers } from "next/headers";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSession,
} from "@/lib/auth/session-enforcement";
import { fireCompleteRegistrationCapi } from "@/lib/analytics/meta-capi";
import { tagAsRegistered } from "@/lib/email/brevo-segments-sync";

/**
 * The `debug` field is included on every result so the browser console
 * can see the full server-side trace without us asking you to dig through
 * the Next.js dev terminal. Logged in InlineAuthStep on every submit.
 */
export type JourneyDebug = {
  step: string;
  mode: "register" | "login";
  email: string;
  deviceId: string;
  // What was found BEFORE we ran the link RPC - tells us whether the
  // anon journey actually exists in the DB.
  preRpc: {
    anonJourney: {
      id: string;
      current_step: number;
      status: string;
      user_id: string | null;
      last_activity_at: string;
    } | null;
  };
  // The link RPC's return value - uuid of the linked journey or null.
  rpc: {
    linkedJourneyId: string | null;
    error: string | null;
  };
  // Any journey we resolved for the user after linking.
  postLink: {
    journey: {
      id: string;
      current_step: number;
      status: string;
    } | null;
  };
};

export type JourneyInlineSignupResult =
  | {
      success: true;
      userId: string;
      // Journey row that was either freshly linked OR resolved post-link.
      // The client uses .current_step to jump back to where the user left
      // off without an extra round-trip.
      journey: {
        id: string;
        current_step: number;
        status: string;
      } | null;
      debug: JourneyDebug;
    }
  | { success: false; error: string; debug?: Partial<JourneyDebug> };

export async function journeyInlineSignup(args: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  language?: "he" | "en";
  deviceId: string;
  /** "register" or "login" - login path skips createUser. */
  mode: "register" | "login";
  /** Terms + privacy acceptance — REQUIRED to register. Recorded on profiles. */
  termsAccepted?: boolean;
  /** Marketing/dיוור opt-in — optional, recorded on profiles. */
  marketingConsent?: boolean;
  /** WhatsApp opt-in — optional, recorded on profiles (columns from migration 120). */
  whatsappOptIn?: boolean;
}): Promise<JourneyInlineSignupResult> {
  const email = args.email.trim();
  const fullName = args.fullName.trim();
  const phone = (args.phone ?? "").trim();
  const password = args.password;
  const termsAccepted = args.termsAccepted === true;
  const marketingConsent = args.marketingConsent === true;
  const whatsappOptIn = args.whatsappOptIn === true;

  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
  }
  if (args.mode === "register" && !fullName) {
    return { success: false, error: "Full name is required to register." };
  }
  // Itzik 2026-06-17: mobile number required on every signup (backstop
  // for the client `required` on the phone field).
  if (args.mode === "register" && !phone) {
    return { success: false, error: "Mobile number is required to register." };
  }
  if (args.mode === "register" && password.length < 8) {
    return {
      success: false,
      error: "Password must be at least 8 characters.",
    };
  }
  // Terms acceptance is mandatory to register (client also disables the
  // button; this is the server-side backstop). Login users accepted earlier.
  if (args.mode === "register" && !termsAccepted) {
    return {
      success: false,
      error: "You must accept the terms and privacy policy to register.",
    };
  }
  if (!args.deviceId || args.deviceId.length < 8) {
    return { success: false, error: "Missing device id - refresh and retry." };
  }

  console.log("[journeyInlineSignup] start", {
    mode: args.mode,
    email,
    hasFullName: !!fullName,
    deviceId: args.deviceId,
  });

  // Diagnostic envelope - every step writes here, returned to client
  // even on failure paths so the browser console gets the full trace.
  const debug: JourneyDebug = {
    step: "start",
    mode: args.mode,
    email,
    deviceId: args.deviceId,
    preRpc: { anonJourney: null },
    rpc: { linkedJourneyId: null, error: null },
    postLink: { journey: null },
  };

  try {
    const admin = createAdminSupabaseClient();

    // Probe the DB for any journey under this device_id BEFORE any
    // mutation. If this is null, the user never created an anon journey
    // (e.g. cookie was reset, different device, dev hot-reload state).
    {
      const { data: probe } = await admin
        .from("journeys")
        .select("id, current_step, status, user_id, last_activity_at")
        .eq("device_id", args.deviceId)
        .order("last_activity_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      debug.preRpc.anonJourney = (probe ?? null) as JourneyDebug["preRpc"]["anonJourney"];
      debug.step = "probed-anon-journey";
      console.log("[journeyInlineSignup] pre-RPC anon journey", debug.preRpc);
    }

    // ── Register branch ──────────────────────────────────────────────────
    if (args.mode === "register") {
      const { data: userData, error: createError } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true, // skips confirmation email + rate limit
          user_metadata: {
            full_name: fullName,
            phone,
            language: args.language ?? "he",
          },
        });

      if (createError) {
        const msg = createError.message.toLowerCase();
        if (msg.includes("already") || msg.includes("registered")) {
          console.warn("[journeyInlineSignup] user already exists", { email });
          return {
            success: false,
            error:
              "An account with this email already exists. Switch to login.",
            debug,
          };
        }
        console.error("[journeyInlineSignup] createUser failed", createError);
        return { success: false, error: createError.message, debug };
      }

      const userId = userData.user.id;
      console.log("[journeyInlineSignup] user created", { userId });

      // Upsert profile row with name + phone + consent (mirrors signupAction).
      // marketing_consent* columns already exist on profiles.
      const nowIso = new Date().toISOString();
      const { error: profileErr } = await admin.from("profiles").upsert(
        {
          id: userId,
          full_name: fullName,
          phone: phone || null,
          marketing_consent: marketingConsent,
          marketing_consent_at: marketingConsent ? nowIso : null,
          marketing_consent_source: "journey_inline",
          // WhatsApp opt-in columns exist since migration 120. Stamp _at only
          // when opted in; source mirrors the marketing_consent_source value.
          whatsapp_opt_in: whatsappOptIn,
          whatsapp_opt_in_at: whatsappOptIn ? nowIso : null,
          whatsapp_opt_in_source: "journey_inline",
        },
        { onConflict: "id" },
      );
      if (profileErr) {
        console.warn(
          "[journeyInlineSignup] profile upsert failed (non-fatal)",
          profileErr.message,
        );
      }

      // terms_accepted / terms_accepted_at are added by migration 141. Write
      // them in a SEPARATE best-effort update so signup still succeeds on any
      // environment where the migration hasn't been applied yet (the column
      // would otherwise make the whole upsert above fail). Once 141 is live,
      // this records the acceptance + timestamp.
      const { error: termsErr } = await admin
        .from("profiles")
        .update({
          terms_accepted: termsAccepted,
          terms_accepted_at: termsAccepted ? nowIso : null,
        })
        .eq("id", userId);
      if (termsErr) {
        console.warn(
          "[journeyInlineSignup] terms columns write failed (non-fatal — run migration 141)",
          termsErr.message,
        );
      }

      // Fire-and-forget Brevo sync. Israeli Communications Act §30A:
      // marketing emails require prior explicit consent, so we only call
      // Brevo when the user ticked the box. Auth + profile creation are
      // the source of truth — Brevo failure must NEVER fail the signup.
      if (marketingConsent) {
        try {
          const syncResult = await tagAsRegistered(
            email,
            userId,
            args.language ?? "he",
          );
          if (!syncResult.success) {
            console.warn(
              "[journeyInlineSignup] tagAsRegistered returned non-success:",
              syncResult.error,
            );
          }
        } catch (brevoErr) {
          console.error("[journeyInlineSignup] Brevo sync failed", brevoErr);
        }
      }
    }

    // ── Sign-in (both branches) ──────────────────────────────────────────
    // Sign in via the session client so the auth cookie is written by the
    // time we return. The link_journey RPC below + the client's reload
    // both rely on this cookie being present.
    const supabase = await createServerSupabaseClient();
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (signInError || !signInData.session) {
      console.error("[journeyInlineSignup] sign-in failed", signInError);
      return {
        success: false,
        error: signInError?.message ?? "Sign-in failed.",
        debug,
      };
    }
    const userId = signInData.session.user.id;
    debug.step = "signed-in";
    console.log("[journeyInlineSignup] signed in", { userId });

    // ── Single-session record + cookie ───────────────────────────────────
    const hdrs = await headers();
    const token = await createSession(userId, {
      ua: hdrs.get("user-agent") ?? "unknown",
      ip:
        hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip") ?? "unknown",
    });
    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    // ── Claim anon journeys to the user (AUTHORITATIVE service-role) ─────
    // We do NOT call link_journey_to_user / trust its return value. That RPC
    // is unreliable here: it RETURNs a scalar from a multi-row UPDATE and
    // trips the partial unique index that allows a user only ONE active
    // (non-complete) journey
    //   journeys_user_active_key: UNIQUE(user_id) WHERE status IN
    //   ('in_progress','paywall')
    // — so on a device with several anon rows it either errors or links an
    // arbitrary subset. Instead we claim deterministically with the admin
    // client, in an order that respects that index:
    //   1. Claim ALL complete/completed rows first — terminal statuses sit
    //      OUTSIDE the active index, so linking many at once never conflicts.
    //   2. Then claim AT MOST ONE active row (in_progress/paywall), the best
    //      by progress→recency — linking two active rows to one user would
    //      violate the index and abort the whole statement.
    // Primary (the row the client jumps back to) = complete → step → recency.
    debug.step = "claim-attempted";
    const isCompleteStatus = (s: string) =>
      s === "complete" || s === "completed";
    const tsOf = (r: { last_activity_at: string | null }) =>
      r.last_activity_at ? new Date(r.last_activity_at).getTime() : 0;

    const { data: anonRows, error: listErr } = await admin
      .from("journeys")
      .select("id, status, last_activity_at, current_step")
      .eq("device_id", args.deviceId)
      .is("user_id", null)
      .order("last_activity_at", { ascending: false });

    if (listErr) {
      console.error("[journeyInlineSignup] claim list failed", listErr);
      debug.rpc.error = "claim list: " + listErr.message;
    } else {
      const rows = (anonRows ?? []) as Array<{
        id: string;
        status: string;
        last_activity_at: string | null;
        current_step: number;
      }>;
      const completes = rows.filter((r) => isCompleteStatus(r.status));
      const actives = rows.filter((r) => !isCompleteStatus(r.status));
      const bestActive =
        actives
          .slice()
          .sort((a, b) => {
            const stepDiff = (b.current_step ?? 0) - (a.current_step ?? 0);
            if (stepDiff !== 0) return stepDiff;
            return tsOf(b) - tsOf(a);
          })[0] ?? null;

      console.log("[journeyInlineSignup] claim candidates", {
        count: rows.length,
        completeIds: completes.map((r) => r.id),
        activeChosen: bestActive?.id ?? null,
        activeDropped: actives
          .filter((r) => r.id !== bestActive?.id)
          .map((r) => r.id),
      });

      const nowIso = new Date().toISOString();

      // 1. All complete/completed rows together — no index conflict.
      if (completes.length > 0) {
        const { error: cErr } = await admin
          .from("journeys")
          .update({ user_id: userId, last_activity_at: nowIso })
          .in(
            "id",
            completes.map((r) => r.id),
          );
        if (cErr) {
          console.error(
            "[journeyInlineSignup] claim complete rows failed",
            cErr,
          );
          debug.rpc.error =
            (debug.rpc.error ? debug.rpc.error + " | " : "") +
            "claim complete: " +
            cErr.message;
        }
      }

      // 2. At most ONE active row — tolerate an index conflict (e.g. the user
      //    already owns an active journey); the complete claim above stands.
      if (bestActive) {
        const { error: aErr } = await admin
          .from("journeys")
          .update({ user_id: userId, last_activity_at: nowIso })
          .eq("id", bestActive.id);
        if (aErr) {
          console.warn(
            "[journeyInlineSignup] claim active row failed (tolerated)",
            { id: bestActive.id, error: aErr.message },
          );
          debug.rpc.error =
            (debug.rpc.error ? debug.rpc.error + " | " : "") +
            "claim active: " +
            aErr.message;
        }
      }

      // Primary for the client: complete → most steps → most recent.
      const claimed = [...completes, ...(bestActive ? [bestActive] : [])];
      const primary =
        claimed
          .slice()
          .sort((a, b) => {
            const aC = isCompleteStatus(a.status) ? 1 : 0;
            const bC = isCompleteStatus(b.status) ? 1 : 0;
            if (aC !== bC) return bC - aC;
            const stepDiff = (b.current_step ?? 0) - (a.current_step ?? 0);
            if (stepDiff !== 0) return stepDiff;
            return tsOf(b) - tsOf(a);
          })[0] ?? null;
      debug.rpc.linkedJourneyId = primary?.id ?? null;

      if (rows.length === 0) {
        console.warn(
          "[journeyInlineSignup] claim found ZERO anon journeys to link",
          { deviceId: args.deviceId },
        );
      } else {
        console.log("[journeyInlineSignup] claim linked journeys", {
          primaryJourneyId: primary?.id ?? null,
          primaryStatus: primary?.status ?? null,
          totalCompleteLinked: completes.length,
          activeLinked: bestActive?.id ?? null,
        });
      }
    }
    debug.step = "rpc-complete";

    // ── Resolve final journey state for the client ───────────────────────
    // Use the admin client so we don't depend on RLS visibility for the
    // freshly-linked row in this request.
    //
    // 2026-05-19 fix — previously ordered ONLY by `last_activity_at DESC`,
    // which is wrong when MULTIPLE journeys were just linked: my
    // fallback UPDATE sets `last_activity_at = NOW()` on all matching
    // rows in one statement, so they all share the same timestamp and
    // Postgres picks one arbitrarily (often the in_progress, step=1
    // one instead of the complete, step=29 one). Result: client gets
    // "you're at step 1, keep answering" and loops the user back into
    // the assessment.
    //
    // Fix — sort COMPLETE journeys first, then by step (most progress),
    // then by recency. That guarantees we surface the assessment the
    // user just finished, not a stray in_progress row created by
    // hot reload or a race condition in /api/journey/answer.
    const { data: candidateJourneys } = await admin
      .from("journeys")
      .select("id, current_step, status, last_activity_at")
      .eq("user_id", userId);

    const journey = (candidateJourneys ?? [])
      .slice()
      .sort((a, b) => {
        // Prefer terminal status (complete/completed) over everything else.
        const aComplete = isCompleteStatus(a.status) ? 1 : 0;
        const bComplete = isCompleteStatus(b.status) ? 1 : 0;
        if (aComplete !== bComplete) return bComplete - aComplete;
        // Then prefer the one with the most progress.
        const stepDiff = (b.current_step ?? 0) - (a.current_step ?? 0);
        if (stepDiff !== 0) return stepDiff;
        // Finally fall back to recency.
        const aTs = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
        const bTs = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
        return bTs - aTs;
      })[0] ?? null;

    if (journey) {
      console.log("[journeyInlineSignup] resolved final journey (sorted)", {
        chosenId: journey.id,
        chosenStatus: journey.status,
        chosenStep: journey.current_step,
        totalCandidatesForUser: candidateJourneys?.length ?? 0,
      });
    }

    // Diagnostic: also count journey_responses for the resolved journey,
    // because that's what /my/journey gates on. If the journey is linked
    // but responses are 0, /my/journey will show the "assessment_missing"
    // recovery banner - and we want to know about it from the signup logs.
    let responsesCount = 0;
    if (journey?.id) {
      const { count } = await admin
        .from("journey_responses")
        .select("question_id", { count: "exact", head: true })
        .eq("journey_id", journey.id);
      responsesCount = count ?? 0;
    }

    debug.postLink.journey = (journey ?? null) as JourneyDebug["postLink"]["journey"];
    debug.step = "complete";
    console.log("[journeyInlineSignup] complete", {
      userId,
      journey,
      // critical: if this is 0 the user will be looped to /journey/assessment
      // unless we render the recovery banner. Surface so we can spot it.
      journey_responses_count: responsesCount,
      will_loop_at_my_journey: !!journey?.id && responsesCount === 0,
    });
    // Meta CompleteRegistration (CAPI) — register branch only. Awaited for
    // reliable serverless delivery (no browser backup); bounded + non-throwing,
    // so it never blocks or breaks the funnel.
    if (args.mode === "register") {
      // Funnel marker (journey-assessment-funnel-brief §A.4): "registered" —
      // emitted server-side here so it fires exactly once per new signup,
      // deterministically (no client round-trip to miss). Constant
      // assessment_id:"journey". Best-effort: never blocks or fails the signup.
      const { error: markerErr } = await admin.from("analytics_events").insert({
        event: "journey_assessment_registered",
        session_id: null,
        device_id: args.deviceId,
        user_id: userId,
        locale: args.language ?? null,
        properties: { assessment_id: "journey" },
      });
      if (markerErr) {
        console.warn(
          "[journeyInlineSignup] registered marker insert failed (non-fatal)",
          markerErr.message,
        );
      }

      await fireCompleteRegistrationCapi({ userId, email, phone });
    }

    return { success: true, userId, journey: journey ?? null, debug };
  } catch (err) {
    console.error("[journeyInlineSignup] unhandled error", err);
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Unexpected sign-up failure.",
      debug,
    };
  }
}
