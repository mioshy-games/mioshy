-- ============================================================
-- 159_stage1_cms_fixes.sql  (Stage-1 content fixes — Part A)
--
-- Idempotent UPDATEs against live cms_texts keys (verified present in prod
-- 2026-07-02). he_text only — en_text is left untouched. Run manually in the
-- Supabase SQL editor, like prior cms_texts seeds (150/151/154/158).
--
-- Copy is VERBATIM from docs/stage1-fixes-checklist-2026-07-02.md +
-- docs/content-messaging-audit-stage1-2026-07-02.md (agent composed none of it).
-- Every string obeys the mandatory voice rules (no em-dash / no "!" / no emoji).
--
-- ⚠️ The {N} entry-copy strings (couplesAssessment.hero.trust, .faq.item2A) and
-- the items needing your copy decision are in the commented TODO block at the
-- bottom — NOT applied here (see the report / stop 2).
-- ============================================================

begin;

-- ── Home (page: homepage) ───────────────────────────────────────────────────

-- FAQ "אפשר לבטל בכל שלב?" — item9A currently holds a wrong "מתאים לכל זוג"
-- answer. Restore the cancel answer (checklist §A/home).
update public.cms_texts set he_text =
  $t$בהחלט. אין מחויבות ואין קנסות. ביטול נעשה בלחיצת כפתור באזור האישי, או בפנייה לתמיכה.$t$
  where key = 'homeV2.faq.item9A';

-- "צוות מומחים עם למעלה -30 שנות ניסיון" → no number (decision 6).
update public.cms_texts set he_text =
  $t$צוות מומחים מנוסה לזוגיות ואינטימיות$t$
  where key = 'homeV2.intimacy.pillar2Body';

-- Testimonial typo fix: "נמאס לי מאוד לילה בנטפליס" → "מעוד לילה בנטפליקס".
update public.cms_texts set he_text =
  $t$"אז נכנסנו לשחק במשחקי זוגות אונליין כי נמאס לי מעוד לילה בנטפליקס. צחקנו ובילינו ממש בכיף"$t$
  where key = 'homeV2.reviews.item1Text';

-- ── Couples assessment (page: couples-assessment) ───────────────────────────

-- Sub-headline: drop the "!" (brand voice).
update public.cms_texts set he_text =
  $t$אבחון קצר, ובסופו תמונה ברורה של הזוגיות שלכם.$t$
  where key = 'couplesAssessment.hero.sub';

-- ── Mioshy-sex (page: mioshy-sex) ───────────────────────────────────────────

-- FAQ "מה אנחנו מקבלים בתום הרכישה?" — the live .faq.item2A answers "when to
-- play". Replace with the real answer (checklist §A/mioshy-sex). NOTE: the doc
-- copy had an em-dash before "בלי הורדות"; replaced with a comma per the voice
-- rule (flagged in the report for your confirmation).
update public.cms_texts set he_text =
  $t$גישה מיידית למשחק המלא, לשניכם. נפתח לכם חלל זוגי משותף, וכל מה שנרכש זמין בו לשני בני הזוג, בלי הורדות ובלי המתנה.$t$
  where key = 'mioshySexPage.faq.item2A';

-- FAQ "זה דיסקרטי?" — expand the one-word answer.
update public.cms_texts set he_text =
  $t$לחלוטין. החיוב מופיע תחת Mioshy בלבד, והתכנים נפתחים רק לכם. שום פרט לא יוצא החוצה.$t$
  where key = 'mioshySexPage.faq.item7A';

-- ── Trial CTA label (page: marketing / section: trial) ──────────────────────
-- 158 seeded "נסה 7 ימים חינם"; the canonical doc copy (task 17) is "התחילו".
update public.cms_texts set he_text = $t$התחילו 7 ימים חינם$t$
  where key = 'trial_cta_label';

commit;

select pg_notify('pgrst', 'reload schema');

-- ============================================================
-- TODO — NOT APPLIED. Needs a decision / code wiring first (stop 2 report):
--
-- 1. ENTRY COPY with dynamic {N} — apply ONLY after the couples-assessment
--    render is wired to CmsText vars={{N: shortCount}} (else "{N}" shows
--    literally). Proposed (N=12 live, X="כ-2 דקות"):
--      couplesAssessment.hero.trust :  {N} שאלות · כ-2 דקות · בלי כרטיס אשראי
--      couplesAssessment.faq.item2A :  <p>{N} שאלות קצרות, כ-2 דקות. בלי שאלונים מתישים.</p>
--      couplesAssessment.what.body  :  swap "תוך 3 דקות" → "תוך כ-2 דקות" (rest verbatim)
--    Value sentence for entry points lacking one (homepage block / journey chip):
--      בסוף מחכה לכם תמונת מצב אישית בחמשת תחומי הזוגיות שלכם.
--
-- 2. homeV2.faq.item10A ("אנחנו בפרק ב׳") — doc says the answer is generic but
--    gives NO replacement copy. Needs your wording.
--
-- 3. Journey "כלים" — the doc's part-A shrink says only "נותנים כלים מעשיים"
--    stays (journeyHub.weekly.lede). ⚠️ DISCREPANCY: you said the journey
--    fallback claims aren't in live CMS, but prod cms_texts DOES contain
--    "7 צירים" (journeyHub.why.items.0.p) and durations
--    (journeyAssessment.intro.durationTitle = "10 דקות בשבוע, ארבעה שבועות").
--    Confirm whether these go here (part A) or task 8 (he.json), and give the
--    "כלים" → ("דרכים מעשיות"/"תרגולים"/"מענה מקצועי") wording per context.
--
-- 4. section_name "בינינו" → real name — lives in between_us_settings (a
--    settings row), NOT cms_texts. Change in admin, or say the word for a
--    separate settings UPDATE.
--
-- 5. "נשארות רק בינכם" → "ביניכם" — not found in live cms_texts (mioshy-sex);
--    likely he.json → task 8.
-- ============================================================
