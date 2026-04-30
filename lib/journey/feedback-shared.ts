/**
 * lib/journey/feedback-shared.ts
 *
 * Types + constants for the clinical-feedback layer that are SAFE
 * to import from BOTH server and client components.
 *
 * Why this file exists separately from feedback.ts:
 *
 *   feedback.ts contains server-only query helpers that import
 *   `next/headers` and the service-role Supabase client. Next.js
 *   refuses to compile a client component if any transitive import
 *   pulls those in. Earlier this exact mistake broke the production
 *   build with:
 *
 *     "You're importing a component that needs next/headers. That
 *      only works in a Server Component …"
 *
 *   By extracting the pure types/constants here, client components
 *   like FeedbackFilterBar / FeedbackForm / FeedbackList can import
 *   what they need without dragging in any server-side machinery.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type FeedbackSeverity =
  | "observation"
  | "insight"
  | "concern"
  | "urgent";

export const FEEDBACK_SEVERITIES: readonly FeedbackSeverity[] = [
  "observation",
  "insight",
  "concern",
  "urgent",
] as const;

export const SEVERITY_LABEL_HE: Record<FeedbackSeverity, string> = {
  observation: "תצפית",
  insight: "תובנה",
  concern: "נקודה לתשומת לב",
  urgent: "דחוף",
};

export const SEVERITY_LABEL_EN: Record<FeedbackSeverity, string> = {
  observation: "Observation",
  insight: "Insight",
  concern: "Concern",
  urgent: "Urgent",
};

export const SEVERITY_TONE: Record<
  FeedbackSeverity,
  { bg: string; text: string; ring: string }
> = {
  observation: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    ring: "ring-slate-200",
  },
  insight: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    ring: "ring-emerald-200",
  },
  concern: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    ring: "ring-amber-200",
  },
  urgent: {
    bg: "bg-rose-50",
    text: "text-rose-800",
    ring: "ring-rose-200",
  },
};

/** Row shape as returned from the journey_feedback table itself. */
export interface JourneyFeedbackRow {
  id: string;
  user_id: string | null;
  couple_id: string | null;
  category_id: string | null;
  item_id: string | null;
  question_id: string | null;
  short_summary: string;
  extended_text: string | null;
  severity: FeedbackSeverity;
  admin_author_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Row + the joined human-readable bits the admin UI actually wants. */
export interface JourneyFeedbackHydrated extends JourneyFeedbackRow {
  category_label?: string | null;
  item_label?: string | null;
  subject_user_email?: string | null;
  subject_user_display?: string | null;
  author_email?: string | null;
}

export interface FeedbackFilter {
  coupleId?: string;
  userId?: string;
  categoryId?: string;
  itemId?: string;
  questionId?: string;
  severity?: FeedbackSeverity;
  q?: string;
  page?: number;
  pageSize?: number;
}
