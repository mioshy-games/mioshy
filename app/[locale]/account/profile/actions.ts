"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
  /** WhatsApp opt-in toggle. Omitted = leave consent untouched. */
  whatsapp_opt_in?: boolean;
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
  const mobile = normaliseMobile(input.mobile);
  if (!mobile) {
    return { ok: false, error: "Mobile must be 8–15 digits" };
  }

  const update: Record<string, unknown> = { full_name: name, mobile };
  // WhatsApp consent (stage 2). Only touched when the field is provided.
  // Opting in records when + source and clears any prior opt-out (re-consent).
  if (typeof input.whatsapp_opt_in === "boolean") {
    if (input.whatsapp_opt_in) {
      update.whatsapp_opt_in = true;
      update.whatsapp_opt_in_at = new Date().toISOString();
      update.whatsapp_opt_in_source = "profile";
      update.whatsapp_opt_out_at = null;
    } else {
      update.whatsapp_opt_in = false;
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update(update)
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
