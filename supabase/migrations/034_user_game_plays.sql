-- ============================================================
-- 034_user_game_plays.sql
-- Per-game play tracking for logged-in users.
--
-- Until now `profiles.spins_used` tracked a single global budget for
-- free plays across every game. Product direction changed: each game
-- should have its own independent free-play budget (3 rounds) before we
-- ask the user to subscribe / purchase. This lets a logged-in user try
-- multiple games without being paywalled after 3 total plays.
--
-- Extra fields on each row:
--   * `plays_used`              → counter, reset weekly like the legacy global one
--   * `last_reset_at`           → drives the weekly auto-reset
--   * `post_signup_bonus_used`  → ensures the "extra 3 plays after signup"
--                                  bonus fires exactly once per (user, game)
--
-- The legacy global column stays in place for now but is no longer read -
-- the pre-launch rule against backwards-compat shims means we can drop it
-- later once the client is fully migrated (tracked separately).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Table
-- ------------------------------------------------------------

create table if not exists public.user_game_plays (
  id                      uuid        primary key default gen_random_uuid(),
  user_id                 uuid        not null references auth.users(id) on delete cascade,
  game_slug               text        not null,
  plays_used              integer     not null default 0,
  post_signup_bonus_used  boolean     not null default false,
  last_reset_at           timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (user_id, game_slug)
);

create index if not exists user_game_plays_user_idx
  on public.user_game_plays (user_id);

create index if not exists user_game_plays_slug_idx
  on public.user_game_plays (game_slug);

-- Keep updated_at fresh on every row-level change (consistent with other tables).
drop trigger if exists trg_user_game_plays_touch on public.user_game_plays;
create trigger trg_user_game_plays_touch
  before update on public.user_game_plays
  for each row execute function public.touch_updated_at();


-- ------------------------------------------------------------
-- 2) RLS
-- ------------------------------------------------------------

alter table public.user_game_plays enable row level security;

drop policy if exists "user_game_plays: self select" on public.user_game_plays;
create policy "user_game_plays: self select"
  on public.user_game_plays
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_game_plays: admin select" on public.user_game_plays;
create policy "user_game_plays: admin select"
  on public.user_game_plays
  for select
  to authenticated
  using (public.is_admin());

-- Inserts & updates go through SECURITY DEFINER RPCs below; plain writes
-- are not exposed to PostgREST.


-- ------------------------------------------------------------
-- 3) RPCs
-- ------------------------------------------------------------

-- get_user_game_plays: fetch (plays_used, bonus_used) for current user + slug,
-- auto-resetting weekly. Creates the row if it does not exist.
create or replace function public.get_user_game_plays(
  p_game_slug text
)
returns table (
  plays_used              integer,
  post_signup_bonus_used  boolean,
  last_reset_at           timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid := auth.uid();
  v_now      timestamptz := now();
  v_row      public.user_game_plays%rowtype;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if p_game_slug is null or length(trim(p_game_slug)) = 0 then
    raise exception 'missing_game_slug';
  end if;

  -- Upsert-get pattern: insert if missing, otherwise read.
  insert into public.user_game_plays (user_id, game_slug)
  values (v_user_id, p_game_slug)
  on conflict (user_id, game_slug) do nothing;

  select * into v_row
  from public.user_game_plays
  where user_id = v_user_id and game_slug = p_game_slug
  for update;

  -- 7-day weekly reset.
  if v_row.last_reset_at is null
     or (v_now - v_row.last_reset_at) > interval '7 days' then
    update public.user_game_plays
    set plays_used    = 0,
        last_reset_at = v_now
    where id = v_row.id
    returning * into v_row;
  end if;

  plays_used             := v_row.plays_used;
  post_signup_bonus_used := v_row.post_signup_bonus_used;
  last_reset_at          := v_row.last_reset_at;
  return next;
end;
$$;

grant execute on function public.get_user_game_plays(text) to authenticated;


-- increment_user_game_plays: atomically bump plays_used by 1 (with weekly
-- reset applied first) and return the new value.
create or replace function public.increment_user_game_plays(
  p_game_slug text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid := auth.uid();
  v_now      timestamptz := now();
  v_row      public.user_game_plays%rowtype;
  v_next     integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if p_game_slug is null or length(trim(p_game_slug)) = 0 then
    raise exception 'missing_game_slug';
  end if;

  insert into public.user_game_plays (user_id, game_slug)
  values (v_user_id, p_game_slug)
  on conflict (user_id, game_slug) do nothing;

  select * into v_row
  from public.user_game_plays
  where user_id = v_user_id and game_slug = p_game_slug
  for update;

  if v_row.last_reset_at is null
     or (v_now - v_row.last_reset_at) > interval '7 days' then
    update public.user_game_plays
    set plays_used    = 1,
        last_reset_at = v_now
    where id = v_row.id
    returning plays_used into v_next;
  else
    update public.user_game_plays
    set plays_used = v_row.plays_used + 1
    where id = v_row.id
    returning plays_used into v_next;
  end if;

  return v_next;
end;
$$;

grant execute on function public.increment_user_game_plays(text) to authenticated;


-- grant_post_signup_bonus: marks that the +3 post-signup bonus has been
-- awarded for this (user, game) AND rolls plays_used back by 3 so the
-- caller instantly regains a fresh window. Idempotent: returns the new
-- plays_used; subsequent calls are a no-op.
create or replace function public.grant_post_signup_bonus(
  p_game_slug text
)
returns table (
  plays_used              integer,
  post_signup_bonus_used  boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid := auth.uid();
  v_row      public.user_game_plays%rowtype;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if p_game_slug is null or length(trim(p_game_slug)) = 0 then
    raise exception 'missing_game_slug';
  end if;

  insert into public.user_game_plays (user_id, game_slug)
  values (v_user_id, p_game_slug)
  on conflict (user_id, game_slug) do nothing;

  select * into v_row
  from public.user_game_plays
  where user_id = v_user_id and game_slug = p_game_slug
  for update;

  if v_row.post_signup_bonus_used then
    plays_used             := v_row.plays_used;
    post_signup_bonus_used := true;
    return next;
    return;
  end if;

  -- Grant the bonus: clamp plays_used back to zero (fresh 3-play window)
  -- and set the flag so this cannot be re-triggered.
  update public.user_game_plays
  set plays_used             = 0,
      post_signup_bonus_used = true,
      last_reset_at          = now()
  where id = v_row.id
  returning user_game_plays.plays_used, user_game_plays.post_signup_bonus_used
    into plays_used, post_signup_bonus_used;

  return next;
end;
$$;

grant execute on function public.grant_post_signup_bonus(text) to authenticated;
