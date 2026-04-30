"use server";

// ============================================================
// Invite-claim server actions
// ============================================================
// Powers the /[locale]/invite/[token] landing page. The invitee
// either:
//   a) creates a new account (email pre-filled from invitation)
//   b) signs in to an existing account (same email as invitation)
// and in both cases we finish by atomically accepting the
// invitation → inserting them into couple_members.
//
// On success we also write the single-session cookie so the user
// lands already signed in at /<locale>/my.
// ============================================================

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSession,
} from "@/lib/auth/session-enforcement";
import {
  acceptInvitationForCurrentUser,
  getInvitationByToken,
  isInvitationRedeemable,
  normaliseEmail,
} from "@/lib/between-us/invitations";
import { migrateSoloJourneyToCouple } from "@/lib/journey-content/migrate-solo-to-couple";

type Ok = { ok: true; couple_id: string };
type Err = { ok: false; error: string };
type Result = Ok | Err;

// ─────────────────────────────────────────────────────────────────
// Session helpers (kept in-sync with app/actions/auth-actions.ts)
// ─────────────────────────────────────────────────────────────────
async function getDeviceInfo() {
  const hdrs = await headers();
  return {
    ua: hdrs.get("user-agent") ?? "unknown",
    ip: hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip") ?? "unknown",
  };
}

async function writeSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

// ─────────────────────────────────────────────────────────────────
// Invitation preflight
// ─────────────────────────────────────────────────────────────────
async function verifyInvitationPreflight(
  token: string,
  expectedEmail: string | null,
): Promise<{ ok: true; couple_id: string } | Err> {
  if (!token || typeof token !== "string") {
    return { ok: false, error: "invitation_not_found" };
  }
  const invitation = await getInvitationByToken(token);
  if (!invitation) return { ok: false, error: "invitation_not_found" };
  if (invitation.status === "accepted") {
    return { ok: false, error: "invitation_not_pending" };
  }
  if (invitation.status === "revoked") {
    return { ok: false, error: "invitation_not_pending" };
  }
  if (!isInvitationRedeemable(invitation)) {
    return { ok: false, error: "invitation_expired" };
  }
  // If an email was supplied (usually the invitee-email we pre-filled),
  // make sure they haven't swapped it with another address.
  if (
    expectedEmail &&
    normaliseEmail(expectedEmail) !== invitation.invitee_email
  ) {
    return { ok: false, error: "invitation_email_mismatch" };
  }
  return { ok: true, couple_id: invitation.couple_id as string };
}

// ─────────────────────────────────────────────────────────────────
// Normalise mobile number - keep same rules as profile form
// ─────────────────────────────────────────────────────────────────
function normaliseMobile(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

// ─────────────────────────────────────────────────────────────────
// NEW USER path - create account + accept invitation
// ─────────────────────────────────────────────────────────────────
export async function claimInviteAsNewUser(params: {
  token: string;
  email: string;
  fullName: string;
  mobile: string;
  password: string;
}): Promise<Result> {
  const token = (params.token ?? "").trim();
  const email = normaliseEmail(params.email ?? "");
  const fullName = (params.fullName ?? "").trim();
  const mobile = normaliseMobile(params.mobile ?? "");
  const password = params.password ?? "";

  if (!email) return { ok: false, error: "invalid_email" };
  if (fullName.length < 2) return { ok: false, error: "invalid_full_name" };
  if (!mobile) return { ok: false, error: "invalid_mobile" };
  if (password.length < 6) return { ok: false, error: "weak_password" };

  // 1. Verify invitation is still redeemable + email matches.
  const pre = await verifyInvitationPreflight(token, email);
  if (!pre.ok) return pre;

  const admin = createAdminSupabaseClient();

  // 2. Create the auth user. If the email is already registered, we
  //    kick them to the "sign in" tab.
  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

  if (createErr) {
    const msg = createErr.message?.toLowerCase() ?? "";
    if (
      msg.includes("already registered") ||
      msg.includes("already been registered") ||
      msg.includes("user already")
    ) {
      return { ok: false, error: "email_already_registered" };
    }
    return { ok: false, error: createErr.message || "signup_failed" };
  }

  const userId = created.user.id;

  // 3. Upsert profile row (both `mobile` and `phone` columns exist -
  //    write to both so legacy readers still work).
  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      full_name: fullName,
      mobile,
      phone: mobile,
    },
    { onConflict: "id" },
  );
  if (profileErr) {
    console.error("[invite-claim/new] profile upsert failed", profileErr);
    // Non-fatal - the user can edit the profile later.
  }

  // 4. Sign them in (so the anon client has a valid session for the
  //    RPC call below).
  const supabase = await createServerSupabaseClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) {
    return { ok: false, error: "signin_after_signup_failed" };
  }

  // 5. Accept the invitation atomically via the SECURITY DEFINER RPC.
  const accept = await acceptInvitationForCurrentUser(token);
  if (!accept.ok) {
    return { ok: false, error: accept.error };
  }

  // 5a. Promote any solo journey assignments either member owned into
  //     shared couple ownership - best-effort; pairing still succeeds
  //     if this fails. (A brand-new account has nothing to migrate.)
  try {
    await migrateSoloJourneyToCouple({
      userId,
      coupleId: accept.couple_id,
    });
  } catch (err) {
    console.error("[invite-claim/new] journey migration failed", err);
  }

  // 6. Write the mioshy single-session cookie.
  const sessionToken = await createSession(userId, await getDeviceInfo());
  await writeSessionCookie(sessionToken);

  revalidatePath("/[locale]/my", "page");
  revalidatePath("/[locale]/account", "page");
  return { ok: true, couple_id: accept.couple_id };
}

// ─────────────────────────────────────────────────────────────────
// EXISTING USER path - sign in (if needed) + accept invitation
// ─────────────────────────────────────────────────────────────────
export async function claimInviteAsExistingUser(params: {
  token: string;
  email?: string;
  password?: string;
}): Promise<Result> {
  const token = (params.token ?? "").trim();
  const supabase = await createServerSupabaseClient();

  // 1. Preflight - we still want an email to validate when provided.
  const pre = await verifyInvitationPreflight(token, params.email ?? null);
  if (!pre.ok) return pre;

  // 2. Figure out if we already have the right session. If the caller
  //    passed email+password, sign them in first (this handles the
  //    "I have an account" tab on the landing page even when they
  //    aren't signed in yet).
  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();

  let userId: string | null = existingUser?.id ?? null;

  if (params.email && params.password) {
    const email = normaliseEmail(params.email);
    if (existingUser && existingUser.email?.toLowerCase() !== email) {
      // User is signed in as a different account - sign them out
      // first so the new credentials take effect cleanly.
      await supabase.auth.signOut();
    }
    const { data: auth, error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password: params.password,
    });
    if (signInErr || !auth.user) {
      return { ok: false, error: "invalid_credentials" };
    }
    userId = auth.user.id;
  } else if (!existingUser) {
    return { ok: false, error: "login_required" };
  }

  // 3. Accept the invitation atomically.
  const accept = await acceptInvitationForCurrentUser(token);
  if (!accept.ok) {
    return { ok: false, error: accept.error };
  }

  // 3a. Promote solo journey assignments (from either partner) into the
  //     shared couple ownership - best-effort so pairing never fails
  //     if a journey migration error happens.
  if (userId) {
    try {
      await migrateSoloJourneyToCouple({
        userId,
        coupleId: accept.couple_id,
      });
    } catch (err) {
      console.error("[invite-claim/existing] journey migration failed", err);
    }
  }

  // 4. Refresh the mioshy single-session cookie so this device is the
  //    active session (covers both the "signed in already" and the
  //    "just signed in" branches).
  if (userId) {
    const sessionToken = await createSession(userId, await getDeviceInfo());
    await writeSessionCookie(sessionToken);
  }

  revalidatePath("/[locale]/my", "page");
  revalidatePath("/[locale]/account", "page");
  return { ok: true, couple_id: accept.couple_id };
}
