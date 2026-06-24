import "server-only";

import { createServiceRoleClient } from "@/lib/supabase-admin";

/**
 * Reads the per-day marathon copy from cms_texts (page='marathon', section='days').
 * Keys: marathon.dayN.domain (theme) + marathon.dayN.activity (the 5-min task).
 * Admin edits these at /admin/content without a deploy. Returns null when either
 * key is missing/empty so the caller can skip the send rather than dispatch a
 * half-empty template.
 */
export type MarathonDayCopy = { domain: string; activity: string };

export async function getMarathonDayCopy(
  day: number,
  language: string,
): Promise<MarathonDayCopy | null> {
  const admin = createServiceRoleClient();
  if (!admin) return null;

  const domainKey = `marathon.day${day}.domain`;
  const activityKey = `marathon.day${day}.activity`;

  const { data } = await admin
    .from("cms_texts")
    .select("key, he_text, en_text")
    .in("key", [domainKey, activityKey]);

  const rows = (data ?? []) as Array<{
    key: string;
    he_text: string | null;
    en_text: string | null;
  }>;
  const pick = (key: string): string => {
    const row = rows.find((r) => r.key === key);
    const val = language === "en" ? row?.en_text : row?.he_text;
    return (val ?? "").trim();
  };

  const domain = pick(domainKey);
  const activity = pick(activityKey);
  if (!domain || !activity) return null;
  return { domain, activity };
}
