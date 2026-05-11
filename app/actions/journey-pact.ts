"use server";

/**
 * app/actions/journey-pact.ts
 *
 * Layer-1 server action: record the pre-assessment commitment.
 * Idempotent — UPSERT semantics mean re-tapping "I'm in" is safe.
 *
 * Defaults: 10 minutes/week × 4 weeks. Future flexible-duration
 * pacts (8w, 12w) ship in V2; for Layer 1 the values are fixed.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  // Allow override for future flexibility, but the intro screen sends
  // the defaults. Both have safe ranges enforced at the DB level.
  minutesPerWeek: z.coerce.number().int().min(1).max(240).default(10),
  weeks:          z.coerce.number().int().min(1).max(52).default(4),
});

type Result = { ok: true } | { ok: false; error: string };

export async function recordPactCommitment(raw: unknown = {}): Promise<Result> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const supabase = await createServerSupabaseClient();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return { ok: false, error: "auth_required" };
  }

  // Resolve owner: prefer couple if paired, else solo. The pair handler
  // (post-pairing) will UPDATE solo pacts onto the couple — that path
  // is added when the pair flow ships.
  const { data: membership } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const coupleId =
    (membership as { couple_id: string } | null)?.couple_id ?? null;

  const ownerCol = coupleId
    ? { couple_id: coupleId, user_id: null }
    : { couple_id: null, user_id: auth.user.id };

  // Use a manual existence check + insert/update so we honour the
  // partial-unique indexes without colliding on "no conflict target".
  const existsQuery = supabase
    .from("journey_couple_pacts")
    .select("id");
  const { data: existing } = await (coupleId
    ? existsQuery.eq("couple_id", coupleId).maybeSingle()
    : existsQuery.eq("user_id", auth.user.id).maybeSingle());

  if (existing) {
    // Already committed — treat as success (idempotent re-tap).
    return { ok: true };
  }

  const { error } = await supabase
    .from("journey_couple_pacts")
    .insert({
      ...ownerCol,
      committed_minutes_per_week: parsed.data.minutesPerWeek,
      committed_weeks:            parsed.data.weeks,
      agreed_by_user_id:          auth.user.id,
    });

  if (error) {
    console.error("[recordPactCommitment] insert failed", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/[locale]/journey/assessment", "layout");
  revalidatePath("/[locale]/my/journey", "layout");
  return { ok: true };
}
