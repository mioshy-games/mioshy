-- 031_hero_template.sql
-- Adds a pluggable "hero template" slot to site_settings so the admin can
-- swap between the classic-dark (a0f6258 revival) and the current light
-- gradient hero, and provides a per-template side image slot (wheel art).
--
-- Idempotent - safe to re-run.

alter table public.site_settings
  add column if not exists hero_template text
    check (hero_template in ('classic-dark', 'light-gradient'))
    default 'classic-dark'
    not null;

alter table public.site_settings
  add column if not exists hero_side_image_url text;

-- Default existing row to 'classic-dark' (user requested restoration of the
-- old hero as the default). If the row was seeded before this column
-- existed, make sure the value is populated.
update public.site_settings
set hero_template = coalesce(hero_template, 'classic-dark')
where id = 1;

comment on column public.site_settings.hero_template is
  'Active hero template for the public homepage: classic-dark | light-gradient';
comment on column public.site_settings.hero_side_image_url is
  'Optional image used alongside the hero (e.g. wheel art in classic-dark).';
