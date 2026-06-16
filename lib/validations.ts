import { z } from "zod";

export const questionTypeSchema = z.string().min(1);
export const questionLevelSchema = z.enum(["light", "flirty", "deep"]);

// Color fields: validate format, but fall back to a safe default instead of
// blocking the entire form save when an imported/legacy value is malformed.
// The admin can then fix colors visually without losing all other edits.
const colorField = (fallback = "#ffffff") =>
  z.string().regex(/^#[0-9A-Fa-f]{6}$/).catch(fallback);

export const wheelSliceSchema = z.object({
  id: z.string().min(1),
  label_he: z.string(),
  label_en: z.string(),
  color: colorField("#6366f1"),
  question_type: questionTypeSchema,
});

export const wheelConfigFormSchema = z.object({
  // Allow 0 slices so saving game details / SEO fields is never blocked
  // by an incomplete wheel (e.g. new game, player_mode game).
  // The actual "must have ≥ 2 slices to spin" guard lives in the game page.
  slices: z.array(wheelSliceSchema).max(16),
  pointer_color: colorField("#ffffff"),
  inner_circle: z.boolean(),
  inner_circle_color: colorField("#1e1b4b"),
  inner_circle_border_color: colorField("#ffffff"),
  border_color: colorField("#ffffff"),
  divider_color: colorField("#ffffff"),
  divider_enabled: z.boolean(),
  divider_width: z.number().int().min(1).max(10),
  marker_config: z
    .object({
      marker_type: z.enum(["none", "circle", "svg_icon"]),
      marker_color: colorField("#ffffff"),
      marker_size: z.number().int().min(2).max(64),
      marker_count: z.number().int().min(0).max(64),
      marker_position: z.number().min(0).max(120),
      svg_path_d: z.string().optional(),
    })
    .passthrough(),
  // category_colors values: fall back per-entry so one bad color doesn't block save
  category_colors: z.record(z.string(), colorField("#6366f1")),
  player_config: z
    .object({
      desired_total_slices: z.number().int().min(2).max(16).default(6),
      categories: z
        .array(
          z.object({
            id: z.string().min(1),
            key: z.string().min(1),
            label_he: z.string(),
            label_en: z.string(),
            color: colorField("#6366f1"),
          }),
        )
        .default([]),
      player_repetitions: z.number().int().min(1).max(16).default(8),
    })
    .passthrough(),
});

export const gameFormSchema = z.object({
  name_he: z.string().min(1, "Required"),
  name_en: z.string().min(1, "Required"),
  description_he: z.string(),
  description_en: z.string(),
  slug: z
    .string()
    .min(1)
    .regex(
      /^[a-z0-9\u0590-\u05FF]+(?:-[a-z0-9\u0590-\u05FF]+)*$/,
      "Lowercase letters, numbers, hyphens (Hebrew characters allowed)",
    ),
  thumbnail_url_he: z.union([z.string().url(), z.literal("")]).optional(),
  thumbnail_url_en: z.union([z.string().url(), z.literal("")]).optional(),
  is_active: z.boolean(),
  bg_type: z.enum(["color", "image"]),
  bg_value: z.string().min(1),
  player_mode: z.boolean(),
  // Admin-editable SEO overrides. Empty string means "use default".
  meta_title_he: z.string().max(70).optional().nullable(),
  meta_title_en: z.string().max(70).optional().nullable(),
  meta_description_he: z.string().max(180).optional().nullable(),
  meta_description_en: z.string().max(180).optional().nullable(),
  og_image_url: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  keywords_csv: z.string().optional().nullable(),
  sort_order: z.number().int().optional().nullable(),
  // D — scheduled "Coming Soon" open time. ISO string, or null = immediate.
  opens_at: z.string().nullable().optional(),
  // a11y M5 — admin-set image alt text. Empty → fall back to the game name.
  alt_text: z.string().optional().nullable(),
  // Per-game "how it works" instructions (migration 108). Hebrew only for now.
  // `steps_text` is one step per line in the UI; the save action splits it into
  // a string[] before writing the jsonb. All parts optional → empty means
  // "use the generic global tutorial".
  instructions: z
    .object({
      title: z.string().optional().nullable(),
      intro: z.string().optional().nullable(),
      steps_text: z.string().optional().nullable(),
      footer: z.string().optional().nullable(),
    })
    .optional(),
  wheel: wheelConfigFormSchema,
});

export const questionFormSchema = z.object({
  type: questionTypeSchema,
  level: questionLevelSchema,
  text_he: z.string().min(1, "Required"),
  text_en: z.string().min(1, "Required"),
  is_active: z.boolean(),
});

export const articleFormSchema = z
  .object({
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, hyphens"),

    title_he: z.string().optional().nullable(),
    title_en: z.string().optional().nullable(),
    excerpt_he: z.string().optional().nullable(),
    excerpt_en: z.string().optional().nullable(),
    content_he: z.string().optional().nullable(),
    content_en: z.string().optional().nullable(),

    cover_image_url: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
    author: z.string().min(1).default("Itzik Berlav"),

    is_published: z.boolean().default(false),

    meta_title_he: z.string().optional().nullable(),
    meta_title_en: z.string().optional().nullable(),
    meta_description_he: z.string().optional().nullable(),
    meta_description_en: z.string().optional().nullable(),
    canonical_url: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
    og_image_url: z.union([z.string().url(), z.literal(""), z.null()]).optional(),

    tags_csv: z.string().optional().nullable(),
  })
  .superRefine((v, ctx) => {
    const hasTitle = Boolean((v.title_he ?? "").trim() || (v.title_en ?? "").trim());
    const hasContent = Boolean(
      (v.content_he ?? "").trim() || (v.content_en ?? "").trim(),
    );
    if (!hasTitle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["title_en"],
        message: "Provide at least one title (HE or EN).",
      });
    }
    if (!hasContent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content_en"],
        message: "Provide at least one content field (HE or EN).",
      });
    }
  });

export type GameFormValues = z.infer<typeof gameFormSchema>;
export type QuestionFormValues = z.infer<typeof questionFormSchema>;
export type ArticleFormInput = z.input<typeof articleFormSchema>;
export type ArticleFormValues = z.output<typeof articleFormSchema>;
