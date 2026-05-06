/**
 * lib/dashboard/recommendations.ts
 *
 * Phase 5 - turns a JourneyUserScore into a small set of bilingual
 * suggestions the clinician sees in the CRM. Pure function, no DB
 * access here.
 *
 * Rules of the road:
 *   - Recommendations are SUGGESTIONS only. They never auto-apply
 *     anything to the user's content. The clinician acts.
 *   - Each rule cites its rationale (which numbers fired it) so the
 *     clinician can sanity-check before doing anything. No black
 *     boxes.
 *   - Severity comes from the rule, not from the user. "crisis" is
 *     always severity 'high'; "low engagement" is always 'medium'.
 *   - Rules don't overlap-deduplicate aggressively - the clinician
 *     gets the full picture and chooses.
 */

import type { JourneyUserScore, UserFlag } from "@/lib/dashboard/user-scoring";

export type RecSeverity = "high" | "medium" | "low";

export interface JourneyRecommendation {
  /** Stable id for analytics / dedup. */
  id: string;
  severity: RecSeverity;
  /** Hebrew label shown in the CRM (Hebrew is the primary clinician
   *  language). */
  title_he: string;
  title_en: string;
  /** Why this rule fired - references the actual numbers so the
   *  clinician can verify. */
  rationale_he: string;
  rationale_en: string;
  /** A short directive for the clinician. NOT for the user. */
  suggestion_he: string;
  suggestion_en: string;
}

export function getUserRecommendations(
  score: JourneyUserScore,
): JourneyRecommendation[] {
  const out: JourneyRecommendation[] = [];

  // ── crisis - explicit, always first if present ──────────────────
  if (hasFlag(score, "crisis")) {
    out.push({
      id: "crisis",
      severity: "high",
      title_he: "סיגנלי דחיפות בתגובות",
      title_en: "Crisis signals detected",
      rationale_he: `מילות מצוקה זוהו ב-${score.crisisKeywordCount} תגובות, סטטוס "concerning" ב-${score.concerningStatusCount}.`,
      rationale_en: `Crisis-keyword tag on ${score.crisisKeywordCount} responses, 'concerning' status on ${score.concerningStatusCount}.`,
      suggestion_he: "מומלץ ליצור קשר ישיר ולעצור הקצאת תוכן חדש עד שיחה.",
      suggestion_en: "Reach out directly. Pause new content assignments until you've spoken.",
    });
  }

  // ── stuck - at least one available item ignored ─────────────────
  if (hasFlag(score, "stuck")) {
    out.push({
      id: "stuck",
      severity: "medium",
      title_he: "פריטים תקועים מעל שבוע",
      title_en: "Items stuck >7 days",
      rationale_he: `יש פריטים פתוחים שלא נענו, כולל לפחות אחד מעל שבוע. השלמה: ${score.totalCompletedItems}/${score.totalItems}.`,
      rationale_en: `At least one available item has been open >7 days without a response. Completion: ${score.totalCompletedItems}/${score.totalItems}.`,
      suggestion_he: "הודעה ישירה קצרה במייל או דרך הצ'אט יכולה להניע. שקלו תוכן קצר יותר בשלב הבא.",
      suggestion_en: "A short direct nudge often gets things moving. Consider lighter content for the next item.",
    });
  }

  // ── non_responsive - has items, no responses at all ─────────────
  if (hasFlag(score, "non_responsive")) {
    out.push({
      id: "non_responsive",
      severity: "medium",
      title_he: "לא הגיב לשום פריט",
      title_en: "No responses on any item",
      rationale_he: `${score.totalItems} פריטים הוקצו, ${score.totalResponses} תגובות נשלחו.`,
      rationale_en: `${score.totalItems} items assigned, ${score.totalResponses} responses received.`,
      suggestion_he: "ייתכן שהמשתמש לא יודע איפה לכתוב. שקלו פנייה ישירה בקישור לפריט אחד.",
      suggestion_en: "User may not know where to type. Consider a direct outreach with a single item link.",
    });
  }

  // ── disengaging - falling response substance ────────────────────
  if (hasFlag(score, "disengaging")) {
    out.push({
      id: "disengaging",
      severity: "medium",
      title_he: "סימני התרחקות מהתהליך",
      title_en: "Showing signs of disengagement",
      rationale_he: "אורך התגובות בשבועיים האחרונים ירד ביותר מ-30% לעומת השבועיים שלפני.",
      rationale_en: "Avg response length in the last 14 days dropped >30% vs the prior 14.",
      suggestion_he: "פנייה אישית קצרה ('איך אתם מרגישים עם התהליך עכשיו?') לפני להוסיף תוכן.",
      suggestion_en: "A check-in question ('how is the process feeling lately?') before assigning more content.",
    });
  }

  // ── overreactive - long + tense ────────────────────────────────
  if (hasFlag(score, "overreactive")) {
    out.push({
      id: "overreactive",
      severity: "medium",
      title_he: "תגובות ארוכות עם טעינה רגשית",
      title_en: "Long, emotionally charged responses",
      rationale_he: `אורך תגובה ממוצע: ${score.avgResponseChars} תווים, conflict_signal: ${(score.conflictSignal ?? 0).toFixed(2)}.`,
      rationale_en: `Avg response chars: ${score.avgResponseChars}, conflict_signal: ${(score.conflictSignal ?? 0).toFixed(2)}.`,
      suggestion_he: "תוכן הבא - תרגיל מובנה עם גבולות ברורים, לא שאלה פתוחה.",
      suggestion_en: "Next content - a structured exercise with clear bounds rather than an open prompt.",
    });
  }

  // ── slow response velocity (without being stuck) ─────────────────
  if (
    !hasFlag(score, "stuck") &&
    !hasFlag(score, "non_responsive") &&
    score.responseVelocity !== null &&
    score.responseVelocity < 0.3 &&
    score.totalResponses >= 2
  ) {
    out.push({
      id: "slow_velocity",
      severity: "low",
      title_he: "קצב תגובה איטי",
      title_en: "Slow response velocity",
      rationale_he: `ממוצע ${score.avgDaysToRespond.toFixed(1)} ימים מהפתיחה ועד התגובה.`,
      rationale_en: `Avg ${score.avgDaysToRespond.toFixed(1)} days from unlock to response.`,
      suggestion_he: "מסלול עם קצב מתון יותר עשוי להתאים - פחות פריטים בשבוע.",
      suggestion_en: "A gentler cadence may fit better - fewer items per week.",
    });
  }

  // ── low depth without other red flags ───────────────────────────
  if (
    !hasFlag(score, "crisis") &&
    !hasFlag(score, "stuck") &&
    !hasFlag(score, "non_responsive") &&
    score.engagementDepth !== null &&
    score.engagementDepth < 0.3 &&
    score.totalResponses >= 3
  ) {
    out.push({
      id: "low_depth",
      severity: "low",
      title_he: "מעורבות שטחית",
      title_en: "Surface-level engagement",
      rationale_he: `engagement_depth: ${score.engagementDepth.toFixed(2)}, ממוצע ${score.avgResponseChars} תווים.`,
      rationale_en: `engagement_depth: ${score.engagementDepth.toFixed(2)}, avg ${score.avgResponseChars} chars.`,
      suggestion_he: "שאלות פתוחות יותר, או אבחון מובנה שיוציא יותר תוכן.",
      suggestion_en: "More open-ended prompts, or a structured assessment to surface depth.",
    });
  }

  // ── highly engaged - positive signal ────────────────────────────
  if (hasFlag(score, "highly_engaged")) {
    out.push({
      id: "highly_engaged",
      severity: "low",
      title_he: "מעורבות גבוהה במיוחד",
      title_en: "Highly engaged",
      rationale_he: `engagement_depth: ${(score.engagementDepth ?? 0).toFixed(2)}, ${score.totalResponses} תגובות.`,
      rationale_en: `engagement_depth: ${(score.engagementDepth ?? 0).toFixed(2)}, ${score.totalResponses} responses.`,
      suggestion_he: "ניתן להאיץ - תוכן עמוק יותר או תרגיל מקדם.",
      suggestion_en: "Safe to accelerate - go deeper or pull in an advanced exercise.",
    });
  }

  // Sort by severity high → low (preserve insertion order within the
  // same severity).
  const order: Record<RecSeverity, number> = { high: 0, medium: 1, low: 2 };
  out.sort((a, b) => order[a.severity] - order[b.severity]);

  return out;
}

function hasFlag(score: JourneyUserScore, flag: UserFlag): boolean {
  return score.flags.includes(flag);
}
