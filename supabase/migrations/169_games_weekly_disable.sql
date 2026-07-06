-- ───────────────────────────────────────────────────────────────────────────
-- 169_games_weekly_disable.sql
--
-- Games subscriptions bill MONTHLY (36 ₪), not weekly (Itzik 2026-07-06). The
-- primary lever is code: the games paywall modal now sends plan="monthly", so
-- checkout resolves the games monthly price (36 ₪) and the 7-day trial snapshots
-- 36 ₪ as the day-7 charge. This migration is DEFENSE-IN-DEPTH: it disables the
-- games/weekly price row so that even a stale or spoofed plan="weekly" request
-- can't resolve to the 9 ₪ weekly charge — resolveCheckoutCadence falls back to
-- the enabled default (monthly). The row is kept (not deleted) so the "9 ₪ /
-- week" display framing and history stay intact.
--
-- ⚠️ RUN ONLY AFTER the Preview money-path test is approved and the code is
--    merged to prod. subscription_prices is the shared prod DB — applying this
--    changes production billing immediately.
--
-- Idempotent.
-- ───────────────────────────────────────────────────────────────────────────

UPDATE public.subscription_prices
   SET enabled = false,
       updated_at = now()
 WHERE product = 'games'
   AND cadence = 'weekly';
