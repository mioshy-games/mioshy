"use server";

/**
 * lib/journey-content/admin-assessment.ts
 *
 * Server actions used by the admin/clinician to manage the
 * assessment payload of a journey_items row. Phase 3 step 3.
 *
 * Auth: requires admin/expert. Writes go through service-role.
 */

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import type {
  JourneyItemKind,
  JourneyAssessmentPayload,
  JourneyAssessmentQuestion,
} from "@/lib/journey-content/types";

export type AssessmentSaveResult =
  | { ok: true }
  | { ok: false; reason: "unauthorized" | "invalid_input" | "db_error"; message?: string };

const VALID_KINDS: JourneyItemKind[] = ["content", "assessment", "reflection"];
const VALID_QUESTION_KINDS: JourneyAssessmentQuestion["kind"][] = [
  "single_choice",
  "multiple_choice",
  "scale",
  "open_text",
  "ranking",
];

export async function setItemKindAndPayload(args: {
  itemId: string;
  kind: JourneyItemKind;
  /** Pass null for content kind. */
  payload: JourneyAssessmentPayload | null;
}): Promise<AssessmentSaveResult> {
  // Auth gate
  try {
    await requireAdmin();
  } catch {
    return { ok: false, reason: "unauthorized" };
  }

  if (!args.itemId) {
    return { ok: false, reason: "invalid_input", message: "missing itemId" };
  }
  if (!VALID_KINDS.includes(args.kind)) {
    return { ok: false, reason: "invalid_input", message: "invalid kind" };
  }

  // Validate payload shape when present
  let payloadToSave: JourneyAssessmentPayload | null = null;
  if (args.kind !== "content") {
    if (!args.payload) {
      return {
        ok: false,
        reason: "invalid_input",
        message: "payload is required for non-content kind",
      };
    }
    const validation = validatePayload(args.payload);
    if (!validation.ok) {
      return { ok: false, reason: "invalid_input", message: validation.message };
    }
    payloadToSave = args.payload;
  }

  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, reason: "db_error", message: "no service-role client" };

  const { error } = await admin
    .from("journey_items")
    .update({
      kind: args.kind,
      assessment_payload: payloadToSave,
    })
    .eq("id", args.itemId);

  if (error) {
    console.error("[setItemKindAndPayload] update failed", error);
    return { ok: false, reason: "db_error", message: error.message };
  }

  revalidatePath(`/dashboard/journey/items/${args.itemId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────

function validatePayload(payload: JourneyAssessmentPayload): { ok: true } | { ok: false; message: string } {
  if (!payload || typeof payload !== "object") {
    return { ok: false, message: "payload must be an object" };
  }
  if (typeof payload.version !== "number") {
    return { ok: false, message: "payload.version must be a number" };
  }
  if (!Array.isArray(payload.questions)) {
    return { ok: false, message: "payload.questions must be an array" };
  }
  if (payload.questions.length === 0) {
    return { ok: false, message: "payload.questions must contain at least one question" };
  }

  const seenIds = new Set<string>();
  for (const [idx, q] of payload.questions.entries()) {
    if (!q || typeof q !== "object") {
      return { ok: false, message: `question[${idx}] is not an object` };
    }
    if (!q.id || typeof q.id !== "string") {
      return { ok: false, message: `question[${idx}].id is missing` };
    }
    if (seenIds.has(q.id)) {
      return { ok: false, message: `duplicate question id: ${q.id}` };
    }
    seenIds.add(q.id);

    if (!VALID_QUESTION_KINDS.includes(q.kind)) {
      return { ok: false, message: `question[${idx}].kind is invalid: ${q.kind}` };
    }
    if (!q.prompt_he || typeof q.prompt_he !== "string") {
      return { ok: false, message: `question[${idx}].prompt_he is missing` };
    }

    if (q.kind === "single_choice" || q.kind === "multiple_choice" || q.kind === "ranking") {
      if (!Array.isArray(q.options) || q.options.length === 0) {
        return { ok: false, message: `question[${idx}] needs options` };
      }
      const optKeys = new Set<string>();
      for (const [oi, o] of q.options.entries()) {
        if (!o.key || typeof o.key !== "string") {
          return { ok: false, message: `question[${idx}].options[${oi}].key missing` };
        }
        if (optKeys.has(o.key)) {
          return { ok: false, message: `duplicate option key: ${o.key}` };
        }
        optKeys.add(o.key);
        if (!o.label_he || typeof o.label_he !== "string") {
          return { ok: false, message: `question[${idx}].options[${oi}].label_he missing` };
        }
      }
    }

    if (q.kind === "scale") {
      const min = q.scale_min ?? 1;
      const max = q.scale_max ?? 7;
      if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
        return { ok: false, message: `question[${idx}] scale_min/scale_max invalid` };
      }
    }
  }

  return { ok: true };
}
