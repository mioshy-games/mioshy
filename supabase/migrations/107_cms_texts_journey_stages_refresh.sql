-- ============================================================
-- Migration 107 — refresh journey-stages CMS rows
-- ============================================================
-- Itzik 2026-06-02: the homepage's "3 ways to reconnect" stages were
-- rewritten (lighter, less prescriptive). The /pricing page reuses
-- the SAME CMS keys via the SAME JourneyStages component, but the CMS
-- rows still carried the old wording — so /pricing rendered the old
-- copy while /home showed the new copy.
--
-- This migration updates every homeV2.journeyStages.stage* row to the
-- new HE/EN copy, and seeds the two new monolithic keys (stage3GetIncludes,
-- stage3When) that the component reads but the DB didn't yet have.
--
-- Idempotent: UPSERT via ON CONFLICT (key) DO UPDATE.
-- ============================================================

BEGIN;

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  -- Stage 1
  ('homeV2.journeyStages.stage1Label',     'homepage', 'journeyStages',
    'קליל', 'Light', false),
  ('homeV2.journeyStages.stage1Hook',      'homepage', 'journeyStages',
    'בא לי שנצחק יחד', 'I want us to laugh together', false),
  ('homeV2.journeyStages.stage1Desc',      'homepage', 'journeyStages',
    'ערב פנוי על הספה, אתם פותחים משחק מהטלפון ומתחילים לשחק. בלי הרשמה מסובכת ובלי התחייבות.',
    'A free evening on the couch — you open a game from your phone and start playing. No complicated signup, no commitment.', false),
  ('homeV2.journeyStages.stage1Get',       'homepage', 'journeyStages',
    'בילוי זוגי מהנה שבו תתחברו אחד לשני ותיהנו מזמן משותף כמו שלא היה לכם המון זמן, אולי כבר שנים.',
    'A fun couples night where you reconnect and enjoy time together like you haven''t in a long time — maybe years.', false),
  ('homeV2.journeyStages.stage1When',      'homepage', 'journeyStages',
    'כשנשארתם לבד בבית והילדים ישנים / בחופשה.',
    'When you''re alone at home with the kids asleep, or on vacation.', false),
  ('homeV2.journeyStages.stage1Period',    'homepage', 'journeyStages',
    '/ לשבוע', '/ per week', false),

  -- Stage 2
  ('homeV2.journeyStages.stage2Label',     'homepage', 'journeyStages',
    'נועז', 'Bold', false),
  ('homeV2.journeyStages.stage2Desc',      'homepage', 'journeyStages',
    'סוגרים את הדלת, והלילה הזה שייך רק לכם שניכם.',
    'Close the door — this night belongs to just the two of you.', false),
  ('homeV2.journeyStages.stage2Get',       'homepage', 'journeyStages',
    'ערב מלא יצרים ותשוקה, עם משחקי זוגיות לחדר השינה שיובילו אתכם צעד אחר צעד.',
    'An evening full of desire and passion, with intimate couples games that guide you step by step.', false),
  ('homeV2.journeyStages.stage2When',      'homepage', 'journeyStages',
    'כשבא לכם לפנק, להתפנק ולחגוג בערב בלתי נשכח.',
    'When you want to spoil each other and celebrate an unforgettable night.', false),
  ('homeV2.journeyStages.stage2Period',    'homepage', 'journeyStages',
    'חד פעמי', 'one-time', false),

  -- Stage 3
  ('homeV2.journeyStages.stage3Label',     'homepage', 'journeyStages',
    'מודרך · כולל הכל', 'Guided · everything included', false),
  ('homeV2.journeyStages.stage3Hook',      'homepage', 'journeyStages',
    'בא לי מומחה שילווה אותנו', 'I want an expert to guide us', false),
  ('homeV2.journeyStages.stage3Desc',      'homepage', 'journeyStages',
    'מרגע ההצטרפות מומחה צמוד בונה אתכם תהליך לפי המסלול שבחרתם, מלווה אתכם בכל שאלה ועוזר לכם למצוא מחדש את החיבור.',
    'From the moment you join, a dedicated expert builds a process tailored to the path you chose, walks with you through every question, and helps you find the connection again.', false),
  ('homeV2.journeyStages.stage3Get',       'homepage', 'journeyStages',
    'מומחה אישי · תוכנית שבועית · צ''אט ישיר · גישה לכל המשחקים',
    'Personal expert · Weekly plan · Direct chat · Access to every game', false),
  ('homeV2.journeyStages.stage3GetIncludes', 'homepage', 'journeyStages',
    'כלול: משחקי זוגות אונליין + הסקס של מיאושי',
    'Included: Online couples games + Mioshy''s Sex', false),
  ('homeV2.journeyStages.stage3When',      'homepage', 'journeyStages',
    'אם אחרי שנים יחד השגרה והילדים דחפו את הזוגיות הצידה, ובא לכם להחזיר ולשמור על האינטימיות והאהבה.',
    'When years together — routine and kids — pushed your relationship aside, and you want to restore the intimacy and love.', false)
ON CONFLICT (key) DO UPDATE
SET he_text = EXCLUDED.he_text,
    en_text = EXCLUDED.en_text;

COMMIT;
