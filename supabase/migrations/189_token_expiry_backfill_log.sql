-- 189 — Backup + idempotency log for the 2026-07-14 token-expiry off-by-one fix.
--
-- Root cause: normalizeExpiry() read Cardcom's 8-digit TokenExDate (which is the
-- VALID-UNTIL date = the 1st of the month AFTER the card's printed expiry) as the
-- literal expiry month, so every tokenized card was stored + charged ONE MONTH
-- TOO HIGH → acquirer decline 60000004. Proven live on card 5336 (05/32 declined,
-- 04/32 → RC 0). The code fix corrects new tokenizations; this table backs the
-- ONE-TIME backfill of existing rows (subtract one month).
--
-- Dual purpose:
--   • BACKUP  — original_expiry_mmyy is the before-image (rollback source).
--   • IDEMPOTENCY — a row here means that payment method was already corrected,
--     so re-running the backfill SKIPS it (a double month-decrement would corrupt
--     the data). NEVER delete rows from this table to "re-run" a correction.
create table if not exists public.token_expiry_backfill_log (
  payment_method_id    uuid primary key
    references public.customer_payment_methods(id) on delete cascade,
  original_expiry_mmyy text        not null,
  new_expiry_mmyy      text        not null,
  applied_at           timestamptz not null default now()
);

-- Service-role only (no policies) — same posture as the other billing tables.
alter table public.token_expiry_backfill_log enable row level security;
