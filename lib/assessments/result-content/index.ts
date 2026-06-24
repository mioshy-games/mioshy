/**
 * lib/assessments/result-content/index.ts
 *
 * Per-assessment results copy + per-dimension FEEDBACK, grounded in the Hebrew
 * content items (book/items-cleaned.csv). Drives the results-page summary so
 * each assessment gives the couple real feedback on what they answered (not a
 * generic page) and its own tailored marketing copy.
 *
 * Text lives in code for now (v1); can move to CMS/DB later like the questions.
 */

export interface DimensionFeedback {
  strong_he: string;
  strong_en: string;
  weak_he: string;
  weak_en: string;
}

export interface AssessmentResultContent {
  /** Score (0..100) below which a dimension is treated as "needs work". */
  weakBelow: number;
  /** Feedback per dimension key. */
  feedback: Record<string, DimensionFeedback>;
  copy: {
    feedbackLabel_he: string;  feedbackLabel_en: string;
    feedbackTitle_he: string;  feedbackTitle_en: string;
    startHerePrefix_he: string; startHerePrefix_en: string;
    gainsTitle_he: string;     gainsTitle_en: string;
    gains_he: string[];        gains_en: string[];
    expertTitle_he: string;    expertTitle_en: string;
    expertBody_he: string;     expertBody_en: string;
    offerTitle_he: string;     offerTitle_en: string;
    offerSub_he: string;       offerSub_en: string;
    /** Complete, natural-Hebrew hero sentence shown when AI is unavailable.
     *  No placeholders — it must read cleanly on its own. */
    fallbackHero_he: string;   fallbackHero_en: string;
    priceOriginal_he: string;  priceOriginal_en: string;
    priceAmount_he: string;    priceAmount_en: string;
    pricePeriod_he: string;    pricePeriod_en: string;
    reassurance_he: string;    reassurance_en: string;
    cta_he: string;            cta_en: string;
  };
}

import { INTIMACY_RESULT_CONTENT } from "./intimacy";
import { FRIENDSHIP_RESULT_CONTENT } from "./friendship";
import { stripEmDashDeep } from "@/lib/text/sanitize-dashes";

const REGISTRY: Record<string, AssessmentResultContent> = {
  intimacy: INTIMACY_RESULT_CONTENT,
  friendship: FRIENDSHIP_RESULT_CONTENT,
};

export function getResultContent(assessmentId: string): AssessmentResultContent | null {
  const content = REGISTRY[assessmentId];
  if (!content) return null;
  // Display-layer em-dash sanitiser over the whole copy tree (the source
  // constant is left untouched). Idempotent; en-dash ranges preserved.
  return stripEmDashDeep(content);
}
