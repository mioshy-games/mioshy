/**
 * lib/dashboard/assessment-answers.ts
 *
 * B.5 (work-order 2026-06-15) — gather ALL of a user's journey-assessment
 * answers (the short pre-purchase set AND the full/long set) into one readable
 * structure for the expert to review in the admin (/dashboard/users/[id]).
 *
 * The answers are already persisted in public.journey_responses (the live flow
 * upserts every answer). The gap this fills is presentation: the admin page used
 * to load only the LATEST journey's raw responses with no short/full split. Here
 * we load EVERY journey for the user, classify each answer by phase via
 * public.journey_questions.phase, label it with the question text, and render the
 * stored answer value as human-readable text — deduped to the most recent answer
 * per question so the expert reads the user's current picture, not re-run noise.
 *
 * Question text + option labels come from the editable DB table
 * (journey_questions, migrations 117/118); we fall back to the bundled
 * questionnaire.json (STATIC_QUESTIONS) when the table is empty/errors, exactly
 * like lib/journey/questions-db.ts. JSON fallback carries no phase, so those land
 * in the "other" bucket.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { QUESTIONS as STATIC_QUESTIONS, likertLabel } from "@/lib/journey/questions";
import type { QuestionOption, QuestionRankingCategory } from "@/lib/journey/types";

export type AssessmentPhase = "short" | "full" | "other";

/** One question's metadata, resolved from the DB (or JSON fallback). */
interface QuestionMeta {
  phase: AssessmentPhase;
  position: number;
  type: string;
  he_text: string;
  en_text: string;
  options: QuestionOption[];
  categories: QuestionRankingCategory[];
}

export interface AssessmentAnswerItem {
  questionId: string;
  position: number;
  /** Question prompt in the answer's own locale. */
  prompt: string;
  /** Human-readable rendering of the stored answer value. */
  answerText: string;
  locale: "he" | "en";
  answeredAt: string;
}

export interface AssessmentAnswersGroup {
  phase: AssessmentPhase;
  items: AssessmentAnswerItem[];
}

export interface UserAssessmentAnswers {
  /** Phase groups in display order: short, full, then any unclassified. */
  groups: AssessmentAnswersGroup[];
  total: number;
  /** How many journey rows the answers were gathered from. */
  journeyCount: number;
  /** Where the question metadata resolved from. */
  source: "db" | "json";
}

interface RawResponse {
  journey_id: string;
  question_id: string;
  answer: unknown;
  locale: string | null;
  created_at: string;
}

/** Build the slug→metadata map from the editable DB table. */
async function loadQuestionMeta(
  client: SupabaseClient,
): Promise<{ map: Map<string, QuestionMeta>; source: "db" | "json" }> {
  try {
    const { data, error } = await client
      .from("journey_questions")
      .select("slug, phase, position, type, he_text, en_text, options, meta")
      .eq("is_active", true);
    if (!error && data && data.length > 0) {
      const map = new Map<string, QuestionMeta>();
      for (const r of data as Array<{
        slug: string;
        phase: "short" | "full";
        position: number;
        type: string;
        he_text: string | null;
        en_text: string | null;
        options: QuestionOption[] | null;
        meta: { categories?: QuestionRankingCategory[] } | null;
      }>) {
        map.set(r.slug, {
          phase: r.phase === "short" || r.phase === "full" ? r.phase : "other",
          position: r.position ?? 0,
          type: r.type,
          he_text: r.he_text ?? "",
          en_text: r.en_text ?? "",
          options: r.options ?? [],
          categories: r.meta?.categories ?? [],
        });
      }
      return { map, source: "db" };
    }
  } catch {
    // fall through to JSON
  }

  // JSON fallback — no phase info, so everything lands in "other".
  const map = new Map<string, QuestionMeta>();
  STATIC_QUESTIONS.forEach((q, i) => {
    let he_text = "";
    let en_text = "";
    let options: QuestionOption[] = [];
    let categories: QuestionRankingCategory[] = [];
    if (q.type === "likert5") {
      he_text = q.he;
      en_text = q.en;
    } else {
      he_text = q.he_prompt;
      en_text = q.en_prompt;
    }
    if (
      q.type === "forced_choice" ||
      q.type === "single_choice" ||
      q.type === "multi_choice"
    ) {
      options = q.options;
    }
    if (q.type === "ranking") {
      categories = q.categories;
    }
    map.set(q.id, {
      phase: "other",
      position: i,
      type: q.type,
      he_text,
      en_text,
      options,
      categories,
    });
  });
  return { map, source: "json" };
}

/** Render a stored journey_responses.answer value as readable text. */
function formatAnswer(
  answer: unknown,
  meta: QuestionMeta | undefined,
  locale: "he" | "en",
): string {
  const a = answer as {
    kind?: string;
    value?: number;
    option?: string;
    options?: string[];
    text?: string;
    order?: string[];
  };

  if (a?.kind === "likert" || typeof a?.value === "number") {
    const v = a.value;
    if (v && v >= 1 && v <= 5) {
      return `${likertLabel(v as 1 | 2 | 3 | 4 | 5, locale)} (${v}/5)`;
    }
    return `${v ?? "-"}/5`;
  }

  const optLabel = (id: string): string => {
    const opt = meta?.options.find((o) => o.id === id);
    return opt ? (locale === "he" ? opt.he : opt.en) : id;
  };

  if (a?.kind === "single" && a.option) return optLabel(a.option);
  if (a?.kind === "multi" && Array.isArray(a.options)) {
    return a.options.map(optLabel).join(", ");
  }
  if (a?.kind === "text") return a.text?.trim() ? a.text : "—";
  if (a?.kind === "ranking" && Array.isArray(a.order)) {
    return a.order
      .map((id, i) => {
        const cat = meta?.categories.find((c) => c.key === id);
        const label = cat ? (locale === "he" ? cat.he : cat.en) : id;
        return `${i + 1}. ${label}`;
      })
      .join("  ·  ");
  }
  return JSON.stringify(answer);
}

const PHASE_ORDER: AssessmentPhase[] = ["short", "full", "other"];

/**
 * Load every journey-assessment answer for a user, grouped by phase and ready
 * to render. Deduped to the most recent answer per question (within its phase).
 */
export async function loadUserAssessmentAnswers(
  client: SupabaseClient,
  userId: string,
): Promise<UserAssessmentAnswers> {
  const { data: journeys } = await client
    .from("journeys")
    .select("id")
    .eq("user_id", userId);

  const journeyIds = (journeys ?? []).map((j) => j.id as string);
  if (journeyIds.length === 0) {
    return { groups: [], total: 0, journeyCount: 0, source: "json" };
  }

  const [{ data: rows }, { map: metaMap, source }] = await Promise.all([
    client
      .from("journey_responses")
      .select("journey_id, question_id, answer, locale, created_at")
      .in("journey_id", journeyIds)
      .order("created_at", { ascending: true }),
    loadQuestionMeta(client),
  ]);

  // Dedup to the latest answer per question (rows are ascending by date, so a
  // later row overwrites an earlier one for the same question_id).
  const latest = new Map<string, RawResponse>();
  for (const r of (rows ?? []) as RawResponse[]) {
    latest.set(r.question_id, r);
  }

  const byPhase = new Map<AssessmentPhase, AssessmentAnswerItem[]>();
  for (const r of latest.values()) {
    const meta = metaMap.get(r.question_id);
    const locale: "he" | "en" = r.locale === "en" ? "en" : "he";
    const phase: AssessmentPhase = meta?.phase ?? "other";
    const prompt =
      (locale === "he" ? meta?.he_text : meta?.en_text) || r.question_id;
    const item: AssessmentAnswerItem = {
      questionId: r.question_id,
      position: meta?.position ?? 9999,
      prompt,
      answerText: formatAnswer(r.answer, meta, locale),
      locale,
      answeredAt: r.created_at,
    };
    const arr = byPhase.get(phase) ?? [];
    arr.push(item);
    byPhase.set(phase, arr);
  }

  const groups: AssessmentAnswersGroup[] = [];
  let total = 0;
  for (const phase of PHASE_ORDER) {
    const items = byPhase.get(phase);
    if (!items || items.length === 0) continue;
    items.sort((a, b) => a.position - b.position);
    total += items.length;
    groups.push({ phase, items });
  }

  return { groups, total, journeyCount: journeyIds.length, source };
}
