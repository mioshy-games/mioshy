-- ============================================================
-- 159_stage1_cms_fixes.sql  (Stage-1 content fixes — Part A + entry copy)
--
-- Idempotent he_text UPDATEs against live cms_texts keys (verified in prod
-- 2026-07-02). he_text only — en_text untouched. Run manually in the Supabase
-- SQL editor, like prior cms_texts seeds (150/151/154/158). Re-runnable.
--
-- Copy is VERBATIM from docs/stage1-fixes-checklist-2026-07-02.md (agent
-- composed none of it). Every string obeys the voice rules (no em-dash / "!" /
-- emoji). Where the source copy carried an em-dash it was replaced with a comma
-- (mioshy-sex "בתום הרכישה", journey intro.durationBody) — approved by Itzik.
--
-- The {N} entry-copy strings render live via CmsText/FAQ `vars={{N: shortCount}}`
-- (couples-assessment wired to getShortQuestionCount()) — safe to apply.
--
-- Also run alongside this file: 159b_between_us_section_name.sql (section name).
-- ============================================================

begin;

-- ── Home (page: homepage) ───────────────────────────────────────────────────

-- FAQ "אפשר לבטל בכל שלב?" — restore the cancel answer (item9A held a wrong one).
update public.cms_texts set he_text =
  $t$בהחלט. אין מחויבות ואין קנסות. ביטול נעשה בלחיצת כפתור באזור האישי, או בפנייה לתמיכה.$t$
  where key = 'homeV2.faq.item9A';

-- FAQ "אנחנו בפרק ב׳ - מתאים גם לנו?" — real, on-topic answer (item10A).
update public.cms_texts set he_text =
  $t$בהחלט. פרק ב' מגיע עם ניסיון, ולפעמים גם עם זהירות. המשחקים והליווי עוזרים לכם לבנות את הקשר הזה על היכרות אמיתית ועל הרגלים טובים, בקצב שנכון לשניכם.$t$
  where key = 'homeV2.faq.item10A';

-- "צוות מומחים עם למעלה -30 שנות ניסיון" → no number (decision 6).
update public.cms_texts set he_text =
  $t$צוות מומחים מנוסה לזוגיות ואינטימיות$t$
  where key = 'homeV2.intimacy.pillar2Body';

-- Testimonial typo fix: "מאוד"→"מעוד", "בנטפליס"→"בנטפליקס".
update public.cms_texts set he_text =
  $t$"אז נכנסנו לשחק במשחקי זוגות אונליין כי נמאס לי מעוד לילה בנטפליקס. צחקנו ובילינו ממש בכיף"$t$
  where key = 'homeV2.reviews.item1Text';

-- ── Couples assessment (page: couples-assessment) ───────────────────────────

-- Sub-headline: drop the "!".
update public.cms_texts set he_text =
  $t$אבחון קצר, ובסופו תמונה ברורה של הזוגיות שלכם.$t$
  where key = 'couplesAssessment.hero.sub';

-- Entry copy — trust chip. {N} = live short-assessment count (rendered via vars).
update public.cms_texts set he_text =
  $t${N} שאלות · כ-2 דקות · בלי כרטיס אשראי$t$
  where key = 'couplesAssessment.hero.trust';

-- Entry copy — FAQ "כמה זמן האבחון". {N} rendered via FAQ vars.
update public.cms_texts set he_text =
  $t$<p>{N} שאלות קצרות, כ-2 דקות. בלי שאלונים מתישים.</p>$t$
  where key = 'couplesAssessment.faq.item2A';

-- "תוך 3 דקות" → "תוך כ-2 דקות" (surgical; keeps the rest of the sentence).
update public.cms_texts
  set he_text = replace(he_text, 'תוך 3 דקות', 'תוך כ-2 דקות')
  where key = 'couplesAssessment.what.body';

-- ── Mioshy-sex (page: mioshy-sex) ───────────────────────────────────────────

-- FAQ "מה אנחנו מקבלים בתום הרכישה?" — the live .faq.item2A answered "when to
-- play"; replace with the real answer (em-dash → comma per voice rule).
update public.cms_texts set he_text =
  $t$גישה מיידית למשחק המלא, לשניכם. נפתח לכם חלל זוגי משותף, וכל מה שנרכש זמין בו לשני בני הזוג, בלי הורדות ובלי המתנה.$t$
  where key = 'mioshySexPage.faq.item2A';

-- FAQ "זה דיסקרטי?" — expand the one-word answer.
update public.cms_texts set he_text =
  $t$לחלוטין. החיוב מופיע תחת Mioshy בלבד, והתכנים נפתחים רק לכם. שום פרט לא יוצא החוצה.$t$
  where key = 'mioshySexPage.faq.item7A';

-- ── Journey (page: journey) — DB is the source of truth; these live in CMS ───

-- "7 צירים" → "חמישה תחומים" (+ tightened copy).
update public.cms_texts set he_text =
  $t$אבחון קצר ממפה את הזוגיות שלכם בחמישה תחומים. על בסיס התוצאות נבנה לכם מסלול שמתחיל בדיוק במקום הנכון.$t$
  where key = 'journeyHub.why.items.0.p';

-- Assessment intro duration: "כ-7 דקות" → "כ-2 דקות" (em-dash → comma).
-- durationTitle ("10 דקות בשבוע, ארבעה שבועות") intentionally stays.
update public.cms_texts set he_text =
  $t$האבחון לוקח כ-2 דקות. אחר כך, צעד קצר אחת לשבוע, בקצב שלכם.$t$
  where key = 'journeyAssessment.intro.durationBody';

-- "כלים" → context-specific wording (surgical replaces).
update public.cms_texts
  set he_text = replace(he_text, 'נותנים כלים מעשיים', 'נותנים מענה מעשי')
  where key = 'journeyHub.weekly.lede';
update public.cms_texts
  set he_text = replace(he_text, 'כלים מקצועיים', 'דרכים מעשיות')
  where key = 'journeyAssessment.analysis.gain3';
update public.cms_texts
  set he_text = replace(he_text, 'כלים אמיתיים', 'דרכים אמיתיות')
  where key = 'journeyAssessment.analysis.whoFor3';

-- ── Trial CTA label ─────────────────────────────────────────────────────────
-- 158 seeded "נסה 7 ימים חינם"; canonical doc copy (task 17) is "התחילו".
update public.cms_texts set he_text = $t$התחילו 7 ימים חינם$t$
  where key = 'trial_cta_label';

commit;

select pg_notify('pgrst', 'reload schema');

-- ============================================================
-- Deferred to task 8 (he.json sync) — NOT in live cms_texts:
--   • "כל הכלים" → "כל מה שצריך"           (not found as a user-facing CMS row)
--   • "נשארות רק בינכם" → "ביניכם"          (mioshy-sex; he.json only)
--   • journey psychologists / "90%" claims  (confirmed absent from live CMS)
-- ============================================================
