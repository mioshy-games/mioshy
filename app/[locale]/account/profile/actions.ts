"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fullNameSchema } from "@/lib/validations";

type Ok<T> = { ok: true } & T;
type Err = { ok: false; error: string };

// Minimal Israeli-friendly mobile validation: 8–15 digits after stripping
// common separators; accepts a leading "+". We don't want to be draconian
// about format - partners around the world will paste all kinds of things.
function normaliseMobile(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  if (!/^\d{8,15}$/.test(digits)) return null;
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export async function saveProfileDetails(input: {
  full_name: string;
  mobile: string;
}): Promise<Ok<object> | Err> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "login_required" };

  const name = input.full_name.trim();
  if (name.length < 2) {
    return { ok: false, error: "Full name is required" };
  }
  // SECURITY: this is the third write path to profiles.full_name, and the most
  // convenient one — no OTP, just an authenticated edit. The name is rendered
  // in the admin dashboard, so markup must be rejected here too.
  // Audit 2026-08-05, CRITICAL #5.
  const nameCheck = fullNameSchema.safeParse(name);
  if (!nameCheck.success) {
    return { ok: false, error: nameCheck.error.issues[0]?.message ?? "שם לא תקין" };
  }
  const mobile = normaliseMobile(input.mobile);
  if (!mobile) {
    return { ok: false, error: "Mobile must be 8–15 digits" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: nameCheck.data, mobile })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/[locale]/account/profile", "page");
  revalidatePath("/[locale]/between-us", "page");
  revalidatePath("/[locale]/between-us/[slug]", "page");
  revalidatePath("/[locale]/my", "page");

  return { ok: true };
}

/**
 * Set or change the account password. Used by the profile-gate flow for
 * OAuth-only accounts that were missing the email/password identity.
 */
export async function setAccountPassword(newPassword: string):
  Promise<Ok<object> | Err> {
  if (!newPassword || newPassword.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters" };
  }
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "login_required" };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
