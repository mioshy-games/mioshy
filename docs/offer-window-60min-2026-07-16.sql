-- Change 1 (offer window → 60 minutes). Apply in the Supabase SQL editor AFTER
-- Itzik approves. This is a config-only change (no code): personal_window_hours
-- is read by getPersonalWindowConfig and used at short-assessment completion to
-- stamp journeys.offer_expires_at = now + hours. It applies to NEW completions
-- only (users already inside a window keep theirs). Admin-editable range is
-- 1..720; 1 = a 60-minute window. The on-screen PersonalOfferTimer reads
-- offer_expires_at, so a new completion will show a ~60-minute countdown.

update public.site_settings
set personal_window_hours = 1
where id = (select id from public.site_settings order by id limit 1);

-- Verify:
-- select personal_window_hours, personal_window_display, promo_mode from public.site_settings;
