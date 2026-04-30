-- ===========================================================================
-- expert_couples_seed_diagnose.sql
-- ===========================================================================
-- "Database error querying schema" is a GoTrue-internal error that fires
-- when the auth server tries to read a column on auth.users (or the
-- joined identity row) and finds NULL/missing data where it expects an
-- empty string / boolean / jsonb structure.
--
-- The error doesn't bubble to our app — it's between GoTrue and Postgres.
-- The only way to find the root cause is to look at the actual row state
-- and spot what's wrong.
--
-- This script prints, for noa.levi@mioshy.test:
--   1. Every column on auth.users with its nullability + value.
--   2. The auth.identities row (provider, provider_id, identity_data).
--   3. A focused list of the columns GoTrue typically queries on sign-in
--      and flags any that are NULL.
--
-- USAGE — paste into Supabase SQL editor (service-role) and run.
--         Output appears as multiple result tables.
-- ===========================================================================

-- 1. Full row dump (every column with its current value) ---------------------
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'auth' AND table_name = 'users'
ORDER BY ordinal_position;


-- 2. The actual row for noa.levi --------------------------------------------
SELECT *
FROM auth.users
WHERE email = 'noa.levi@mioshy.test';


-- 3. The identity row -------------------------------------------------------
SELECT id, user_id, provider, provider_id, identity_data, created_at, updated_at
FROM auth.identities
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'noa.levi@mioshy.test');


-- 4. Focused null-check on the columns GoTrue cares about -------------------
-- These are the most common offenders. Any TRUE in the boolean columns means
-- "this column is NULL where GoTrue expects a value" → the likely culprit.
SELECT
  email,
  -- Token columns (GoTrue queries them on every sign-in; NOT NULL DEFAULT '')
  confirmation_token         IS NULL AS confirmation_token_is_null,
  recovery_token             IS NULL AS recovery_token_is_null,
  email_change_token_new     IS NULL AS email_change_token_new_is_null,
  email_change_token_current IS NULL AS email_change_token_current_is_null,
  email_change               IS NULL AS email_change_is_null,
  phone_change               IS NULL AS phone_change_is_null,
  phone_change_token         IS NULL AS phone_change_token_is_null,
  reauthentication_token     IS NULL AS reauthentication_token_is_null,
  -- Boolean flags (NOT NULL DEFAULT false)
  is_super_admin             IS NULL AS is_super_admin_is_null,
  is_sso_user                IS NULL AS is_sso_user_is_null,
  is_anonymous               IS NULL AS is_anonymous_is_null,
  -- Status / meta
  email_change_confirm_status IS NULL AS email_change_confirm_status_is_null,
  raw_app_meta_data          IS NULL AS raw_app_meta_data_is_null,
  raw_user_meta_data         IS NULL AS raw_user_meta_data_is_null,
  -- Confirmation
  email_confirmed_at         IS NULL AS email_confirmed_at_is_null,
  -- The encrypted password itself
  encrypted_password         IS NULL AS password_is_null,
  length(encrypted_password) AS password_length
FROM auth.users
WHERE email = 'noa.levi@mioshy.test';


-- 5. Focused null-check on the identity row ---------------------------------
SELECT
  provider,
  provider_id,
  provider_id IS NULL                                        AS provider_id_is_null,
  identity_data IS NULL                                       AS identity_data_is_null,
  identity_data ? 'sub'                                       AS has_sub,
  identity_data ? 'email'                                     AS has_email,
  identity_data ? 'email_verified'                            AS has_email_verified,
  identity_data ->> 'email_verified'                          AS email_verified_value,
  -- provider_id should equal the lower-cased email for the email provider
  (provider_id = (SELECT lower(email) FROM auth.users
                  WHERE email = 'noa.levi@mioshy.test'))      AS provider_id_matches_email
FROM auth.identities
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'noa.levi@mioshy.test')
  AND provider = 'email';


-- 6. Compare GoTrue's expected schema vs. what we actually have -------------
-- This is the most useful query — it lists every NOT NULL column on
-- auth.users that has a NULL value in our seed row. Empty result = the
-- row is structurally fine and the error is elsewhere.
SELECT
  c.column_name,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'auth'
  AND c.table_name   = 'users'
  AND c.is_nullable  = 'NO'
  AND EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.email = 'noa.levi@mioshy.test'
      -- Build a dynamic check: column value IS NULL → flag it
      AND (
        CASE c.column_name
          WHEN 'id'                          THEN u.id::text IS NULL
          WHEN 'aud'                         THEN u.aud IS NULL
          WHEN 'role'                        THEN u.role IS NULL
          WHEN 'email'                       THEN u.email IS NULL
          WHEN 'encrypted_password'          THEN u.encrypted_password IS NULL
          WHEN 'email_confirmed_at'          THEN u.email_confirmed_at IS NULL
          WHEN 'invited_at'                  THEN u.invited_at IS NULL
          WHEN 'confirmation_token'          THEN u.confirmation_token IS NULL
          WHEN 'confirmation_sent_at'        THEN u.confirmation_sent_at IS NULL
          WHEN 'recovery_token'              THEN u.recovery_token IS NULL
          WHEN 'recovery_sent_at'            THEN u.recovery_sent_at IS NULL
          WHEN 'email_change_token_new'      THEN u.email_change_token_new IS NULL
          WHEN 'email_change'                THEN u.email_change IS NULL
          WHEN 'email_change_sent_at'        THEN u.email_change_sent_at IS NULL
          WHEN 'last_sign_in_at'             THEN u.last_sign_in_at IS NULL
          WHEN 'raw_app_meta_data'           THEN u.raw_app_meta_data IS NULL
          WHEN 'raw_user_meta_data'          THEN u.raw_user_meta_data IS NULL
          WHEN 'is_super_admin'              THEN u.is_super_admin IS NULL
          WHEN 'created_at'                  THEN u.created_at IS NULL
          WHEN 'updated_at'                  THEN u.updated_at IS NULL
          WHEN 'phone_confirmed_at'          THEN u.phone_confirmed_at IS NULL
          WHEN 'phone_change'                THEN u.phone_change IS NULL
          WHEN 'phone_change_token'          THEN u.phone_change_token IS NULL
          WHEN 'phone_change_sent_at'        THEN u.phone_change_sent_at IS NULL
          WHEN 'email_change_token_current'  THEN u.email_change_token_current IS NULL
          WHEN 'email_change_confirm_status' THEN u.email_change_confirm_status IS NULL
          WHEN 'banned_until'                THEN u.banned_until IS NULL
          WHEN 'reauthentication_token'      THEN u.reauthentication_token IS NULL
          WHEN 'reauthentication_sent_at'    THEN u.reauthentication_sent_at IS NULL
          WHEN 'is_sso_user'                 THEN u.is_sso_user IS NULL
          WHEN 'is_anonymous'                THEN u.is_anonymous IS NULL
          ELSE false
        END
      )
  );
-- ↑ If this query returns rows, those columns are the offenders. Each
--   one is a NOT NULL column that's currently NULL on the seed user.
