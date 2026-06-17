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
}): Promise<JourneyInlineSignupResult> {
  const email = args.email.trim();
  const fullName = args.fullName.trim();
  const phone = (args.phone ?? "").trim();
  const password = args.password;

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
  if (args.mode === "register" && password.length < 6) {
    return {
      success: false,
      error: "Password must be at least 6 characters.",
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

      // Upsert profile row with name + phone (mirrors signupAction).
      const { error: profileErr } = await admin.from("profiles").upsert(
        { id: userId, full_name: fullName, phone: phone || null },
        { onConflict: "id" },
      );
      if (profileErr) {
        console.warn(
          "[journeyInlineSignup] profile upsert failed (non-fatal)",
          profileErr.message,
        );
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

    // ── Link anon journey to user ────────────────────────────────────────
    // Done in the SAME request as sign-in so the auth context is
    // guaranteed established before the RPC runs.
    //
    // FALLBACK: the link_journey_to_user RPC uses auth.uid() under
    // SECURITY DEFINER. If for any reason the cookie hasn't propagated
    // even within this same request, the RPC throws "not authenticated".
    // We therefore ALSO try a service-role direct UPDATE as a backup -
    // it sees no auth context but trusts the userId we just signed in
    // with. That guarantees the link happens.
    const { data: linkedId, error: linkErr } = await supabase.rpc(
      "link_journey_to_user",
      { p_device_id: args.deviceId },
    );
    debug.rpc.linkedJourneyId = (linkedId as string | null) ?? null;
    debug.rpc.error = linkErr?.message ?? null;
    debug.step = "rpc-attempted";

    if (linkErr || !linkedId) {
      console.warn(
        "[journeyInlineSignup] RPC didn't link, falling back to service-role UPDATE",
        { rpcError: linkErr?.message, linkedId },
      );
      // 2026-05-19 — previously used `.maybeSingle()` here, which
      // throws when MULTIPLE anon journeys exist under the same
      // device_id. Common in dev (hot reload re-mounting JourneyClient)
      // and possible in prod (user started+abandoned a few times).
      // Confirmed 2026-05-19 incident: probe showed 3 anon journeys for
      // the same device_id → fallback failed → user got 404 forever.
      //
      // New shape:
      //   1. List all matching anon journeys.
      //   2. Pick the "primary" — prefer status='complete', else most
      //      recent — to set as linkedJourneyId for downstream UI.
      //   3. UPDATE ALL of them to set user_id (so the user owns the
      //      whole set and stragglers don't keep cluttering the
      //      anon pool / get re-claimed by some other future signup).
      const { data: candidates, error: listErr } = await admin
        .from("journeys")
        .select("id, status, last_activity_at, current_step")
        .eq("device_id", args.deviceId)
        .is("user_id", null)
        .order("last_activity_at", { ascending: false });

      if (listErr) {
        console.error(
          "[journeyInlineSignup] fallback list failed",
          listErr,
        );
        debug.rpc.error =
          (debug.rpc.error ?? "") + " | fallback list: " + listErr.message;
      } else {
        const list = (candidates ?? []) as Array<{
          id: string;
          status: string;
          last_activity_at: string | null;
          current_step: number;
        }>;
        console.log("[journeyInlineSignup] fallback candidates", {
          count: list.length,
          ids: list.map((r) => r.id),
          statuses: list.map((r) => r.status),
          steps: list.map((r) => r.current_step),
        });

        if (list.length > 0) {
          const primary =
            list.find((r) => r.status === "complete") ?? list[0];

          const { error: updErr } = await admin
            .from("journeys")
            .update({
              user_id: userId,
              last_activity_at: new Date().toISOString(),
            })
            .eq("device_id", args.deviceId)
            .is("user_id", null);

          if (updErr) {
            console.error(
              "[journeyInlineSignup] fallback UPDATE failed",
              updErr,
            );
            debug.rpc.error =
              (debug.rpc.error ?? "") + " | fallback update: " + updErr.message;
          } else {
            console.log(
              "[journeyInlineSignup] fallback UPDATE linked journeys",
              {
                primaryJourneyId: primary.id,
                primaryStatus: primary.status,
                primarySteps: primary.current_step,
                totalLinked: list.length,
              },
            );
            debug.rpc.linkedJourneyId = primary.id;
          }
        } else {
          console.warn(
            "[journeyInlineSignup] fallback found ZERO anon journeys to link",
            { deviceId: args.deviceId },
          );
        }
      }
    } else {
      console.log("[journeyInlineSignup] linked anon journey via RPC", {
        linkedId,
        deviceId: args.deviceId,
      });
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
        // Prefer status='complete' over everything else.
        const aComplete = a.status === "complete" ? 1 : 0;
        const bComplete = b.status === "complete" ? 1 : 0;
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
