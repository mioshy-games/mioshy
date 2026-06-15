-- 123_honesty_challenge_instructions.sql
-- =============================================================================
-- H5 (g-h-launch): fix the "ככה זה עובד" how-it-works modal for the free game
-- "כנות ואתגר" (slug 'honesty-or-challenge'). It was showing the GENERIC wheel
-- fallback whose step 2 reads "אמת או חובה" / "Truth or Dare" — the wrong name.
--
-- The generic copy lives in shared CMS keys (gamesSlug.tutorial.step*) used by
-- ALL wheel games, so we must NOT edit those. Instead we give THIS game its own
-- per-game `instructions` (the same DB JSONB mechanism as migration 108), which
-- the TutorialPopup CustomInstructions path renders in preference to the generic
-- fallback. Other games are untouched. Admin-editable from the dashboard
-- GameForm; no hardcoding in code.
--
-- Steps use the game's own terms (כנות / אתגר). he + en provided. Matched by
-- slug (with name_he as a fallback). Overwrites any prior instructions for this
-- one game only — intended, since it currently shows the wrong generic text.
-- =============================================================================

UPDATE public.games
SET instructions = jsonb_build_object(
  'he', jsonb_build_object(
    'steps', jsonb_build_array(
      'סובבו את הגלגל',
      'קבלו כרטיס — לענות בכנות או לבצע אתגר',
      'ענו או בצעו, ועברו לסיבוב הבא'
    )
  ),
  'en', jsonb_build_object(
    'steps', jsonb_build_array(
      'Spin the wheel',
      'Get a card — answer honestly or take on a challenge',
      'Answer or act, then move to the next round'
    )
  )
)
WHERE slug = 'honesty-or-challenge'
   OR name_he = 'כנות ואתגר';
