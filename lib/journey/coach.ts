/**
 * lib/journey/coach.ts
 *
 * Layer-2 helper: resolve the coach persona for a user.
 *
 * Lookup chain:
 *   1. user → couple via couple_members
 *   2. couple → active expert via expert_couples
 *   3. expert → persona via profiles.coach_*
 *
 * Returns null at any break (user has no couple / no expert assigned /
 * persona not set yet). Callers must render a generic fallback in
 * that case — never assume non-null.
 */

import { cache } from "react";

import { createServiceRoleClient } from "@/lib/supabase-admin";
import {
  DEFAULT_COACH_CAMEL,
  resolveDefaultCoach,
} from "@/lib/journey/default-coach";

export interface CoachPersona {
  expertId:        string;
  displayNameHe:   string | null;
  displayNameEn:   string | null;
  avatarUrl:       string | null;
  shortBioHe:      string | null;
  shortBioEn:      string | null;
}

/**
 * Returns the coach persona for a user. Resolution order:
 *   1. Real coach linked to the user's couple via expert_couples.
 *      Any field the coach left empty falls back to the default.
 *   2. The "default coach" row from profiles (is_default_coach=true) —
 *      reflects whatever Itzik edited at /dashboard/coach-profile.
 *   3. The hardcoded Yitzhak constant in default-coach.ts (last resort
 *      when the DB has no default flagged or is unreachable).
 *
 * The trigger from migration 081 auto-links every new couple to the
 * default coach, so step 1 will normally hit. Steps 2-3 catch the
 * race where a user has no couple yet (signup flow) or the link
 * hasn't been created.
 */
// 2026-05-31 — wrapped in React.cache so getShellData + any per-page
// caller in the same request share one resolution (3 admin reads each).
export const getCoachPersonaForUser = cache(_getCoachPersonaForUser);

async function _getCoachPersonaForUser(
  userId: string,
): Promise<CoachPersona> {
  const admin = createServiceRoleClient();
  if (!admin) return resolveDefaultCoach();

  // 1. Find the user's couple (if any).
  const { data: membership } = await admin
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", userId)
    .maybeSingle();

  const coupleId = (membership as { couple_id: string } | null)?.couple_id;
  if (!coupleId) return resolveDefaultCoach();

  // 2. Find the assigned active expert for this couple.
  // expert_couples may have multiple historical rows; we want the
  // currently active one.
  const { data: link } = await admin
    .from("expert_couples")
    .select("expert_id")
    .eq("couple_id", coupleId)
    .eq("is_active", true)
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const expertId = (link as { expert_id: string } | null)?.expert_id;
  if (!expertId) return resolveDefaultCoach();

  // 3. Fetch the persona.
  const { data: persona } = await admin
    .from("profiles")
    .select(
      "id, coach_display_name_he, coach_display_name_en, coach_avatar_url, coach_short_bio_he, coach_short_bio_en",
    )
    .eq("id", expertId)
    .maybeSingle();

  if (!persona) {
    const fallback = await resolveDefaultCoach();
    return { ...fallback, expertId };
  }

  const p = persona as {
    id: string;
    coach_display_name_he: string | null;
    coach_display_name_en: string | null;
    coach_avatar_url:      string | null;
    coach_short_bio_he:    string | null;
    coach_short_bio_en:    string | null;
  };

  // Fill any missing field with the Yitzhak default so the UI always
  // has a name + avatar + bio. Real expertId is preserved for deep-links.
  return {
    expertId:      p.id,
    displayNameHe: p.coach_display_name_he?.trim() || DEFAULT_COACH_CAMEL.displayNameHe,
    displayNameEn: p.coach_display_name_en?.trim() || DEFAULT_COACH_CAMEL.displayNameEn,
    avatarUrl:     p.coach_avatar_url?.trim()      || DEFAULT_COACH_CAMEL.avatarUrl,
    shortBioHe:    p.coach_short_bio_he?.trim()    || DEFAULT_COACH_CAMEL.shortBioHe,
    shortBioEn:    p.coach_short_bio_en?.trim()    || DEFAULT_COACH_CAMEL.shortBioEn,
  };
}
