-- ============================================================
-- 060_journey_notifications_v2.sql
-- Slice 10 — extend journey_notifications for the in-app inbox,
-- reminder cron, admin alerts, and stuck-user digest.
--
-- Migration 056 created the table with 4 message-related kinds and
-- two recipient_kinds (user, expert_pool). Slice 10 expands both:
--
--   recipient_kind: + 'admin_pool' (for cron failures + stuck digest)
--   kind:           + 'item_unlocked'
--                   + 'expert_push_landed'
--                   + 'subscription_grace_started'
--                   + 'subscription_blocked'
--                   + 'reminder_inactivity'
--                   + 'reminder_unfollowed_reply'
--                   + 'cron_failure'
--                   + 'stuck_users_digest'
--
-- Renames: none. Existing message-related kinds stay as-is; the UI
-- maps them to the slice-10 display labels via lib/notifications/labels.
-- ============================================================

begin;

alter table public.journey_notifications
  drop constraint if exists journey_notifications_recipient_kind_check;
alter table public.journey_notifications
  add constraint journey_notifications_recipient_kind_check
  check (recipient_kind in ('user', 'expert_pool', 'admin_pool'));

alter table public.journey_notifications
  drop constraint if exists journey_notifications_kind_check;
alter table public.journey_notifications
  add constraint journey_notifications_kind_check
  check (kind in (
    -- slice 6 (existing)
    'item_message_user_posted',
    'item_message_expert_replied',
    'channel_message_user_posted',
    'channel_message_expert_replied',
    -- slice 10
    'item_unlocked',
    'expert_push_landed',
    'subscription_grace_started',
    'subscription_blocked',
    'reminder_inactivity',
    'reminder_unfollowed_reply',
    'cron_failure',
    'stuck_users_digest'
  ));

-- New index: admin-pool unread reads. The health board surfaces
-- failure alerts from this lookup.
create index if not exists journey_notifications_admin_unread_idx
  on public.journey_notifications (created_at desc)
  where recipient_kind = 'admin_pool' and read_at is null;

-- New index: per-user-and-kind throttle lookup. Reminder cron asks
-- "did this user already get a reminder_inactivity in the last 5
-- days?"; throttled email sends ask "did we send a cron_failure
-- email for this job in the last 6h?". Both pivot on (kind, time).
create index if not exists journey_notifications_kind_recent_idx
  on public.journey_notifications (kind, created_at desc);

comment on column public.journey_notifications.recipient_kind is
  'user (single inbox) | expert_pool (one shared address) | admin_pool (cron alerts + digests, fans to JOURNEY_ADMIN_ALERT_EMAIL).';

-- Slice 10 also added the daily reminders cron; extend the
-- journey_cron_runs job_name CHECK to permit it.
alter table public.journey_cron_runs
  drop constraint if exists journey_cron_runs_job_name_check;
alter table public.journey_cron_runs
  add constraint journey_cron_runs_job_name_check
  check (job_name in (
    'cadence_advance',
    'notify_unlocks',
    'grace_watcher',
    'scores_recompute',
    'reminders'
  ));

commit;

select pg_notify('pgrst', 'reload schema');
