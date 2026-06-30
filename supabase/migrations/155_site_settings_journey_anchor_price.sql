-- Stage-3 (homepage JourneyStages) marketing ANCHOR price — the struck-through
-- "old" price shown beside the live weekly headline. Previously a static CMS
-- literal (cms_texts: homeV2.journeyStages.stage3OriginalPrice = '127 ₪');
-- promoted here to an editable, structured marketing field so it stays an
-- admin-controlled lever, decoupled from subscription_prices (which drives the
-- live weekly/monthly figures). Edited in /dashboard/homepage.
--
-- NULL ⇒ the homepage falls back to the CMS literal, i.e. no visible change.
-- ILS only (the Stage-3 anchor renders ₪ in both he + en — see brief 2026-06-30).

alter table public.site_settings
  add column if not exists journey_anchor_price_ils numeric;

-- Backfill the current marketing anchor (the value the CMS literal carried).
update public.site_settings
   set journey_anchor_price_ils = 127
 where id = 1
   and journey_anchor_price_ils is null;

-- RLS: site_settings already has public-read + admin-write (FOR ALL) policies
-- and the updated_at trigger from migration 010 — no extra grants needed.
