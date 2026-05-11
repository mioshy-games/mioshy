/**
 * lib/journey-content/starter-templates.ts
 *
 * Read-side helper for journey_starter_templates (migration 074).
 * Surfaced in /dashboard/coach-library so coaches can see the
 * curated starting templates alongside their own library.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type StarterTemplateKind =
  | "saved_reply"
  | "content_pin"
  | "couple_note"
  | "couple_message"
  | "drift_checkin";

export interface StarterTemplate {
  id:         string;
  kind:       StarterTemplateKind;
  label_he:   string;
  label_en:   string;
  body_he:    string;
  body_en:    string;
  tags:       string[];
  sort_order: number;
}

export async function listStarterTemplates(filter?: {
  kind?: StarterTemplateKind;
}): Promise<StarterTemplate[]> {
  const supabase = await createServerSupabaseClient();
  let q = supabase
    .from("journey_starter_templates")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: false })
    .order("label_he");
  if (filter?.kind) q = q.eq("kind", filter.kind);
  const { data, error } = await q;
  if (error) {
    console.error("[listStarterTemplates] failed", error);
    return [];
  }
  return (data ?? []) as StarterTemplate[];
}
