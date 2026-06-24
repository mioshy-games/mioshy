-- ───────────────────────────────────────────────────────────────────────────
-- 144_journey_short_coverage.sql
--
-- Expand the SHORT assessment from 11 → 14 questions and fix the family-domain
-- scoring blind spot.
--
-- WHY: the family category scores from two axes — shared_meaning + passion_context
-- (lib/journey/analysis.ts FAMILY_AXES). In the short set the only family signal
-- was q17_context_logistics, a REVERSE item on passion_context (negative weight).
-- So answering "1" everywhere inverted to passion_context=1.0 and shared_meaning
-- had no coverage → family scored 100 (misleading). This adds a POSITIVE
-- passion_context item to balance q17, and promotes the shared_meaning item
-- (q19) and the contempt item (q11) into the short set so both family axes and
-- the contempt signal have real short-phase coverage.
--
-- Idempotent:
--   • new question upserts on slug (re-run safe; restores seed values).
--   • the two phase promotions are plain UPDATEs (no duplication — they flip a
--     field on the EXISTING single row, never insert a copy).
-- phaseTotal is DB-driven, so the short count becomes 14 automatically.
--
-- Apply manually on prod (no auto-runner).
-- ───────────────────────────────────────────────────────────────────────────

-- 1. New positive family/passion_context item (balances q17's reverse item).
INSERT INTO public.journey_questions
  (slug, position, phase, type, domain, axes, reverse, he_text, en_text, options, meta)
VALUES
  ( 'q_family_quality_presence', 18, 'short', 'likert5', 'family',
    $x$[{"axis":"passion_context","weight":1.0}]$x$::jsonb, false,
    $x$כשיש לנו זמן רק לשנינו, באיזו תדירות הוא מרגיש כמו זמן איכות אמיתי שאנחנו באמת נוכחים בו?$x$,
    $x$When we finally get time just for the two of us, how often does it feel like real quality time we're truly present in?$x$,
    NULL,
    $x${"purpose":"Passion - context (POSITIVE). Balances q17's reverse logistics item so the family category has real two-sided coverage in the short set.","insight":"High = present, real quality time; low = together but not truly present."}$x$::jsonb )
ON CONFLICT (slug) DO UPDATE
  SET position  = EXCLUDED.position,
      phase     = EXCLUDED.phase,
      type      = EXCLUDED.type,
      domain    = EXCLUDED.domain,
      axes      = EXCLUDED.axes,
      reverse   = EXCLUDED.reverse,
      he_text   = EXCLUDED.he_text,
      en_text   = EXCLUDED.en_text,
      meta      = EXCLUDED.meta,
      is_active = true;

-- 2. Promote two existing questions full → short (field-only; no row copy).
UPDATE public.journey_questions
  SET phase = 'short'
  WHERE slug IN ('q19_rituals', 'q11_contempt');
