/**
 * lib/journey/milestones.ts
 *
 * Layer-4 milestone detection + reveal helpers.
 *
 * Three default milestone slugs:
 *   - 'five_items'    — 5 completions
 *   - 'ten_items'     — 10 completions
 *   - 'twenty_items'  — 20 completions
 *
 * checkAndAwardMilestones() is called from the item-completion
 * action; it counts current completions per couple and inserts
 * pending rows for any threshold the couple just crossed.
 *
 * The reveal flow on /my/journey reads any pending row (revealed_at
 * IS NULL), shows the modal, then stamps revealed_at on dismiss.
 */

import { createServiceRoleClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Layer 4 ships three completion-count slugs; Layer 5 adds three
// anniversary slugs (thirty/ninety_days_together / one_year_together).
// MilestoneSlug widens to any string at the read boundary so the
// reveal modal can render either kind without a type drama. The
// resolver falls back through both registries in order.
export type MilestoneSlug = string;

export interface MilestoneDef {
  slug:       MilestoneSlug;
  threshold:  number;
  he: { title: string; body: string; cta: string };
  en: { title: string; body: string; cta: string };
}

// Layer-4 completion-count milestones. Copy intentionally short
// and human — no "we noticed", no "we'll utilise", no system
// voice. Sounds like the coach (Yael) wrote it.
export const MILESTONES: MilestoneDef[] = [
  {
    slug:      "five_items",
    threshold: 5,
    he: {
      title: "סיימתם חמישה",
      body:  "החמישה הראשונים זה החלק הקשה. שמרו על הקצב הזה — זה כבר רץ אצלכם.",
      cta:   "ממשיכים",
    },
    en: {
      title: "Five down",
      body:  "The first five are the hardest. Hold this pace — you've got it now.",
      cta:   "Onwards",
    },
  },
  {
    slug:      "ten_items",
    threshold: 10,
    he: {
      title: "עשרה",
      body:  "אצל זוגות שמגיעים לעשרה כבר אפשר להגיד שזה התחיל לעבוד. תרגישו את זה רגע, ואז נמשיך.",
      cta:   "סבבה",
    },
    en: {
      title: "Ten",
      body:  "Couples who hit ten — we can say something is working. Sit with that for a moment, then we'll go on.",
      cta:   "Got it",
    },
  },
  {
    slug:      "twenty_items",
    threshold: 20,
    he: {
      title: "עשרים",
      body:  "מעטים מגיעים לפה. אם תסתכלו על עצמכם לפני חודשיים — תראו זוג אחר. זה לא מחמאה. זה פשוט מה שקרה.",
      cta:   "תודה",
    },
    en: {
      title: "Twenty",
      body:  "Few make it here. Look at yourselves two months ago — you'll see a different couple. It's not a compliment, it's just what happened.",
      cta:   "Thank you",
    },
  },
];

/**
 * Couple-scoped milestone detection. Called from the completion path.
 * Inserts (UPSERT-skip-on-conflict) rows for any threshold crossed.
 *
 * Safe to call on every completion; the unique index prevents
 * duplicates and the SELECT counts are cheap.
 */
export async function checkAndAwardMilestones(args: {
  coupleId: string;
}): Promise<{ newlyAwarded: MilestoneSlug[] }> {
  const admin = createServiceRoleClient();
  if (!admin) return { newlyAwarded: [] };

  // Walk active assignments → scheduled items → count completions.
  const { data: assignments } = await admin
    .from("journey_assignments")
    .select("id")
    .eq("couple_id", args.coupleId)
    .eq("is_active", true);
  const assignmentIds = ((assignments ?? []) as Array<{ id: string }>).map(
    (a) => a.id,
  );
  if (assignmentIds.length === 0) return { newlyAwarded: [] };

  const { data: scheduled } = await admin
    .from("journey_scheduled_items")
    .select("id")
    .in("assignment_id", assignmentIds);
  const scheduledIds = ((scheduled ?? []) as Array<{ id: string }>).map((r) => r.id);
  if (scheduledIds.length === 0) return { newlyAwarded: [] };

  const { count } = await admin
    .from("journey_item_completions")
    .select("scheduled_item_id", { count: "exact", head: true })
    .in("scheduled_item_id", scheduledIds);
  const completionsCount = count ?? 0;

  const newlyAwarded: MilestoneSlug[] = [];
  for (const def of MILESTONES) {
    if (completionsCount < def.threshold) continue;
    const { error } = await admin
      .from("journey_milestones")
      .insert({
        couple_id:       args.coupleId,
        milestone_slug:  def.slug,
        signal_snapshot: { completions_count: completionsCount },
      });
    if (!error) {
      newlyAwarded.push(def.slug);
    }
    // Errors (including the unique-violation duplicate) are silently
    // ignored — already-awarded milestones must not double-fire.
  }

  return { newlyAwarded };
}

/**
 * Read-side: any milestone the current user can see that hasn't
 * been revealed yet. Returns the OLDEST unrevealed (so we don't
 * skip 5_items just because 10_items also pending — though in
 * practice they're awarded one at a time).
 */
export async function getPendingMilestoneForCurrentUser(): Promise<{
  id:    string;
  slug:  MilestoneSlug;
} | null> {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;

  const { data } = await supabase
    .from("journey_milestones")
    .select("id, milestone_slug")
    .is("revealed_at", null)
    .order("achieved_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const r = data as { id: string; milestone_slug: string };
  // Resolve via either the L4 completion registry or the L5
  // anniversary registry. Unknown slugs are silently skipped.
  if (!getMilestoneDef(r.milestone_slug)) return null;
  return { id: r.id, slug: r.milestone_slug };
}

/**
 * Resolve a milestone slug to its display def. Falls through
 * Layer-4 completion milestones first, then Layer-5 anniversary
 * milestones. Returns null when the slug is unknown.
 */
export function getMilestoneDef(slug: string): MilestoneDef | null {
  const fromCompletions = MILESTONES.find((m) => m.slug === slug);
  if (fromCompletions) return fromCompletions;
  // Late-imported to avoid a circular dependency between
  // milestones.ts and anniversary.ts.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getAnniversaryDef } = require("./anniversary") as typeof import("./anniversary");
  return getAnniversaryDef(slug);
}
