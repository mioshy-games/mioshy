-- ───────────────────────────────────────────────────────────────────────────
-- 139_cms_texts_shared_header_join_cta.sql
--
-- Make the primary header CTA ("אני רוצה להצטרף" / "Join now") editable from
-- the admin without a deploy (Itzik 2026-06-22). The header is global
-- (components/SiteHeader.tsx, rendered by Chrome in app/[locale]/layout.tsx on
-- EVERY page), so this lives under page='shared' — the cross-route bucket — and
-- the locale layout loads loadCmsTextsForPage("shared") into a CmsTextProvider
-- that wraps Chrome. Plain text (is_rich=false): the label carries no markup, so
-- CmsText renders it as an escaped text node — no HTML-as-text trap.
-- Defaults mirror the next-intl JSON fallback (messages/{he,en}.json → header.joinCta).
-- Idempotent. The DO UPDATE sets is_rich too, so re-runs enforce plain mode
-- (per the cms_texts seed contract).
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  ('header.joinCta', 'shared', 'header',
   'אני רוצה להצטרף', 'Join now', false)
ON CONFLICT (key) DO UPDATE
  SET page    = EXCLUDED.page,
      section = EXCLUDED.section,
      he_text = EXCLUDED.he_text,
      en_text = EXCLUDED.en_text,
      is_rich = EXCLUDED.is_rich;
