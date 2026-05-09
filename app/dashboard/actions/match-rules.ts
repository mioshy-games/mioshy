"use server";

/**
 * app/dashboard/actions/match-rules.ts
 *
 * Admin server actions for journey_match_rules.
 *
 * Layer-1 scope: edit copy (label_he/en, rationale_he/en, priority)
 * + toggle is_active. The full DSL builder (when_condition / then_action
 * editing) lands in V2.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase-admin";
import { invalidateRuleCache } from "@/lib/journey-content/match-rules";

type Result<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

const updateRuleSchema = z.object({
  label_he:     z.string().min(1, "label_he required").max(120),
  label_en:     z.string().min(1, "label_en required").max(120),
  rationale_he: z.string().min(1, "rationale_he required").max(500),
  rationale_en: z.string().min(1, "rationale_en required").max(500),
  priority:     z.coerce.number().int().min(0).max(1000),
  is_active:    z.coerce.boolean(),
});

export async function updateMatchRule(
  ruleId: string,
  raw: unknown,
): Promise<Result> {
  await requireAdmin();
  const parsed = updateRuleSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first ? first.message : "Invalid input" };
  }

  const admin = await createAdminClient();
  const { error } = await admin
    .from("journey_match_rules")
    .update({
      label_he:     parsed.data.label_he.trim(),
      label_en:     parsed.data.label_en.trim(),
      rationale_he: parsed.data.rationale_he.trim(),
      rationale_en: parsed.data.rationale_en.trim(),
      priority:     parsed.data.priority,
      is_active:    parsed.data.is_active,
    })
    .eq("id", ruleId);

  if (error) {
    console.error("[updateMatchRule] failed", error);
    return { ok: false, error: error.message };
  }

  invalidateRuleCache();
  revalidatePath("/dashboard/journey/match-rules", "layout");
  return { ok: true };
}

/**
 * Quick toggle for the list view — flips is_active without
 * re-validating the rest of the row.
 */
export async function toggleMatchRuleActive(
  ruleId: string,
  nextActive: boolean,
): Promise<Result> {
  await requireAdmin();
  const admin = await createAdminClient();
  const { error } = await admin
    .from("journey_match_rules")
    .update({ is_active: nextActive })
    .eq("id", ruleId);

  if (error) {
    console.error("[toggleMatchRuleActive] failed", error);
    return { ok: false, error: error.message };
  }
  invalidateRuleCache();
  revalidatePath("/dashboard/journey/match-rules", "layout");
  return { ok: true };
}
