-- ───────────────────────────────────────────────────────────────────────────
-- 137_user_directory_meta_name.sql
--
-- Names were showing as "user <id>" in the admin inquiries list for users whose
-- public.profiles.full_name was never populated. The real name often lives in
-- auth.users.raw_user_meta_data (collected at signup) and the email always
-- lives on auth.users — but v_user_directory only exposed profiles.full_name.
--
-- Add ONE column, meta_name, derived from auth.users.raw_user_meta_data, so the
-- name fallback chain (profiles.full_name → auth meta name → email local-part →
-- "user <id>") can resolve a real name without a per-user round-trip.
--
-- Additive only: meta_name is appended as the LAST column (CREATE OR REPLACE
-- VIEW requires existing columns to keep their order/type). Metadata only, no
-- content. Service-role only, like the original view. Idempotent.
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_user_directory AS
SELECT
  u.id                                          AS user_id,
  u.email,
  pr.full_name,
  coalesce(pr.phone, pr.mobile)                 AS phone,
  ll.last_login_at,
  al.activity_level,
  coalesce(cc.completed_chapters, 0)            AS completed_chapters,
  coalesce(gp.games_played, 0)                  AS games_played,
  sub.status                                    AS subscription_status,
  sub.product                                   AS subscription_product,
  sub.plan                                      AS plan,
  coalesce(ent.owns_journey, false)             AS owns_journey,
  coalesce(ent.owns_games,   false)             AS owns_games,
  coalesce(ent.owns_adults,  false)             AS owns_adults,
  -- NEW: best-effort name from the auth metadata captured at signup.
  nullif(
    trim(coalesce(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      u.raw_user_meta_data->>'fullName',
      ''
    )),
    ''
  )                                             AS meta_name
FROM auth.users u
LEFT JOIN public.profiles pr               ON pr.id = u.id
LEFT JOIN public.v_user_last_login ll      ON ll.user_id = u.id
LEFT JOIN public.v_user_activity_level al  ON al.user_id = u.id
LEFT JOIN (
  SELECT completed_by AS user_id, count(*) AS completed_chapters
  FROM public.journey_item_completions
  WHERE completed_by IS NOT NULL
  GROUP BY completed_by
) cc ON cc.user_id = u.id
LEFT JOIN (
  SELECT user_id, count(*) AS games_played
  FROM public.user_game_plays
  GROUP BY user_id
) gp ON gp.user_id = u.id
LEFT JOIN LATERAL (
  SELECT status, product, plan
  FROM public.subscriptions
  WHERE user_id = u.id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1
) sub ON true
LEFT JOIN (
  SELECT user_id,
         bool_or(product = 'journey') AS owns_journey,
         bool_or(product = 'games')   AS owns_games,
         bool_or(product = 'adults')  AS owns_adults
  FROM public.subscriptions
  WHERE status = 'active'
  GROUP BY user_id
) ent ON ent.user_id = u.id;

REVOKE ALL ON public.v_user_directory FROM anon, authenticated;
GRANT SELECT ON public.v_user_directory TO service_role;
