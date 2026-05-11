/**
 * lib/journey/anniversary.ts
 *
 * Layer-5 couple-anniversary milestones. Awards the right slug
 * when the couple has been on the journey for 30 / 90 / 365 days
 * (counted from couples.started_journey_at).
 *
 * Uses the SAME journey_milestones table as Layer 4 — these are
 * just additional slugs alongside the completion-count milestones.
 *
 * Idempotent — unique index on (couple_id, milestone_slug) prevents
 * duplicates.
 */

import { createServiceRoleClient } from "@/lib/supabase-admin";
import type { MilestoneDef } from "./milestones";

export type AnniversarySlug =
  | "thirty_days_together"
  | "ninety_days_together"
  | "one_year_together";

export const ANNIVERSARIES: Array<{
  slug:      AnniversarySlug;
  days:      number;
  he: { title: string; body: string; cta: string };
  en: { title: string; body: string; cta: string };
}> = [
  {
    slug: "thirty_days_together",
    days: 30,
    he: {
      title: "חודש ראשון יחד אצלנו",
      body:  "החודש הראשון הוא הקשה — לבחור להופיע, גם כשעמוס. זה לא ברור מאליו ואנחנו רואים את זה.",
      cta:   "תודה שראיתם",
    },
    en: {
      title: "Your first month with us",
      body:  "Month one is the hard one. Choosing to show up, even when life is full. We see that — it isn't a given.",
      cta:   "Thanks for noticing",
    },
  },
  {
    slug: "ninety_days_together",
    days: 90,
    he: {
      title: "שלושה חודשים. זה כבר הרגל.",
      body:  "מעטים מגיעים עד לפה. זה עדות שאתם לוקחים את עצמכם ברצינות, גם כששגרה מצליחה לעיף את כולם.",
      cta:   "ממשיכים",
    },
    en: {
      title: "Three months in. This is a habit now.",
      body:  "Few make it this far. It says something — about you taking yourselves seriously, even when daily life keeps trying to pull people apart.",
      cta:   "Onwards",
    },
  },
  {
    slug: "one_year_together",
    days: 365,
    he: {
      title: "שנה",
      body:  "אם הסתכלתם אחורה היום על הזוג שהייתם לפני שנה, הייתם מזהים את עצמכם? אצל זוגות שעובדים שנה ביחד התשובה כמעט תמיד 'לא לגמרי'. זה השינוי.",
      cta:   "תודה",
    },
    en: {
      title: "One year",
      body:  "If you looked back at the couple you were a year ago, would you fully recognize yourselves? For couples who do this work for a year, the answer is usually 'not quite.' That's the shift.",
      cta:   "Thank you",
    },
  },
];

/**
 * Sweep all anniversaries for a couple. Inserts pending milestone
 * rows for any threshold the couple has crossed but doesn't already
 * have a row for.
 */
export async function checkCoupleAnniversaries(args: {
  coupleId: string;
}): Promise<{ newlyAwarded: AnniversarySlug[] }> {
  const admin = createServiceRoleClient();
  if (!admin) return { newlyAwarded: [] };

  const { data: row } = await admin
    .from("couples")
    .select("started_journey_at, created_at")
    .eq("id", args.coupleId)
    .maybeSingle();
  if (!row) return { newlyAwarded: [] };

  const r = row as {
    started_journey_at: string | null;
    created_at:         string;
  };
  const startIso = r.started_journey_at ?? r.created_at;
  if (!startIso) return { newlyAwarded: [] };
  const startMs = new Date(startIso).getTime();
  if (!Number.isFinite(startMs)) return { newlyAwarded: [] };

  const elapsedDays = Math.floor((Date.now() - startMs) / 86_400_000);

  const newlyAwarded: AnniversarySlug[] = [];
  for (const def of ANNIVERSARIES) {
    if (elapsedDays < def.days) continue;
    const { error } = await admin
      .from("journey_milestones")
      .insert({
        couple_id:       args.coupleId,
        milestone_slug:  def.slug,
        signal_snapshot: { elapsed_days: elapsedDays },
      });
    if (!error) newlyAwarded.push(def.slug);
    // Duplicates silently ignored (already-awarded).
  }

  return { newlyAwarded };
}

/**
 * Anniversary defs in the same shape Layer-4 milestones use, so
 * the existing MilestoneRevealModal can render them without code
 * changes. Returns null for unknown slugs.
 */
export function getAnniversaryDef(
  slug: string,
): MilestoneDef | null {
  const match = ANNIVERSARIES.find((a) => a.slug === slug);
  if (!match) return null;
  return {
    slug:      match.slug as unknown as MilestoneDef["slug"],
    threshold: match.days,
    he:        match.he,
    en:        match.en,
  };
}
