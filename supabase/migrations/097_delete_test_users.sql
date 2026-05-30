-- 097_delete_test_users.sql
-- Manual cleanup: delete 76 test/dev users from auth.users
-- requested by Itzik 2026-05-29.
--
-- CASCADE behaviour: deleting an auth.users row cascades to almost every
-- table that references it (profiles, subscriptions, cardcom_*, journey_*,
-- between_us_*, couples, etc.). A handful of FKs use ON DELETE RESTRICT
-- (notably some coach/expert references in 069); those rows will block
-- deletion of the corresponding user. We loop per-user with EXCEPTION
-- handling so one blocked user does NOT abort the rest.
--
-- Idempotent: re-running on already-deleted IDs simply matches 0 rows.

DO $$
DECLARE
  target record;
  deleted_count int := 0;
  not_found_count int := 0;
  blocked_count int := 0;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
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
      ('47692074-cd32-4d14-aab8-97d730dcd548'::uuid, 'ni.bed.o.k.i.t.at.2.92@gmail.com'),
      ('c1c1c1c1-0000-0000-0000-000000000001'::uuid, 'noa.levi@mioshy.test'),
      ('ac396a38-f5c8-4ce7-af03-baf225e0c256'::uuid, 'noam1@gmail.com'),
      ('15a9a38f-d808-4748-ba63-4531978756ae'::uuid, 'noam3@gmail.com'),
      ('b0bd2010-fcd5-4b1d-a478-99591261091f'::uuid, 'odi.vej.a.b48@gmail.com'),
      ('ad3be7ea-d91d-4f41-b6b8-905963439f6a'::uuid, 'pay1@gmail.com'),
      ('d9c4da21-81e9-4770-911e-4bdd09780d82'::uuid, 'pay2@gmail.com'),
      ('92cc0100-dff9-4674-881f-53fac380bcf7'::uuid, 'pay4@gmail.com'),
      ('4054bd6f-ede1-435b-b25d-3fd2c4ddbba5'::uuid, 'pay5@gmail.com'),
      ('108b2612-f90e-4bda-aa83-1ff2c39615c2'::uuid, 'q.e.w.uyir.u.6.20@gmail.com'),
      ('30517e27-fc5b-42f3-9180-ce5b04b82607'::uuid, 'shalom@test.com'),
      ('c2c2c2c2-0000-0000-0000-000000000001'::uuid, 'shira.gross@mioshy.test'),
      ('46b04c4a-bed5-422d-8ae0-c47b3fb9609c'::uuid, 'smadar@gmail.com'),
      ('63a75372-1430-43c5-9c43-e75449dc660c'::uuid, 't1@gmail.com'),
      ('8a457396-011d-4ed3-b827-067d31fe4417'::uuid, 'test@dsf.com'),
      ('315e29be-88c3-4fc6-9724-28b46a7d80af'::uuid, 'test@sfdg.com'),
      ('7aff95a1-0926-4d17-87f3-42a3ec65163f'::uuid, 'test1@g.com'),
      ('d9a2b99b-bb5c-477f-817c-c4401db0b14d'::uuid, 'test1@gmail.com'),
      ('0efb956b-5523-48fe-936b-694b7e04b79b'::uuid, 'test12@df.com'),

      -- screen 3
      ('fb7e82dc-e891-4dee-90df-4f17ea796488'::uuid, 'mi1@gmail.com'),
      ('2f70557a-9893-4afe-bc23-ba3122ca7d0a'::uuid, 'mi2@gmail.com'),
      ('cc227e3b-f7f5-4f6d-aae3-88f760954c91'::uuid, 'mi3@gmail.com'),
      ('2936f740-85ed-4180-93e6-7a88f7971bb0'::uuid, 'mi4@gmail.com'),
      ('05dfef20-a585-4571-b092-6850e8c47f70'::uuid, 'mi5@gmail.com'),
      ('7739d0c9-eb67-4ff0-8181-8cb586080026'::uuid, 'mi6@gmail.com'),
      ('ee73f2d5-ef40-40f9-89e6-481e2cadb007'::uuid, 'mi7@gmail.com'),
      ('81ccd2d6-74c8-4135-9574-6eda3f9a467e'::uuid, 'mi8@gmail.com'),

      -- screen 4
      ('0a0a0a0a-0000-0000-0000-000000000001'::uuid, 'admin@mioshy.test'),
      ('c2c2c2c2-0000-0000-0000-000000000002'::uuid, 'amir.gross@mioshy.test'),
      ('f6c63cf7-93fb-4881-8034-1c1ed7127a2f'::uuid, 'bbb4@gmail.com'),
      ('cee42aed-e137-41f1-8715-18d29af5ab62'::uuid, 'bdika@test.com'),
      ('1c7d9d72-a7e1-4f32-bd3f-eb22e25e467d'::uuid, 'c1@gmail.com'),
      ('1b9bb65c-7ae7-43bc-ba69-344c4ba0b11e'::uuid, 'ddd@gmail.com'),
      ('8517d01b-c082-408a-8286-6371b3f71035'::uuid, 'dina@g.com'),
      ('0e0e0e0e-0000-0000-0000-000000000002'::uuid, 'dr.bar.zilai@mioshy.test'),
      ('0e0e0e0e-0000-0000-0000-000000000001'::uuid, 'dr.cohen@mioshy.test'),
      ('0c91d171-a98e-4198-a997-260d05fc0dfc'::uuid, 'dream@gmail.com'),
      ('6ff1eb49-1377-4727-bfdd-743984974c60'::uuid, 'ex.i.xod.u.mo70.2@gmail.com'),
      ('828bfbe7-6288-4b3d-95e5-dca13f0097fc'::uuid, 'ha.ni.m.a.mi43.3@gmail.com'),
      ('079bafdb-d50b-4429-85b8-cf0fc44be833'::uuid, 'itan.e.b.ohi.r.8.7@gmail.com'),
      ('97f9de0d-6531-4d44-8b6b-c6667107e783'::uuid, 'itzik1@gmail.com'),
      ('a582d06a-653c-4f48-8258-99bd036274a1'::uuid, 'itzikbab@g1mail.com'),
      ('8d3c2533-8b9b-44cd-9af8-bd9cee5705b7'::uuid, 'itzikbab@gmail.com'),
      ('cbd16636-211a-4c2d-921e-a26771897670'::uuid, 'jed.ic.uc.37.9@gmail.com'),
      ('84b378b4-968f-4bb0-88c6-058742fdfb9d'::uuid, 'm4@gmail.com'),
      ('5050abab-0000-0000-0000-000000000001'::uuid, 'maya.shapira@mioshy.test'),

      -- from 095 — a1..b2 block
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
      ('9099ffea-c71a-4c3d-a37b-b65013f65732'::uuid, 'b1@g.com'),
      ('da3fa3b2-0400-4fe2-a1fe-1c24b2266c71'::uuid, 'b1@gmail.com'),
      ('f73ae48c-fff6-4623-9eee-a1b6d762043e'::uuid, 'b10@gmail.com'),
      ('22fed55e-62e8-4998-bb9c-d5ae1e2a60f7'::uuid, 'b2@gmail.com')
    ) AS t(user_id, email)
  LOOP
    BEGIN
      DELETE FROM auth.users WHERE id = target.user_id;
      IF FOUND THEN
        deleted_count := deleted_count + 1;
      ELSE
        not_found_count := not_found_count + 1;
        RAISE NOTICE 'not found: % (%)', target.email, target.user_id;
      END IF;
    EXCEPTION
      WHEN foreign_key_violation THEN
        blocked_count := blocked_count + 1;
        RAISE NOTICE 'FK blocked: % (%) — %', target.email, target.user_id, SQLERRM;
      WHEN OTHERS THEN
        blocked_count := blocked_count + 1;
        RAISE NOTICE 'error on %: % — %', target.email, SQLSTATE, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '=== summary ===';
  RAISE NOTICE 'deleted: %', deleted_count;
  RAISE NOTICE 'not found: %', not_found_count;
  RAISE NOTICE 'blocked: %', blocked_count;
END $$;
