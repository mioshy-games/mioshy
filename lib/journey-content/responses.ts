"use server";

/**
 * lib/journey-content/responses.ts
 *
 * Server action that lets a Journey user post a response to one of
 * their unlocked items. Phase 2B of the redesign - see
 * docs/my-page-redesign-spec.md §21.
 *
 * Hard rules:
 *   - Goes through the SESSION client so RLS enforces ownership.
 *     Migration 035 already lets a user INSERT into
 *     journey_item_responses where user_id = auth.uid().
 *   - Validates input length and trims whitespace. No PII handling
 *     beyond what the user typed.
 *   - Never throws to the client; returns a typed result.
 *
 * Future:
 *   - When the clinician replies (Phase 2C), the user-facing item
 *     view will pull `clinician_reply_text` from the same row and
 *     surface it inline.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { computeResponseTags } from "@/lib/dashboard/auto-tag";

export type SubmitResponseResult =
  | { ok: true; responseId: string }
  | { ok: false; reason: "unauthenticated" | "invalid_input" | "db_error"; message?: string };

const MAX_LEN = 4000;
const MIN_LEN = 1;

export async function submitJourneyResponse(args: {
  scheduledItemId: string;
  responseText: string;
  isPrivate?: boolean;
}): Promise<SubmitResponseResult> {
  const supabase = await createServerSupabaseClient();

  // Auth gate
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, reason: "unauthenticated" };
  }

  // Input validation
  const text = String(args.responseText ?? "").trim();
  const scheduledItemId = String(args.scheduledItemId ?? "").trim();
  if (!scheduledItemId) {
    return { ok: false, reason: "invalid_input", message: "missing scheduled_item_id" };
  }
  if (text.length < MIN_LEN || text.length > MAX_LEN) {
    return {
      ok: false,
      reason: "invalid_input",
      message: `response_text must be between ${MIN_LEN} and ${MAX_LEN} characters`,
    };
  }

  // Phase 4 - deterministic auto-tags so the clinician CRM can
  // filter "needs attention" rows without scanning every row's text.
  const tags = computeResponseTags({
    text,
    isPrivate: args.isPrivate === true,
    hasStructuredAnswer: false, // assessment-actions.ts handles that path
  });

  // Insert. RLS ensures the user can only post on their own assignments.
  const { data, error } = await supabase
    .from("journey_item_responses")
    .insert({
      scheduled_item_id: scheduledItemId,
      user_id: user.id,
      response_text: text,
      is_private: args.isPrivate === true,
      tags,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[submitJourneyResponse] insert failed", {
      scheduled_item_id: scheduledItemId,
      user_id: user.id,
      error: error.message,
      code: (error as { code?: string }).code ?? null,
    });
    return { ok: false, reason: "db_error", message: error.message };
  }

  return { ok: true, responseId: String(data.id) };
}
