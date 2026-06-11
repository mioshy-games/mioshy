/**
 * lib/assessments/questions-db.ts
 *
 * Loads an assessment's questions from the DB (assessment_questions), with a
 * fallback to the static bank (lib/assessments/banks/*) when the table is empty
 * for that assessment — so the flow keeps working before migration 109 runs.
 *
 * Dimensions stay structural in code (catalog); each row references its
 * dimension by `dimension_key`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAssessment } from "./catalog";
import type { AssessmentQuestion } from "./types";

interface QuestionRow {
  slug: string;
  position: number;
  dimension_key: string | null;
  type: "likert5" | "reflection";
  reverse: boolean;
  is_open: boolean;
  text_he: string;
  text_en: string;
}

function rowToQuestion(r: QuestionRow): AssessmentQuestion {
  if (r.type === "reflection") {
    return {
      id: r.slug,
      category: "free",
      type: "reflection",
      domain: null,
      axes: [],
      purpose: "",
      isOpen: true,
      max_length: 600,
      he_prompt: r.text_he,
      en_prompt: r.text_en,
    };
  }
  return {
    id: r.slug,
    category: "free",
    type: "likert5",
    domain: null,
    axes: [],
    purpose: "",
    dimension: r.dimension_key ?? "",
    reverse: !!r.reverse,
    he: r.text_he,
    en: r.text_en,
  };
}

export async function loadAssessmentQuestions(
  client: SupabaseClient,
  assessmentId: string,
): Promise<AssessmentQuestion[]> {
  const def = getAssessment(assessmentId);
  try {
    const { data, error } = await client
      .from("assessment_questions")
      .select("slug, position, dimension_key, type, reverse, is_open, text_he, text_en")
      .eq("assessment_id", assessmentId)
      .eq("is_active", true)
      .order("position", { ascending: true });
    if (error) {
      console.warn("[assessments/questions-db] load error, falling back to static", error.message);
    } else if (data && data.length > 0) {
      return (data as QuestionRow[]).map(rowToQuestion);
    }
  } catch (e) {
    console.warn("[assessments/questions-db] threw, falling back to static", e);
  }
  return def?.questions ?? [];
}
