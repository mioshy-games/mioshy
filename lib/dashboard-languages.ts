export type DashboardLanguage = {
  code: string;
  label: string;
  dir: "ltr" | "rtl";
  /** Suffix for DB / form fields, e.g. "_he" → name_he */
  fieldSuffix: string;
};

/**
 * Ordered for desktop: first in array = left column (LTR layout), last = right.
 * English left, Hebrew right per product spec.
 */
export const DASHBOARD_LANGUAGES: DashboardLanguage[] = [
  { code: "en", label: "English", dir: "ltr", fieldSuffix: "_en" },
  { code: "he", label: "עברית", dir: "rtl", fieldSuffix: "_he" },
];

export function fieldName(base: string, lang: DashboardLanguage): string {
  return `${base}${lang.fieldSuffix}`;
}
