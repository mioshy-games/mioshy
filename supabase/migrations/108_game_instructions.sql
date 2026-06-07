-- 108_game_instructions.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Per-game "how it works" instructions.
--
-- Until now the tutorial popup ("ככה זה עובד") was global and identical for
-- every wheel game (spin → truth-or-dare → answer). Different games have
-- different rules, so we give each game its own instructions, editable from
-- the admin game-edit form.
--
-- Shape (jsonb), Hebrew only for now — English can be added later under "en":
--   {
--     "he": {
--       "title":  "...",            -- optional heading
--       "intro":  "...",            -- optional opening paragraph
--       "steps":  ["...", "..."],   -- ordered list of steps
--       "footer": "..."             -- optional closing note
--     }
--   }
--
-- NULL / absent → the popup falls back to the generic global tutorial, so
-- every existing game keeps working unchanged.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE games ADD COLUMN IF NOT EXISTS instructions jsonb;

-- Seed the "מעולם לא?" game with its real rules, adapted to our wheel
-- (the source text said "draw the top card" — our game is a wheel, so it
-- reads "spin the wheel"). Matched by name to avoid depending on the slug.
UPDATE games
SET instructions = jsonb_build_object(
  'he', jsonb_build_object(
    'title',  'הנחיות למשחק "מעולם לא?"',
    'intro',  'הכינו מראש את בקבוק האלכוהול האהוב עליכם וכוס צ''ייסר לכל אחד מכם. התיישבו זה מול זו.',
    'steps',  jsonb_build_array(
      'סובבו את הגלגל בתורכם.',
      'אם המשפט שמופיע נכון לגביכם – לא שותים. אם הוא לא נכון – שותים כוסית צ''ייסר!'
    ),
    'footer', 'המפסיד הוא הראשון לשתות 5 כוסות.'
  )
)
WHERE name_he LIKE '%מעולם לא%';
