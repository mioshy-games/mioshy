-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 019 – Game Settings System
-- ─────────────────────────────────────────────────────────────────────────────

-- ── global_settings ──────────────────────────────────────────────────────────
create table if not exists public.global_settings (
  id               integer primary key default 1,  -- singleton row
  default_settings jsonb  not null default '{}'::jsonb,
  version_history  jsonb  not null default '[]'::jsonb,
  updated_at       timestamptz not null default now(),
  constraint      global_settings_singleton check (id = 1)
);

-- Seed the singleton row
insert into public.global_settings (id, default_settings)
values (
  1,
  '{
    "border": {
      "enabled": true,
      "width": 3,
      "color": "#ffffff",
      "style": "solid",
      "distance": "attached"
    },
    "background": {
      "type": "color",
      "color": "#1e1b4b"
    },
    "motion": {
      "spinSpeed": 5,
      "movementSpeed": 5,
      "easing": "ease-out"
    },
    "shape": {
      "enabled": true,
      "type": "circle"
    }
  }'::jsonb
)
on conflict (id) do nothing;

-- ── game_settings ─────────────────────────────────────────────────────────────
create table if not exists public.game_settings (
  id              uuid primary key default gen_random_uuid(),
  game_id         uuid not null references public.games(id) on delete cascade,
  settings        jsonb not null default '{}'::jsonb,
  version_history jsonb not null default '[]'::jsonb,
  updated_at      timestamptz not null default now(),
  unique          (game_id)
);

-- ── settings_presets ──────────────────────────────────────────────────────────
create table if not exists public.settings_presets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  settings    jsonb not null,
  is_built_in boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Seed built-in presets
insert into public.settings_presets (name, description, settings, is_built_in) values
(
  'Fast Game',
  'High speed, snappy animations',
  '{
    "border": {"enabled":true,"width":3,"color":"#f59e0b","style":"solid","distance":"attached"},
    "background": {"type":"gradient","color":"#1e1b4b","gradient":{"from":"#f59e0b","to":"#ef4444"}},
    "motion": {"spinSpeed":9,"movementSpeed":8,"easing":"ease-out"},
    "shape": {"enabled":true,"type":"circle"}
  }'::jsonb,
  true
),
(
  'Kids Mode',
  'Soft colors, gentle animations',
  '{
    "border": {"enabled":true,"width":5,"color":"#fde68a","style":"dashed","distance":"near"},
    "background": {"type":"gradient","color":"#fef9c3","gradient":{"from":"#bfdbfe","to":"#fbcfe8"}},
    "motion": {"spinSpeed":3,"movementSpeed":3,"easing":"ease-in-out"},
    "shape": {"enabled":true,"type":"circle"}
  }'::jsonb,
  true
),
(
  'Minimal',
  'Clean, borderless, no-frills',
  '{
    "border": {"enabled":false,"width":0,"color":"transparent","style":"none","distance":"attached"},
    "background": {"type":"color","color":"#0f172a"},
    "motion": {"spinSpeed":5,"movementSpeed":5,"easing":"linear"},
    "shape": {"enabled":true,"type":"circle"}
  }'::jsonb,
  true
)
on conflict do nothing;

-- ── Row-Level Security ────────────────────────────────────────────────────────
alter table public.global_settings  enable row level security;
alter table public.game_settings    enable row level security;
alter table public.settings_presets enable row level security;

-- Admins can do everything on global_settings
create policy "Admins manage global settings" on public.global_settings
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admins can do everything on game_settings
create policy "Admins manage game settings" on public.game_settings
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Public can read global settings (needed for fallback resolution)
create policy "Public read global settings" on public.global_settings
  for select using (true);

-- Public can read presets
create policy "Public read presets" on public.settings_presets
  for select using (true);

-- Public can read game settings (needed to render games)
create policy "Public read game settings" on public.game_settings
  for select using (true);

-- ── Helper: auto-update updated_at ───────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_global_settings_updated_at
  before update on public.global_settings
  for each row execute function public.touch_updated_at();

create trigger trg_game_settings_updated_at
  before update on public.game_settings
  for each row execute function public.touch_updated_at();
