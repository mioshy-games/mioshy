import type { WheelSlice } from "@/lib/types/database";

export function slugifyNameEn(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function makeSliceId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultSlices(count: 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16): WheelSlice[] {
  return Array.from({ length: count }, (_, i) => ({
    id: makeSliceId(),
    label_he: i % 2 === 0 ? "אמת" : "חובה",
    label_en: i % 2 === 0 ? "Truth" : "Dare",
    color: i % 2 === 0 ? "#f472b6" : "#a78bfa",
    question_type: i % 2 === 0 ? "truth" : "dare",
  }));
}
