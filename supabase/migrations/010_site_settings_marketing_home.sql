-- Site-wide marketing settings (homepage hero, expert, social proof)

CREATE TABLE IF NOT EXISTS public.site_settings (
  id integer PRIMARY KEY,
  updated_at timestamptz NOT NULL DEFAULT now(),

  home_hero_bg_type text NOT NULL DEFAULT 'gradient',
  home_hero_bg_value text NOT NULL DEFAULT 'default',

  expert_photo_url text,

  social_proof_couples_count integer NOT NULL DEFAULT 0,
  rating_value numeric NOT NULL DEFAULT 4.9,
  rating_count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Public read access (marketing homepage)
DROP POLICY IF EXISTS "site_settings_public_read" ON public.site_settings;
CREATE POLICY "site_settings_public_read"
  ON public.site_settings FOR SELECT
  USING (true);

-- Admin write access
DROP POLICY IF EXISTS "site_settings_admin_write" ON public.site_settings;
CREATE POLICY "site_settings_admin_write"
  ON public.site_settings FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Seed a single row (id=1)
INSERT INTO public.site_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS site_settings_set_updated_at ON public.site_settings;
CREATE TRIGGER site_settings_set_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Background assets can reuse the existing public `backgrounds` bucket (see 004_game_background.sql).
