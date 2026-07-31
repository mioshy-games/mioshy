-- 193 — Track when a chapter was first opened.
--
-- The board needs three distinct visual states (Itzik 2026-07-31):
--   not opened · opened · marked done
-- Completion already lives on the row; "opened" did not exist, so a chapter the
-- user had read looked identical to one they had never touched.
--
-- Stamped once, on first view of /journey/chapter/[cycleItemId]. Never cleared
-- by the user — an admin resetting a completion mark (§5) leaves this alone,
-- because "they read it" stays true regardless of the checkbox.

begin;

alter table public.journey_cycle_items
  add column if not exists opened_at timestamptz;

comment on column public.journey_cycle_items.opened_at is
  'First time the user opened this chapter. Drives the middle visual state on the board.';

commit;
