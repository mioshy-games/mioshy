-- ──────────────────────────────────────────────────────────────────────────
-- 039_adults_canonical_categories.sql
--
-- Seed the canonical four categories used on the /adults catalogue surface.
-- These reflect the actual product taxonomy — what the user picks before
-- buying a sexual game:
--
--   1. WITH sex toys      — games whose actions assume a toy is in the room
--   2. WITHOUT sex toys   — games that need no equipment at all
--   3. SHE takes control  — games where the woman drives the scene
--   4. HE takes control   — games where the man drives the scene
--
-- Idempotent on slug — re-running the migration is safe; it ONLY inserts
-- rows that don't already exist (and updates the names/colors of the
-- canonical four if their slugs already exist with old labels).
--
-- Color choices: rose / violet / fuchsia / amber map to the page's existing
-- after-dark palette so category chips read cohesively against the dark UI.
-- ──────────────────────────────────────────────────────────────────────────

INSERT INTO public.experience_game_categories
  (slug, name_he, name_en, description_he, description_en, color_hex, sort_weight, is_active)
VALUES
  (
    'with-toys',
    'עם צעצועי מין',
    'With sex toys',
    'משחקים שכוללים פעולות עם צעצועי מין (וויברטור, אזיקים, סרט עיניים וכו'').',
    'Games with actions involving sex toys (vibrators, cuffs, blindfolds, etc.).',
    '#F43F5E',
    10,
    true
  ),
  (
    'without-toys',
    'בלי צעצועי מין',
    'Without sex toys',
    'משחקים שלא דורשים שום ציוד — רק שניכם.',
    'Games that need no equipment at all — just the two of you.',
    '#A855F7',
    20,
    true
  ),
  (
    'she-leads',
    'האישה לוקחת שליטה',
    'She takes control',
    'משחקים שבהם האישה מובילה את הסצנה ואת הפעולות.',
    'Games where the woman leads the scene and the actions.',
    '#EC4899',
    30,
    true
  ),
  (
    'he-leads',
    'הגבר לוקח שליטה',
    'He takes control',
    'משחקים שבהם הגבר מוביל את הסצנה ואת הפעולות.',
    'Games where the man leads the scene and the actions.',
    '#FBBF24',
    40,
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  name_he        = EXCLUDED.name_he,
  name_en        = EXCLUDED.name_en,
  description_he = EXCLUDED.description_he,
  description_en = EXCLUDED.description_en,
  color_hex      = EXCLUDED.color_hex,
  sort_weight    = EXCLUDED.sort_weight,
  is_active      = EXCLUDED.is_active,
  updated_at     = now();
