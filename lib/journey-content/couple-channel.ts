/**
 * lib/journey-content/couple-channel.ts
 *
 * Read-side queries for the Layer-5 shared couple channel.
 * Mirrors the messages API in spirit but couple-scoped.
 *
 * Privacy semantics: a couple-channel message is BY DEFINITION
 * shared between the two partners + assigned experts. There's no
 * is_private flag on this table (that exists on the per-user
 * channel for solo notes to the expert).
 */

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import type { CoachPersona } from "./messages";
import {
  DEFAULT_COACH_SNAKE,
  snakePersonaWithFallback,
} from "@/lib/journey/default-coach";

export type CoupleAuthorKind = "partner" | "expert" | "system";

export interface CoupleChannelMessage {
  id:                string;
  couple_id:         string;
  author_user_id:    string | null;
  author_kind:       CoupleAuthorKind;
  expert_signed_by:  string | null;
  body:              string;
  reactions:         Record<string, string[]>;
  created_at:        string;
  edited_at:         string | null;
  /** Resolved coach persona for expert messages (null otherwise). */
  expert_persona:    CoachPersona | null;
}

export async function getCoupleChannelThread(
  coupleId: string,
): Promise<CoupleChannelMessage[]> {
  const admin = createServiceRoleClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from("journey_couple_channel_messages")
    .select("*")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[couple-channel.getCoupleChannelThread]", error);
    return [];
  }

  const rows = (data ?? []) as Array<Omit<CoupleChannelMessage, "expert_persona">>;
  return await attachCouplePersonas(admin, rows);
}

async function attachCouplePersonas(
  admin: ReturnType<typeof createServiceRoleClient>,
  rows: Array<Omit<CoupleChannelMessage, "expert_persona">>,
): Promise<CoupleChannelMessage[]> {
  if (!admin || rows.length === 0) {
    return rows.map((m) => ({ ...m, expert_persona: null }));
  }

  const ids = Array.from(
    new Set(
      rows
        .map((m) => m.expert_signed_by)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  if (ids.length === 0) {
    return rows.map((m) => ({ ...m, expert_persona: null }));
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select(
      "id, coach_display_name_he, coach_display_name_en, coach_avatar_url, coach_short_bio_he, coach_short_bio_en",
    )
    .in("id", ids);

  const byId = new Map<string, CoachPersona>(
    ((profiles ?? []) as Array<{
      id: string;
      coach_display_name_he: string | null;
      coach_display_name_en: string | null;
      coach_avatar_url:      string | null;
      coach_short_bio_he:    string | null;
      coach_short_bio_en:    string | null;
    }>).map((p) => [
      p.id,
      // Same Yitzhak-default substitution as the per-item channel —
      // see lib/journey-content/messages.ts for the rationale.
      snakePersonaWithFallback(p.id, {
        coach_display_name_he: p.coach_display_name_he,
        coach_display_name_en: p.coach_display_name_en,
        coach_avatar_url:      p.coach_avatar_url,
        coach_short_bio_he:    p.coach_short_bio_he,
        coach_short_bio_en:    p.coach_short_bio_en,
      }),
    ]),
  );

  return rows.map((m) => ({
    ...m,
    expert_persona: m.expert_signed_by
      ? byId.get(m.expert_signed_by) ?? DEFAULT_COACH_SNAKE
      : null,
  }));
}

/**
 * Channel-ensure helper. Idempotent. Called from the action layer
 * when a coach posts the first time, or when the user opens
 * /my/journey/together.
 */
export async function ensureCoupleChannel(coupleId: string): Promise<void> {
  const admin = createServiceRoleClient();
  if (!admin) return;
  await admin
    .from("journey_couple_channels")
    .upsert(
      { couple_id: coupleId },
      { onConflict: "couple_id", ignoreDuplicates: true },
    );
}
