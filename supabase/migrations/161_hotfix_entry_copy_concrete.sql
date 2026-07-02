-- ============================================================
-- 161_hotfix_entry_copy_concrete.sql  (PROD HOTFIX — run ASAP)
--
-- 159 set the couples-assessment entry copy to "{N} שאלות …", but the {N}
-- substitution (CmsText `vars`) lives on the trial branch and is NOT yet in the
-- prod `game` build. So prod currently renders the LITERAL "{N} שאלות" on
-- /he/couples-assessment. This restores concrete copy (live short-count = 12)
-- so prod + Preview both read correctly right now.
--
-- Post-merge (when the vars code ships to game), re-apply the {N} version from
-- 159 to make N dynamic again — until then concrete 12 is correct (it IS the
-- current active short-assessment count).
-- ============================================================

begin;

update public.cms_texts
  set he_text = $t$12 שאלות · כ-2 דקות · בלי כרטיס אשראי$t$
  where key = 'couplesAssessment.hero.trust';

update public.cms_texts
  set he_text = $t$<p>12 שאלות קצרות, כ-2 דקות. בלי שאלונים מתישים.</p>$t$
  where key = 'couplesAssessment.faq.item2A';

commit;

select pg_notify('pgrst', 'reload schema');
