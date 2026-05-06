// ============================================================
// Zod validation schemas for Journey Content admin forms.
//
// Pattern note: input === output. We avoid `.default()` and
// `z.coerce.number()` because both widen input beyond output, which
// collides with react-hook-form + @hookform/resolvers/zod. Callers
// supply their own defaults via react-hook-form's `defaultValues`.
// ============================================================

import { z } from "zod";

// ------------------------------------------------------------
// Primitives
// ------------------------------------------------------------

const slug = z
  .string()
  .trim()
  .min(1, "Slug is required")
  .max(120)
  .regex(/^[a-z0-9][a-z0-9-_]*$/i, "Lowercase letters, digits, -, _ only");

// Accepts empty string (form fallback) OR a valid URL string. Kept as a
// string (not nullable) so react-hook-form can register it directly.
const optionalUrl = z.union([
  z.literal(""),
  z
    .string()
    .trim()
    .max(2048)
    .url("Must be a valid URL"),
]);

const anchorKind = z.enum(["assignment", "purchase", "fixed"]);

/**
 * Product pillar this program is wired to for post-purchase automation.
 * Empty string = "none" (form sentinel - the action layer normalizes it
 * to NULL). The enum must stay in sync with migration 036's CHECK and
 * with JourneyProductSlug in types.ts.
 */
const productSlug = z.union([
  z.literal(""),
  z.enum(["games", "journey", "adults"]),
]);

// ------------------------------------------------------------
// Programs
// ------------------------------------------------------------

export const journeyProgramSchema = z.object({
  slug,
  name_he: z.string().trim().min(1, "Hebrew name is required").max(200),
  name_en: z.string().trim().max(200),
  description_he: z.string().trim().max(4000),
  description_en: z.string().trim().max(4000),
  cover_image_url: optionalUrl,
  default_anchor: anchorKind,
  /**
   * Product pillar the Cardcom indicator auto-assigns on purchase. Only
   * ONE active program per pillar may hold a non-empty slug (enforced by
   * the partial unique index in migration 036). Empty string == "not
   * automation-eligible"; the action layer maps it to NULL.
   */
  product_slug: productSlug,
  is_active: z.boolean(),
  sort_weight: z.number().int().min(-1000).max(1000),
});

export type JourneyProgramFormValues = z.infer<typeof journeyProgramSchema>;

// ------------------------------------------------------------
// Categories
// ------------------------------------------------------------

export const journeyCategorySchema = z.object({
  /**
   * program_id is nullable - standalone categories have none. The form
   * passes either a uuid string or null (never an empty string, that's
   * handled at the form layer).
   */
  program_id: z.string().uuid().nullable(),
  slug,
  name_he: z.string().trim().min(1, "Hebrew name is required").max(200),
  name_en: z.string().trim().max(200),
  description_he: z.string().trim().max(4000),
  description_en: z.string().trim().max(4000),
  sort_order: z.number().int().min(-1000).max(10000),
  is_active: z.boolean(),
});

export type JourneyCategoryFormValues = z.infer<typeof journeyCategorySchema>;

// ------------------------------------------------------------
// Groups (v3 slice 7 / migration 054 already created the tables)
// ------------------------------------------------------------

export const journeyGroupSchema = z.object({
  slug,
  label_he: z.string().trim().min(1, "Hebrew label is required").max(200),
  label_en: z.string().trim().max(200),
  description_he: z.string().trim().max(4000),
  description_en: z.string().trim().max(4000),
  is_active: z.boolean(),
});

export type JourneyGroupFormValues = z.infer<typeof journeyGroupSchema>;

/** Per-row binding payload sent by GroupSubtopicBinder. */
export const journeyGroupSubtopicBindingSchema = z.object({
  subtopic_id: z.string().uuid(),
  mode: z.enum(["replace", "interleave"]),
});

export type JourneyGroupSubtopicBindingInput = z.infer<
  typeof journeyGroupSubtopicBindingSchema
>;

// ------------------------------------------------------------
// Expert push (v3 slice 8) - admin pushes a batch of items to a
// recipient (user / couple / group). The action fans out to
// journey_pending_pushes, one row per (target user × item).
// ------------------------------------------------------------

export const pushRecipientSchema = z.object({
  kind: z.enum(["user", "couple", "group"]),
  id: z.string().uuid({ message: "Recipient id must be a uuid" }),
});

export type PushRecipient = z.infer<typeof pushRecipientSchema>;

export const pushPayloadSchema = z.object({
  recipient: pushRecipientSchema,
  itemIds: z
    .array(z.string().uuid())
    .min(1, "Pick at least one item")
    .max(20, "Push at most 20 items at a time"),
  reasonNote: z.string().trim().max(2000),
});

export type PushPayload = z.infer<typeof pushPayloadSchema>;

// ------------------------------------------------------------
// Subtopics (v3 slice 2 / migration 054)
// ------------------------------------------------------------

export const journeySubtopicSchema = z.object({
  category_id: z.string().uuid({ message: "Category is required" }),
  slug,
  name_he: z.string().trim().min(1, "Hebrew name is required").max(200),
  name_en: z.string().trim().max(200),
  description_he: z.string().trim().max(4000),
  description_en: z.string().trim().max(4000),
  sort_order: z.number().int().min(-100000).max(1000000),
  is_active: z.boolean(),
});

export type JourneySubtopicFormValues = z.infer<typeof journeySubtopicSchema>;

// ------------------------------------------------------------
// Items
// ------------------------------------------------------------

const SUBTOPIC_NONE = "" as const;

export const journeyItemSchema = z.object({
  category_id: z.string().uuid({ message: "Category is required" }),
  /** v3 slice 2: optional subtopic. Empty string from the form sentinel
   *  is normalized to NULL by the action layer. The DB trigger enforces
   *  that a non-NULL subtopic belongs to the same category. */
  subtopic_id: z.union([
    z.literal(SUBTOPIC_NONE),
    z.string().uuid(),
  ]),
  slug,
  title_he: z.string().trim().min(1, "Hebrew title is required").max(240),
  title_en: z.string().trim().max(240),
  body_he: z.string().trim().min(1, "Hebrew body is required").max(20000),
  body_en: z.string().trim().max(20000),
  task_he: z.string().trim().max(4000),
  task_en: z.string().trim().max(4000),
  challenge_he: z.string().trim().max(4000),
  challenge_en: z.string().trim().max(4000),
  video_url: optionalUrl,
  image_url: optionalUrl,
  sort_order: z.number().int().min(-100000).max(1000000),
  default_offset_days: z.number().int().min(0).max(3650),
  is_active: z.boolean(),
  /** Migration 044: who in the couple sees this item.
   *   'both'    - both partners (default, mirrors prior behavior)
   *   'owner'   - only the couple_members.role='owner' partner
   *   'partner' - only the couple_members.role='partner' partner
   * Solo (user-owned) assignments behave as 'both' regardless. */
  audience: z.enum(["both", "owner", "partner"]),
});

export type JourneyItemFormValues = z.infer<typeof journeyItemSchema>;

// ------------------------------------------------------------
// Assignments (admin bulk-assign)
// ------------------------------------------------------------

const ownerKeyRegex = /^(user|couple):[0-9a-f-]{36}$/i;

export const journeyAssignmentSchema = z
  .object({
    /**
     * Owner key - "user:<uuid>" or "couple:<uuid>". Opaque to the form;
     * parseOwnerKey() at the action layer turns it back into a JourneyOwner.
     */
    owner_key: z
      .string()
      .regex(ownerKeyRegex, "Owner must be user:<uuid> or couple:<uuid>"),
    source_kind: z.enum(["program", "category", "item"]),
    source_id: z.string().uuid({ message: "Source is required" }),
    anchor_kind: z.enum(["assignment", "purchase", "fixed"]),
    /** ISO date - only required when anchor_kind === "fixed". */
    anchor_date: z.string().trim().max(64),
    origin: z.enum(["admin_manual", "purchase", "trigger"]),
    notes: z.string().trim().max(2000),
  })
  .refine(
    (v) => v.anchor_kind !== "fixed" || v.anchor_date.length > 0,
    {
      message: "Pick a date for anchor_kind='fixed'",
      path: ["anchor_date"],
    },
  );

export type JourneyAssignmentFormValues = z.infer<typeof journeyAssignmentSchema>;
