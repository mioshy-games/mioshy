// ============================================================
// Profile completeness gate
// ============================================================
// Business rule (Itzik, 2026-04-21):
//   * Viewing the storefront is open to anyone.
//   * Any action that creates a shared state (pairing, redeeming
//     a code, purchasing, launching a game) requires the user to
//     have a FULL profile: full_name + mobile, plus an email and a
//     password on their auth account.
//
// We can observe the auth account's email + the presence of a
// password (providers includes "email") from Supabase auth, and
// check full_name + mobile from the `profiles` table.
// ============================================================
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ProfileMissingField =
  | "full_name"
  | "mobile"
  | "email"
  | "password";

export interface ProfileGate {
  user_id: string;
  complete: boolean;
  missing: ProfileMissingField[];
  full_name: string | null;
  mobile: string | null;
  email: string | null;
}

/**
 * Fetch profile + auth signals and decide whether the caller is
 * allowed to take "privileged" actions (pair / redeem / play / buy).
 *
 * Returns `null` when there is no signed-in user — callers should
 * treat that as "login_required" rather than "profile_incomplete".
 */
export async function getProfileGate(): Promise<ProfileGate | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, mobile")
    .eq("id", user.id)
    .maybeSingle();

  const full_name = ((profile?.full_name as string | null) ?? "").trim() || null;
  const mobile = ((profile?.mobile as string | null) ?? "").trim() || null;
  const email = (user.email ?? "").trim() || null;

  // An "email" identity means the account was created with a
  // password. OAuth-only accounts (e.g. Google) won't list it.
  const providers = Array.isArray(user.app_metadata?.providers)
    ? (user.app_metadata!.providers as string[])
    : typeof user.app_metadata?.provider === "string"
      ? [user.app_metadata!.provider as string]
      : [];
  const hasPassword = providers.includes("email");

  const missing: ProfileMissingField[] = [];
  if (!full_name) missing.push("full_name");
  if (!mobile) missing.push("mobile");
  if (!email) missing.push("email");
  if (!hasPassword) missing.push("password");

  return {
    user_id: user.id,
    complete: missing.length === 0,
    missing,
    full_name,
    mobile,
    email,
  };
}

/**
 * Shorthand for server actions: returns `{ ok: false, error: "profile_incomplete" }`
 * when the profile is incomplete. Clients recognise this marker and redirect
 * the user to the profile-completion page.
 */
export async function requireCompleteProfile():
  Promise<
    | { ok: true; gate: ProfileGate }
    | { ok: false; error: "login_required" | "profile_incomplete" }
  > {
  const gate = await getProfileGate();
  if (!gate) return { ok: false, error: "login_required" };
  if (!gate.complete) return { ok: false, error: "profile_incomplete" };
  return { ok: true, gate };
}
