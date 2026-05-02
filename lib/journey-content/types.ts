// ============================================================
// TypeScript types for the Journey Content System.
// Mirrors the schema defined in supabase/migrations/035_journey_content_system.sql.
//
// Design context: docs/journey-content-system-design.md (Revision 2).
// This is intentionally a separate namespace from `lib/journey/` which
// powers the questionnaire/analysis product.
// ============================================================

export type AnchorKind = "assignment" | "purchase" | "fixed";
export type AssignmentOrigin = "admin_manual" | "purchase" | "trigger";
/** v3 slice 3 / migration 058 added 'cadence' for the per-user engine
 *  container. Every legacy v2 surface still ignores 'cadence' rows; only
 *  v3 paths (cadence engine, /my/journey merge, admin couple rollup)
 *  consume them. */
export type AssignmentSourceKind = "program" | "category" | "item" | "cadence";

/**
 * Display status derived from unlock_at + completion row.
 *   locked    - unlock_at > now
 *   available - unlock_at <= now and not completed
 *   completed - has a row in journey_item_completions
 */
export type ScheduledItemStatus = "locked" | "available" | "completed";

// ------------------------------------------------------------
// Row shapes (as returned from Supabase)
// ------------------------------------------------------------

/**
 * Product pillar a program is tied to for post-purchase automation.
 * NULL = program is not automation-eligible (admin-only manual assign).
 * Matches subscriptions.product values defined in migration 032.
 */
export type JourneyProductSlug = "games" | "journey" | "adults";

export interface JourneyProgram {
  id: string;
  slug: string;
  name_he: string;
  name_en: string | null;
  description_he: string | null;
  description_en: string | null;
  cover_image_url: string | null;
  default_anchor: AnchorKind;
  product_slug: JourneyProductSlug | null;
  is_active: boolean;
  sort_weight: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface JourneyCategory {
  id: string;
  program_id: string | null;
  slug: string;
  name_he: string;
  name_en: string | null;
  description_he: string | null;
  description_en: string | null;
  sort_order: number;
  is_active: boolean;
  /** v3 slice 1 / migration 055: links a category to one of the seeded
   *  q_priorities keys (communication / intimacy / emotional_connection /
   *  friendship / family). NULL for any non-priority category. */
  assessment_priority_key?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * v3 slice 7 / migration 054: per-binding mode for group ↔ subtopic.
 *   replace    — auto-cadence skips items in this subtopic for group
 *                members; admin pushes are the only way items reach
 *                the user from this subtopic.
 *   interleave — auto-cadence picks normally from this subtopic;
 *                admin pushes ALSO surface (additive). Slice 7 wires
 *                the cadence-side filter; the additive admin-push
 *                lands in slice 8.
 */
export type JourneyGroupBindingMode = "replace" | "interleave";

export interface JourneyGroup {
  id: string;
  slug: string;
  label_he: string;
  label_en: string | null;
  description_he: string | null;
  description_en: string | null;
  curated_per_week_override: number | null;
  random_per_week_override: number | null;
  priority_weights_override: number[] | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface JourneyGroupMember {
  group_id: string;
  user_id: string;
  added_by: string | null;
  added_at: string;
}

export interface JourneyGroupSubtopicBinding {
  group_id: string;
  subtopic_id: string;
  mode: JourneyGroupBindingMode;
  sort_weight: number;
  created_at: string;
}

/**
 * v3 slice 1 / migration 054: a tier between category and item. Items
 * either belong to a subtopic (subtopic_id NOT NULL on journey_items)
 * or hang directly off the category (subtopic_id NULL).
 */
export interface JourneySubtopic {
  id: string;
  category_id: string;
  slug: string;
  name_he: string;
  name_en: string | null;
  description_he: string | null;
  description_en: string | null;
  sort_order: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type JourneyAudience = "both" | "owner" | "partner";

/**
 * Migration 050 — discriminator for items that aren't plain content:
 *   - 'content'    → the original kind (articles / exercises / video)
 *   - 'assessment' → a structured questionnaire the user fills in
 *   - 'reflection' → a single open-ended prompt
 *
 * For 'assessment' / 'reflection' items, `assessment_payload` carries
 * the question schema. The user-side response goes through
 * `journey_item_responses.structured_answer` (also added in 050).
 */
export type JourneyItemKind = "content" | "assessment" | "reflection";

export type JourneyAssessmentQuestionKind =
  | "single_choice"
  | "multiple_choice"
  | "scale"
  | "open_text"
  | "ranking";

export interface JourneyAssessmentQuestion {
  id: string;
  kind: JourneyAssessmentQuestionKind;
  prompt_he: string;
  prompt_en?: string | null;
  required?: boolean;
  /** For choice/ranking kinds. */
  options?: Array<{
    key: string;
    label_he: string;
    label_en?: string | null;
  }>;
  /** For scale kind. */
  scale_min?: number;
  scale_max?: number;
  scale_min_label_he?: string | null;
  scale_max_label_he?: string | null;
  scale_min_label_en?: string | null;
  scale_max_label_en?: string | null;
  /** Optional partner-targeting per question. Defaults to the item's
   *  audience when omitted. */
  audience?: JourneyAudience;
}

export interface JourneyAssessmentPayload {
  version: number;
  questions: JourneyAssessmentQuestion[];
  intro_he?: string | null;
  intro_en?: string | null;
  outro_he?: string | null;
  outro_en?: string | null;
}

/**
 * v3 slice 2 / migration 054: presentational discriminator for items.
 * Orthogonal to `kind` (which is content/assessment/reflection — the
 * shape of the response surface). content_type drives icons + filters
 * in admin only; the cadence engine doesn't read it.
 */
export type JourneyItemContentType =
  | "article"
  | "exercise"
  | "video"
  | "prompt"
  | "challenge";

export interface JourneyItem {
  id: string;
  category_id: string;
  /** v3 slice 1 / migration 054: optional subtopic the item lives
   *  under. NULL means the item hangs directly off the category. The
   *  trigger journey_items_subtopic_consistency enforces that the
   *  subtopic, if set, belongs to the same category. */
  subtopic_id?: string | null;
  slug: string;
  title_he: string;
  title_en: string | null;
  body_he: string;
  body_en: string | null;
  task_he: string | null;
  task_en: string | null;
  challenge_he: string | null;
  challenge_en: string | null;
  video_url: string | null;
  image_url: string | null;
  /** Migration 050. */
  kind?: JourneyItemKind;
  /** Migration 050. Present only when kind != 'content'. */
  assessment_payload?: JourneyAssessmentPayload | null;
  /** v3 slice 2 / migration 054. Presentational only. */
  content_type?: JourneyItemContentType;
  /** v3 slice 2 / migration 054. Estimated minutes shown to users. */
  est_minutes?: number | null;
  /** v3 slice 2 / migration 054. Free-form tags. The cadence engine
   *  reads tag = 'discovery' for the random pool. */
  tags?: string[];
  /** v3 slice 2 / migration 054. Items that must be delivered before
   *  this one (cadence engine respects). */
  prereq_item_ids?: string[];
  sort_order: number;
  default_offset_days: number;
  is_active: boolean;
  /** Migration 044: 'both' | 'owner' | 'partner'. Solo assignments behave as 'both'. */
  audience: JourneyAudience;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface JourneyAssignment {
  id: string;
  user_id: string | null;
  couple_id: string | null;
  source_kind: AssignmentSourceKind;
  source_id: string;
  anchor_kind: AnchorKind;
  anchor_date: string;
  origin: AssignmentOrigin;
  origin_ref: string | null;
  assigned_by: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface JourneyScheduledItem {
  id: string;
  assignment_id: string;
  item_id: string;
  unlock_at: string;
  sort_order: number;
  has_unlock_override: boolean;
  admin_notes: string | null;
  /**
   * Set by the unlock-notifier the first time an owner is told this
   * item is now available. NULL means "due for notification".
   * Migration 036.
   */
  notified_at: string | null;
  /** Migration 044: copied from item at materialization. The expert may
   * override this row independently (e.g. via per-couple CSV upload). */
  audience: JourneyAudience;
  /** v3 slice 1 / migration 055 — first time the user opened this item. */
  seen_at?: string | null;
  /** v3 slice 1 / migration 055 — first user message in the per-item
   *  thread stamps this. The cadence engine's auto-skip rule keys on
   *  it: rows past auto_skip_after_days with responded_at NULL get
   *  marked skipped on the next materialization sweep. */
  responded_at?: string | null;
  /** v3 slice 1 / migration 055 — set by the cadence engine's
   *  skip-sweep when this row passed the auto-skip threshold without
   *  a response. */
  skipped_at?: string | null;
  /** v3 slice 1 / migration 055 — origin of this scheduled row. */
  source?: "cadence" | "expert_push" | "group" | "random" | "admin_manual" | "program" | "category" | "item";
  created_at: string;
  updated_at: string;
}

export interface JourneyItemCompletion {
  scheduled_item_id: string;
  completed_at: string;
  completed_by: string | null;
  created_at: string;
}

export interface JourneyItemResponse {
  id: string;
  scheduled_item_id: string;
  user_id: string;
  response_text: string;
  is_private: boolean;
  created_at: string;
  /** Clinician fields (migration 049). All nullable; populated when
   *  the clinician triages or replies via the dashboard. The user-
   *  facing item view surfaces `clinician_reply_text` inline so the
   *  user can see the reply without leaving the item. */
  clinician_status?: "open" | "resolved" | "concerning" | null;
  clinician_id?: string | null;
  clinician_reply_text?: string | null;
  clinician_replied_at?: string | null;
  /** Migration 050 — for assessment/reflection items, the user's
   *  serialized structured answer keyed by question id. Null for
   *  content items (which keep using `response_text`). */
  structured_answer?: Record<string, unknown> | null;
}

// ------------------------------------------------------------
// Polymorphic owner helpers
// ------------------------------------------------------------

export type JourneyOwner =
  | { kind: "user"; userId: string }
  | { kind: "couple"; coupleId: string };

/**
 * Serialized owner key used in URLs - "user:<uuid>" or "couple:<uuid>".
 * Used for admin Manage-Client routes so both flavors of owner share one
 * URL shape.
 */
export type OwnerKey = `user:${string}` | `couple:${string}`;

// ------------------------------------------------------------
// Derived/joined shapes
// ------------------------------------------------------------

/**
 * A scheduled item enriched with its item content + completion state for
 * a specific viewer. Used by the user-facing timeline.
 */
export interface TimelineEntry {
  scheduled: JourneyScheduledItem;
  item: JourneyItem;
  category: Pick<JourneyCategory, "id" | "name_he" | "name_en" | "slug">;
  status: ScheduledItemStatus;
  completion: JourneyItemCompletion | null;
  /** Responses visible to the current viewer (private filtering applied). */
  responses: JourneyItemResponse[];
}

/**
 * A program with its categories + items inlined. Used by the admin editor
 * and the bulk-assign preview.
 */
export interface ProgramWithContent {
  program: JourneyProgram;
  categories: Array<{
    category: JourneyCategory;
    items: JourneyItem[];
  }>;
}
