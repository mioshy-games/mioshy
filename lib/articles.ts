export function pickLocalized({
  locale,
  he,
  en,
}: {
  locale: string;
  he: string | null | undefined;
  en: string | null | undefined;
}) {
  const preferHe = locale === "he";
  const primary = preferHe ? he : en;
  const fallback = preferHe ? en : he;
  const usedLocale = primary ? locale : preferHe ? "en" : "he";
  return {
    value: (primary ?? fallback ?? "") as string,
    usedLocale,
    isFallback: Boolean(!primary && fallback),
  };
}

export function estimateReadingTimeMinutes(markdown: string) {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/[#>*_~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return 1;
  const words = text.split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function slugifyTitleEn(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

