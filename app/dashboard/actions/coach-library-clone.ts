"use server";

/**
 * app/dashboard/actions/coach-library-clone.ts
 *
 * Layer-3 follow-up: clone a curated starter template into the
 * current coach's personal library so they can edit + use it.
 *
 * Starter templates live in journey_starter_templates (system-
 * wide). The coach's editable copies live in journey_expert_library.
 * This action handles the copy.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireExpert } from "@/lib/auth/expert";
import { createAdminClient } from "@/lib/supabase-admin";

const schema = z.object({
  templateId: z.string().uuid(),
});

type Result = { ok: true; libraryId: string } | { ok: false; error: string };

export async function cloneStarterTemplateToLibrary(
  raw: unknown,
): Promise<Result> {
  const session = await requireExpert();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const admin = await createAdminClient();
  const { data: template } = await admin
    .from("journey_starter_templates")
    .select("kind, label_he, label_en, body_he, body_en, tags")
    .eq("id", parsed.data.templateId)
    .eq("is_active", true)
    .maybeSingle();

  if (!template) return { ok: false, error: "template_not_found" };
  const t = template as {
    kind:     string;
    label_he: string;
    label_en: string;
    body_he:  string;
    body_en:  string;
    tags:     string[];
  };

  // Map starter kinds onto library kinds. 'drift_checkin' isn't a
  // library kind; map it to 'saved_reply' since coaches use it that
  // way (paste into channel compose).
  const libraryKind =
    t.kind === "drift_checkin" ? "saved_reply" : (t.kind as
      | "saved_reply"
      | "content_pin"
      | "couple_note"
      | "couple_message");

  const { data, error } = await admin
    .from("journey_expert_library")
    .insert({
      expert_id: session.user.id,
      kind:      libraryKind,
      label:     t.label_he,
      body_he:   t.body_he,
      body_en:   t.body_en,
      tags:      t.tags,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "insert_failed" };
  }

  revalidatePath("/dashboard/coach-library");
  return { ok: true, libraryId: (data as { id: string }).id };
}
