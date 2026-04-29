-- ──────────────────────────────────────────────────────────────────────────
-- 040_adults_extra_taxonomy.sql
--
-- Adds the taxonomy entries the admin asked for directly from the
-- /dashboard/adults/games/[id] form:
--
--   Categories (3):
--     • Sex toys           (צעצועי מין)
--     • Female dominance   (שליטה נשית)
--     • Male dominance     (שליטה גברית)
--
--   Tags (1):
--     • Couple communication (תקשורת זוגית)
--
-- Idempotent: ON CONFLICT (slug) DO UPDATE so re-running this migration
-- safely refreshes the labels/colors without inserting duplicates.
--
-- Sort weights start at 50 to leave room above for the existing canonical
-- four added in migration 039 (10/20/30/40). Admins can re-order in the
-- dashboard at any time.
-- ──────────────────────────────────────────────────────────────────────────

-- ──── Categories ────
INSERT INTO public.experience_game_categories
  (slug, name_he, name_en, description_he, description_en, color_hex, sort_weight, is_active)
VALUES
  (
    'sex-toys',
    'צעצועי מין',
    'Sex toys',
    'משחקים שכוללים פעולות עם צעצועי מין (וויברטור, אזיקים, סרט עיניים וכו'').',
    'Games whose actions involve sex toys (vibrators, cuffs, blindfolds, etc.).',
    '#F43F5E',
    50,
    true
  ),
  (
    'female-dominance',
    'שליטה נשית',
    'Female dominance',
    'משחקים שבהם האישה מובילה את הסצנה, נותנת הוראות וקובעת את הקצב.',
    'Games where the woman leads the scene, gives directions, and sets the pace.',
    '#EC4899',
    60,
    true
  ),
  (
    'male-dominance',
    'שליטה גברית',
    'Male dominance',
    'משחקים שבהם הגבר מוביל את הסצנה, נותן הוראות וקובע את הקצב.',
    'Games where the man leads the scene, gives directions, and sets the pace.',
    '#FBBF24',
    70,
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


-- ──── Tags ────
INSERT INTO public.experience_game_tags
  (slug, name_he, name_en, color_hex, is_active)
VALUES
  (
    'couple-communication',
    'תקשורת זוגית',
    'Couple communication',
    '#A855F7',
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  name_he   = EXCLUDED.name_he,
  name_en   = EXCLUDED.name_en,
  color_hex = EXCLUDED.color_hex,
  is_active = EXCLUDED.is_active;
