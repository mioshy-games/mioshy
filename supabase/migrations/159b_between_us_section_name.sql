-- ============================================================
-- 159b_between_us_section_name.sql  (Stage-1 — run alongside 159)
--
-- The Adults section name feeds the page <title>: "בינינו" produced
-- "Mioshy - בינינו", a product name that no longer exists. Rename to the real
-- name (checklist §A/mioshy-sex; consistent with the CMS breadcrumb
-- mioshySexPage.heroBreadcrumbSection = "הסקס של מיאושי").
--
-- Singleton row (id = 1). he/en columns are section_name_he / section_name_en.
-- Idempotent. ⚠️ The doc gave the HE name as an example ("למשל 'הסקס של מיאושי'")
-- — confirm before running if you want a different label.
-- ============================================================

update public.between_us_settings
  set section_name_he = 'הסקס של מיאושי',
      section_name_en = 'Mioshy''s Sex'
  where id = 1;

select pg_notify('pgrst', 'reload schema');
