/**
 * lib/journey/default-coach.ts
 *
 * Phase 13 follow-up — default coach identity surfaced everywhere a
 * real persona isn't configured yet. Until each expert fills out
 * `/dashboard/coach-profile`, every user-facing surface that would
 * otherwise show "מיאושי" / a blank avatar gets Yitzhak instead.
 *
 * This is a temporary single-coach default. Once we have multiple
 * coaches and a real assignment flow, drop this module and wire the
 * UI back to the per-couple persona only.
 */

const DEFAULT_DISPLAY_NAME_HE = "יצחק";
const DEFAULT_DISPLAY_NAME_EN = "Yitzhak";
const DEFAULT_AVATAR_URL      = "/images/yitzhak.webp";
const DEFAULT_SHORT_BIO_HE    =
  "המאמן הזוגי שלכם במיאושי. כותב כל שבוע, קורא כל מה שאתם שולחים, ועוזר לתרגם את התובנות לזוגיות יום-יום.";
const DEFAULT_SHORT_BIO_EN    =
  "Your Mioshy relationship coach. Writes every week, reads everything you share, helps translate insight into the way you live together.";

/** camelCase shape used by `lib/journey/coach.ts` callers. */
export interface DefaultCoachCamel {
  expertId:        string;
  displayNameHe:   string | null;
  displayNameEn:   string | null;
  avatarUrl:       string | null;
  shortBioHe:      string | null;
  shortBioEn:      string | null;
}

/** snake_case shape used by message + couple-channel renderers. */
export interface DefaultCoachSnake {
  id:                string;
  display_name_he:   string | null;
  display_name_en:   string | null;
  avatar_url:        string | null;
  short_bio_he:      string | null;
  short_bio_en:      string | null;
}

/**
 * Sentinel id used when the default persona has no real expert
 * underneath. Anything in the UI keying off "this came from a coach"
 * still works — we just can't deep-link to the coach's profile.
 */
export const DEFAULT_COACH_SENTINEL_ID = "default-yitzhak";

export const DEFAULT_COACH_CAMEL: DefaultCoachCamel = {
  expertId:      DEFAULT_COACH_SENTINEL_ID,
  displayNameHe: DEFAULT_DISPLAY_NAME_HE,
  displayNameEn: DEFAULT_DISPLAY_NAME_EN,
  avatarUrl:     DEFAULT_AVATAR_URL,
  shortBioHe:    DEFAULT_SHORT_BIO_HE,
  shortBioEn:    DEFAULT_SHORT_BIO_EN,
};

export const DEFAULT_COACH_SNAKE: DefaultCoachSnake = {
  id:              DEFAULT_COACH_SENTINEL_ID,
  display_name_he: DEFAULT_DISPLAY_NAME_HE,
  display_name_en: DEFAULT_DISPLAY_NAME_EN,
  avatar_url:      DEFAULT_AVATAR_URL,
  short_bio_he:    DEFAULT_SHORT_BIO_HE,
  short_bio_en:    DEFAULT_SHORT_BIO_EN,
};

/**
 * Build a snake-case persona for a real expert id, falling back to
 * the Yitzhak default for any field the expert hasn't filled. Keeps
 * the real expertId so deep-link affordances still work.
 */
export function snakePersonaWithFallback(
  expertId: string,
  raw: {
    coach_display_name_he: string | null;
    coach_display_name_en: string | null;
    coach_avatar_url:      string | null;
    coach_short_bio_he:    string | null;
    coach_short_bio_en:    string | null;
  } | null,
): DefaultCoachSnake {
  return {
    id:              expertId,
    display_name_he: raw?.coach_display_name_he?.trim() || DEFAULT_DISPLAY_NAME_HE,
    display_name_en: raw?.coach_display_name_en?.trim() || DEFAULT_DISPLAY_NAME_EN,
    avatar_url:      raw?.coach_avatar_url?.trim()      || DEFAULT_AVATAR_URL,
    short_bio_he:    raw?.coach_short_bio_he?.trim()    || DEFAULT_SHORT_BIO_HE,
    short_bio_en:    raw?.coach_short_bio_en?.trim()    || DEFAULT_SHORT_BIO_EN,
  };
}

/**
 * Pull the default coach's persona from the DB — the row in `profiles`
 * with `is_default_coach = true`. Returns null if no row is flagged
 * (caller should then fall back to DEFAULT_COACH_CAMEL constant).
 *
 * Cached per request via the supabase admin client; module-level
 * memoisation isn't worth it because Next.js' request-scoped cache
 * already covers the hot path.
 */
export async function fetchDefaultCoachFromDb(): Promise<DefaultCoachCamel | null> {
  // Lazy import to avoid pulling supabase admin into client bundles.
  const { createServiceRoleClient } = await import("@/lib/supabase-admin");
  const admin = createServiceRoleClient();
  if (!admin) return null;

  const { data } = await admin
    .from("profiles")
    .select(
      "id, coach_display_name_he, coach_display_name_en, coach_avatar_url, coach_short_bio_he, coach_short_bio_en",
    )
    .eq("is_default_coach", true)
    .maybeSingle();

  if (!data) return null;
  const p = data as {
    id: string;
    coach_display_name_he: string | null;
    coach_display_name_en: string | null;
    coach_avatar_url:      string | null;
    coach_short_bio_he:    string | null;
    coach_short_bio_en:    string | null;
  };

  return {
    expertId:      p.id,
    displayNameHe: p.coach_display_name_he?.trim() || DEFAULT_COACH_CAMEL.displayNameHe,
    displayNameEn: p.coach_display_name_en?.trim() || DEFAULT_COACH_CAMEL.displayNameEn,
    avatarUrl:     p.coach_avatar_url?.trim()      || DEFAULT_COACH_CAMEL.avatarUrl,
    shortBioHe:    p.coach_short_bio_he?.trim()    || DEFAULT_COACH_CAMEL.shortBioHe,
    shortBioEn:    p.coach_short_bio_en?.trim()    || DEFAULT_COACH_CAMEL.shortBioEn,
  };
}

/**
 * Resolve the default coach: prefer the DB row (so the persona reflects
 * whatever the coach edited at /dashboard/coach-profile), fall back to
 * the hardcoded constant if no row is flagged or the DB is unavailable.
 */
export async function resolveDefaultCoach(): Promise<DefaultCoachCamel> {
  const fromDb = await fetchDefaultCoachFromDb();
  return fromDb ?? DEFAULT_COACH_CAMEL;
}
