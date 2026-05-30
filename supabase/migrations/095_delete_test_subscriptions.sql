-- 095_delete_test_subscriptions.sql
-- Manual cleanup: delete subscriptions for 45 test/dev users
-- requested by Itzik 2026-05-29 (admin UI bulk-select across 3 screens).
--
-- Cascades:
--   subscriptions(id) is referenced by:
--     - cardcom_payments.subscription_id        ON DELETE CASCADE   (016)
--     - between_us_*.subscription_id            ON DELETE CASCADE / SET NULL (029)
--     - couple_workflow_state.subscription_id   ON DELETE CASCADE   (080)
--   so the DELETE below also removes related billing/workflow rows.
--
-- This migration does NOT delete auth.users — only their subscription rows.
-- Safe to re-run: filter is by user_id, missing IDs simply match 0 rows.

BEGIN;

WITH targets(user_id, email) AS (
  VALUES
    -- screen 1
    ('f3d0da96-736a-42c9-b8c0-857747c62808'::uuid, 'test2@gmail.com'),
    ('f39200ab-d6d3-47b4-9ccd-5d6c9edb829f'::uuid, 'test3@gmail.com'),
    ('59086eda-fab1-46ba-a84a-e09f2b1e4608'::uuid, 'test4@gmail.com'),
    ('0ee07ada-0d4c-4942-b774-f65f462fd112'::uuid, 'test5@gmail.com'),
    ('5afc1c38-9c41-415c-aa45-448b83ad19c9'::uuid, 'test6@gmail.com'),
    ('ef917335-49f7-4dc0-9829-03fab747bdc1'::uuid, 'test7@gmail.com'),
    ('c1c1c1c1-0000-0000-0000-000000000002'::uuid, 'tom.levi@mioshy.test'),
    ('856e5ef4-ad0d-44ab-9646-efdf8e2993e4'::uuid, 'toy@gmail.com'),
    ('1d6b9f2b-1167-4490-b59c-a489214277ab'::uuid, 'toy1@gmail.com'),
    ('eba28415-c7dc-45e5-a01d-b3362b547555'::uuid, 'toy2@gmail.com'),
    ('49da7182-3597-4f00-b562-162051c3956f'::uuid, 'toy3@gmail.com'),
    ('85b560af-1443-4d6a-9fe8-ed81983a9b54'::uuid, 'toy4@gmail.com'),
    ('be7f2bbc-3199-462a-bbe1-b60b39e8bd28'::uuid, 'v.a.yewit.ug.4.17@gmail.com'),
    ('b5aa7d11-7310-4558-96ee-1a44aceaafb5'::uuid, 'vxb@sfggd.com'),
    ('2948bfbc-5645-4aed-989a-879dd7e43aee'::uuid, 'xe.dus.eh.uf48@gmail.com'),
    ('5050abab-0000-0000-0000-000000000002'::uuid, 'yoav.dahan@mioshy.test'),

    -- screen 2
    ('a582d06a-653c-4f48-8258-99bd036274a1'::uuid, 'itzikbab@g1mail.com'),
    ('8d3c2533-8b9b-44cd-9af8-bd9cee5705b7'::uuid, 'itzikbab@gmail.com'),
    ('cbd16636-211a-4c2d-921e-a26771897670'::uuid, 'jed.ic.uc.37.9@gmail.com'),
    ('84b378b4-968f-4bb0-88c6-058742fdfb9d'::uuid, 'm4@gmail.com'),
    ('5050abab-0000-0000-0000-000000000001'::uuid, 'maya.shapira@mioshy.test'),
    ('fb7e82dc-e891-4dee-90df-4f17ea796488'::uuid, 'mi1@gmail.com'),
    ('2f70557a-9893-4afe-bc23-ba3122ca7d0a'::uuid, 'mi2@gmail.com'),
    ('cc227e3b-f7f5-4f6d-aae3-88f760954c91'::uuid, 'mi3@gmail.com'),
    ('2936f740-85ed-4180-93e6-7a88f7971bb0'::uuid, 'mi4@gmail.com'),
    ('05dfef20-a585-4571-b092-6850e8c47f70'::uuid, 'mi5@gmail.com'),
    ('7739d0c9-eb67-4ff0-8181-8cb586080026'::uuid, 'mi6@gmail.com'),
    ('ee73f2d5-ef40-40f9-89e6-481e2cadb007'::uuid, 'mi7@gmail.com'),
    ('81ccd2d6-74c8-4135-9574-6eda3f9a467e'::uuid, 'mi8@gmail.com'),

    -- screen 3
    ('a291eb5b-d8ce-42d9-b242-c073e409c822'::uuid, 'a1@gmail.com'),
    ('b5b65a66-59ef-405d-bed3-c632ffe2a831'::uuid, 'a2@gmail.com'),
    ('7e07a56e-1bb8-4f35-8409-4256fc6e4ad9'::uuid, 'a3@gmail.com'),
    ('2abc12ad-e07f-482d-86b0-1a0e993cbebf'::uuid, 'a5@gmail.com'),
    ('f117ec44-42b7-435f-be9a-4b6350147c0c'::uuid, 'a6@gmail.com'),
    ('63223c48-050a-4ae1-8032-d8804d8c9895'::uuid, 'a7@gmail.com'),
    ('879753ba-a6d0-4baa-b0eb-85670bc28e9c'::uuid, 'a8@gmail.com'),
    ('6a0a273c-849e-45a3-b2c7-3d4bafa9a770'::uuid, 'a9@gmail.com'),
    ('2beafc33-8710-4ce2-9caa-3bff4905889c'::uuid, 'aa@g.cm'),
    ('e8e54c6b-bccd-41f0-ba9e-791046eb6387'::uuid, 'abc@gmail.com'),
    ('0a0a0a0a-0000-0000-0000-000000000001'::uuid, 'admin@mioshy.test'),
    ('c2c2c2c2-0000-0000-0000-000000000002'::uuid, 'amir.gross@mioshy.test'),
    ('9099ffea-c71a-4c3d-a37b-b65013f65732'::uuid, 'b1@g.com'),
    ('da3fa3b2-0400-4fe2-a1fe-1c24b2266c71'::uuid, 'b1@gmail.com'),
    ('f73ae48c-fff6-4623-9eee-a1b6d762043e'::uuid, 'b10@gmail.com'),
    ('22fed55e-62e8-4998-bb9c-d5ae1e2a60f7'::uuid, 'b2@gmail.com')
),
deleted AS (
  DELETE FROM public.subscriptions s
  USING targets t
  WHERE s.user_id = t.user_id
  RETURNING s.id, s.user_id, s.email, s.status, s.plan
)
SELECT count(*) AS subscriptions_deleted FROM deleted;

-- Sanity-check: how many of the target users still have any subscription row.
-- Should be 0 after the DELETE above.
DO $$
DECLARE
  remaining int;
BEGIN
  SELECT count(*) INTO remaining
  FROM public.subscriptions s
  WHERE s.user_id IN (
    'f3d0da96-736a-42c9-b8c0-857747c62808','f39200ab-d6d3-47b4-9ccd-5d6c9edb829f',
    '59086eda-fab1-46ba-a84a-e09f2b1e4608','0ee07ada-0d4c-4942-b774-f65f462fd112',
    '5afc1c38-9c41-415c-aa45-448b83ad19c9','ef917335-49f7-4dc0-9829-03fab747bdc1',
    'c1c1c1c1-0000-0000-0000-000000000002','856e5ef4-ad0d-44ab-9646-efdf8e2993e4',
    '1d6b9f2b-1167-4490-b59c-a489214277ab','eba28415-c7dc-45e5-a01d-b3362b547555',
    '49da7182-3597-4f00-b562-162051c3956f','85b560af-1443-4d6a-9fe8-ed81983a9b54',
    'be7f2bbc-3199-462a-bbe1-b60b39e8bd28','b5aa7d11-7310-4558-96ee-1a44aceaafb5',
    '2948bfbc-5645-4aed-989a-879dd7e43aee','5050abab-0000-0000-0000-000000000002',
    'a582d06a-653c-4f48-8258-99bd036274a1','8d3c2533-8b9b-44cd-9af8-bd9cee5705b7',
    'cbd16636-211a-4c2d-921e-a26771897670','84b378b4-968f-4bb0-88c6-058742fdfb9d',
    '5050abab-0000-0000-0000-000000000001','fb7e82dc-e891-4dee-90df-4f17ea796488',
    '2f70557a-9893-4afe-bc23-ba3122ca7d0a','cc227e3b-f7f5-4f6d-aae3-88f760954c91',
    '2936f740-85ed-4180-93e6-7a88f7971bb0','05dfef20-a585-4571-b092-6850e8c47f70',
    '7739d0c9-eb67-4ff0-8181-8cb586080026','ee73f2d5-ef40-40f9-89e6-481e2cadb007',
    '81ccd2d6-74c8-4135-9574-6eda3f9a467e','a291eb5b-d8ce-42d9-b242-c073e409c822',
    'b5b65a66-59ef-405d-bed3-c632ffe2a831','7e07a56e-1bb8-4f35-8409-4256fc6e4ad9',
    '2abc12ad-e07f-482d-86b0-1a0e993cbebf','f117ec44-42b7-435f-be9a-4b6350147c0c',
    '63223c48-050a-4ae1-8032-d8804d8c9895','879753ba-a6d0-4baa-b0eb-85670bc28e9c',
    '6a0a273c-849e-45a3-b2c7-3d4bafa9a770','2beafc33-8710-4ce2-9caa-3bff4905889c',
    'e8e54c6b-bccd-41f0-ba9e-791046eb6387','0a0a0a0a-0000-0000-0000-000000000001',
    'c2c2c2c2-0000-0000-0000-000000000002','9099ffea-c71a-4c3d-a37b-b65013f65732',
    'da3fa3b2-0400-4fe2-a1fe-1c24b2266c71','f73ae48c-fff6-4623-9eee-a1b6d762043e',
    '22fed55e-62e8-4998-bb9c-d5ae1e2a60f7'
  );
  RAISE NOTICE 'subscriptions remaining for target users (should be 0): %', remaining;
END $$;

COMMIT;
