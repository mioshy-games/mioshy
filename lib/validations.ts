import { z } from "zod";

export const questionTypeSchema = z.enum(["truth", "dare", "custom"]);
export const questionLevelSchema = z.enum(["light", "flirty", "deep"]);

export const wheelSliceSchema = z.object({
  id: z.string().min(1),
  label_he: z.string(),
  label_en: z.string(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  question_type: questionTypeSchema,
});

export const wheelConfigFormSchema = z.object({
  slices: z.array(wheelSliceSchema).min(2).max(8),
  pointer_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  inner_circle: z.boolean(),
  inner_circle_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  inner_circle_border_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  border_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export const gameFormSchema = z.object({
  name_he: z.string().min(1, "Required"),
  name_en: z.string().min(1, "Required"),
  description_he: z.string(),
  description_en: z.string(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, hyphens"),
  thumbnail_url: z.union([z.string().url(), z.literal("")]).optional(),
  is_active: z.boolean(),
  wheel: wheelConfigFormSchema,
});

export const questionFormSchema = z.object({
  type: questionTypeSchema,
  level: questionLevelSchema,
  text_he: z.string().min(1, "Required"),
  text_en: z.string().min(1, "Required"),
  is_active: z.boolean(),
});

export type GameFormValues = z.infer<typeof gameFormSchema>;
export type QuestionFormValues = z.infer<typeof questionFormSchema>;
