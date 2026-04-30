-- ===========================================================================
-- expert_couples_seed_repair.sql
-- ===========================================================================
-- One-shot repair for the seed users created by expert_couples_seed.sql.
-- The original seed inserted only a subset of auth.users columns; modern
-- Supabase GoTrue (the auth server) queries several others on every
-- sign-in and fails with "Database error querying schema" when they're
-- NULL where it expects empty string / false / 0.
--
-- Also fixes auth.identities:
--   - provider_id was set to user_id; for the email provider GoTrue
--     expects it to be the lower-cased email.
--   - identity_data was missing email_verified / phone_verified flags.
--
-- Idempotent: safe to re-run. Only touches rows where email ends in
-- '@mioshy.test' so real users are not affected.
-- ===========================================================================

BEGIN;

-- 1. auth.users — backfill the columns GoTrue queries on sign-in.
UPDATE auth.users
SET
  confirmation_token         = COALESCE(confirmation_token, ''),
  recovery_token             = COALESCE(recovery_token, ''),
  email_change_token_new     = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  email_change               = COALESCE(email_change, ''),
  phone_change               = COALESCE(phone_change, ''),
  phone_change_token         = COALESCE(phone_change_token, ''),
  reauthentication_token     = COALESCE(reauthentication_token, ''),
  email_change_confirm_status = COALESCE(email_change_confirm_status, 0),
  is_super_admin             = COALESCE(is_super_admin, false),
  is_sso_user                = COALESCE(is_sso_user, false),
  is_anonymous               = COALESCE(is_anonymous, false)
WHERE email LIKE '%@mioshy.test';


-- 2. auth.identities — fix provider_id (must be email for email provider)
--    and add the verified flags GoTrue expects in identity_data.
UPDATE auth.identities i
SET
  provider_id = u.email,
  identity_data = jsonb_set(
    jsonb_set(
      COALESCE(i.identity_data, '{}'::jsonb),
      '{email_verified}',
      'true'::jsonb,
      true
    ),
    '{phone_verified}',
    'false'::jsonb,
    true
  )
FROM auth.users u
WHERE i.user_id = u.id
  AND i.provider = 'email'
  AND u.email LIKE '%@mioshy.test';


-- 3. Sanity check — print one row so you can confirm in psql.
DO $$
DECLARE
  v_count int;
  v_sample record;
BEGIN
  SELECT count(*) INTO v_count
  FROM auth.users WHERE email LIKE '%@mioshy.test';

  SELECT u.email, i.provider_id, i.identity_data
    INTO v_sample
  FROM auth.users u
  LEFT JOIN auth.identities i ON i.user_id = u.id AND i.provider = 'email'
  WHERE u.email = 'noa.levi@mioshy.test';

  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Repaired % seed users.', v_count;
  RAISE NOTICE 'noa.levi sample:';
  RAISE NOTICE '  email       : %', v_sample.email;
  RAISE NOTICE '  provider_id : %', v_sample.provider_id;
  RAISE NOTICE '  identity    : %', v_sample.identity_data;
  RAISE NOTICE 'Try signing in: noa.levi@mioshy.test / TestPass123!';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END
$$;

COMMIT;
