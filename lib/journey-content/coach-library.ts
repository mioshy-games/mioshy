/**
 * lib/journey-content/coach-library.ts
 *
 * Read-side queries for journey_expert_library. Always scoped to
 * the calling expert via auth.uid() through the session client —
 * the RLS policy enforces this at the DB level.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type CoachLibraryKind = "saved_reply" | "content_pin" | "couple_note";

export interface CoachLibraryEntry {
  id:           string;
  expert_id:    string;
  kind:         CoachLibraryKind;
  label:        string;
  body_he:      string;
  body_en:      string | null;
  tags:         string[];
  couple_id:    string | null;
  use_count:    number;
  last_used_at: string | null;
  created_at:   string;
  updated_at:   string;
}

/**
 * List the current expert's library entries. Optionally filter by
 * kind. Results sorted by use_count DESC then label ASC so the
 * snippets the coach uses most surface first.
 */
export async function listCoachLibrary(
  filter?: { kind?: CoachLibraryKind; coupleId?: string },
): Promise<CoachLibraryEntry[]> {
  const supabase = await createServerSupabaseClient();
  let q = supabase
    .from("journey_expert_library")
    .select("*")
    .order("use_count", { ascending: false })
    .order("label", { ascending: true });

  if (filter?.kind) q = q.eq("kind", filter.kind);
  if (filter?.coupleId) q = q.eq("couple_id", filter.coupleId);

  const { data, error } = await q;
  if (error) {
    console.error("[listCoachLibrary] failed", error);
    return [];
  }
  return (data ?? []) as CoachLibraryEntry[];
}
