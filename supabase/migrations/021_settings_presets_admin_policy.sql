-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 021 – Allow admins to manage settings_presets (RLS)
-- ─────────────────────────────────────────────────────────────────────────────

-- settings_presets already has RLS enabled in migration 019.
-- It currently only allows public SELECT, so INSERT/UPDATE/DELETE are blocked.

do $$
begin
  -- Drop any existing policy with same name (safe re-run)
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'settings_presets'
      and policyname = 'Admins manage presets'
  ) then
    execute 'drop policy "Admins manage presets" on public.settings_presets';
  end if;
end $$;

create policy "Admins manage presets" on public.settings_presets
  for all
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

