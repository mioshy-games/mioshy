"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";

// The three eligible packages (spec A3). games has no coaching add-on.
const trialRowSchema = z.object({
  product: z.enum(["games", "journey"]),
  coaching: z.boolean(),
  enabled: z.boolean(),
});
const trialSettingsSchema = z.object({
  rows: z.array(trialRowSchema).min(1).max(3),
});

export type TrialSettingsFormValues = z.infer<typeof trialSettingsSchema>;
export type SaveTrialResult =
  | { ok: true }
  | { ok: false; error: Record<string, string[] | undefined> };

/**
 * Save the per-(product, coaching) 7-day-trial toggles. One row per eligible
 * package. Writes go through the admin-authed client so the trial_settings
 * is_admin() RLS applies (migration 157). requireAdmin() stays OUTSIDE the
 * try because it may redirect (NEXT_REDIRECT control-flow throw).
 */
export async function saveTrialSettings(raw: unknown): Promise<SaveTrialResult> {
  const parsed = trialSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors };
  }
  const v = parsed.data;

  // Defensive: games can never carry coaching (matches the DB CHECK).
  for (const r of v.rows) {
    if (r.product === "games" && r.coaching) {
      return { ok: false, error: { _root: ["games has no coaching add-on"] } };
    }
  }

  const { supabase, user } = await requireAdmin();

  try {
    const { error } = await supabase.from("trial_settings").upsert(
      v.rows.map((r) => ({
        product: r.product,
        coaching: r.coaching,
        enabled: r.enabled,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })),
      { onConflict: "product,coaching" },
    );
    if (error) {
      return { ok: false, error: { _root: [error.message] } };
    }
    revalidatePath("/dashboard/settings/trial");
    // The trial CTA shows on marketing/paywall surfaces — revalidate broadly.
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "שגיאה לא צפויה בשמירה";
    return { ok: false, error: { _root: [message] } };
  }
}

const promoModeSchema = z.object({
  promo_mode: z.enum(["off", "personal_window", "campaign_timer"]),
  // Personal-window config (migration 184) — optional so 'off' / 'campaign_timer'
  // saves keep working without these columns present.
  personal_window_hours: z.coerce.number().int().min(1).max(720).optional(),
  personal_window_display: z.enum(["text", "clock"]).optional(),
});

/**
 * Save the urgency mode (task 20) to site_settings.promo_mode. One active mode
 * at a time; drives the server-enforced price gate + the indicator system.
 * In personal_window mode it also persists the admin-chosen window length +
 * display (migration 184).
 */
export async function savePromoMode(raw: unknown): Promise<SaveTrialResult> {
  const parsed = promoModeSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors };
  }
  const { supabase } = await requireAdmin();
  try {
    const update: Record<string, unknown> = { promo_mode: parsed.data.promo_mode };
    if (parsed.data.personal_window_hours !== undefined) {
      update.personal_window_hours = parsed.data.personal_window_hours;
    }
    if (parsed.data.personal_window_display !== undefined) {
      update.personal_window_display = parsed.data.personal_window_display;
    }
    const { error } = await supabase
      .from("site_settings")
      .update(update)
      .eq("id", 1);
    if (error) return { ok: false, error: { _root: [error.message] } };
    revalidatePath("/dashboard/settings/trial");
    // Urgency mode affects pricing display on marketing + results.
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "שגיאה לא צפויה בשמירה";
    return { ok: false, error: { _root: [message] } };
  }
}
