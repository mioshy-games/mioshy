-- Admin dashboard schema: games, wheel_configs, questions, profiles.role, RLS, storage

-- ---------------------------------------------------------------------------
-- profiles: add role (table may already exist from Supabase templates)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

-- ---------------------------------------------------------------------------
-- games
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_he text NOT NULL,
  name_en text NOT NULL,
  description_he text NOT NULL DEFAULT '',
  description_en text NOT NULL DEFAULT '',
  slug text NOT NULL,
  thumbnail_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS games_slug_key ON public.games (slug);

-- ---------------------------------------------------------------------------
-- wheel_configs (1:1 with game)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wheel_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games (id) ON DELETE CASCADE,
  slices jsonb NOT NULL DEFAULT '[]'::jsonb,
  pointer_color text NOT NULL DEFAULT '#ffffff',
  inner_circle boolean NOT NULL DEFAULT true,
  inner_circle_color text NOT NULL DEFAULT '#ffffff',
  inner_circle_border_color text NOT NULL DEFAULT '#e5e5e5',
  border_color text NOT NULL DEFAULT '#ffffff',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS wheel_configs_game_id_key ON public.wheel_configs (game_id);

-- ---------------------------------------------------------------------------
-- questions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games (id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('truth', 'dare', 'custom')),
  level text NOT NULL CHECK (level IN ('light', 'flirty', 'deep')),
  text_he text NOT NULL,
  text_en text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS questions_game_id_idx ON public.questions (game_id);
CREATE INDEX IF NOT EXISTS questions_type_level_idx ON public.questions (type, level);

-- ---------------------------------------------------------------------------
-- Helper: is current user admin?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wheel_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- profiles: users read own row; updates typically via service - allow read own
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- games: admin full access
DROP POLICY IF EXISTS "games_admin_all" ON public.games;
CREATE POLICY "games_admin_all"
  ON public.games FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- wheel_configs: admin full access
DROP POLICY IF EXISTS "wheel_configs_admin_all" ON public.wheel_configs;
CREATE POLICY "wheel_configs_admin_all"
  ON public.wheel_configs FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- questions: public/authenticated read active; admin all
DROP POLICY IF EXISTS "questions_select_active" ON public.questions;
CREATE POLICY "questions_select_active"
  ON public.questions FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.id = questions.game_id AND g.is_active = true
    )
  );

DROP POLICY IF EXISTS "questions_admin_all" ON public.questions;
CREATE POLICY "questions_admin_all"
  ON public.questions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: thumbnails bucket
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "thumbnails_public_read" ON storage.objects;
CREATE POLICY "thumbnails_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'thumbnails');

DROP POLICY IF EXISTS "thumbnails_admin_insert" ON storage.objects;
CREATE POLICY "thumbnails_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'thumbnails' AND public.is_admin());

DROP POLICY IF EXISTS "thumbnails_admin_update" ON storage.objects;
CREATE POLICY "thumbnails_admin_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'thumbnails' AND public.is_admin());

DROP POLICY IF EXISTS "thumbnails_admin_delete" ON storage.objects;
CREATE POLICY "thumbnails_admin_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'thumbnails' AND public.is_admin());

-- ---------------------------------------------------------------------------
-- Duplicate game (atomic)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.duplicate_game(source_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_game_id uuid;
  g public.games%ROWTYPE;
  wc public.wheel_configs%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO g FROM public.games WHERE id = source_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'game not found';
  END IF;

  INSERT INTO public.games (name_he, name_en, description_he, description_en, slug, thumbnail_url, is_active)
  VALUES (
    g.name_he || ' - Copy',
    g.name_en || ' - Copy',
    g.description_he,
    g.description_en,
    g.slug || '-copy-' || substr(md5(random()::text), 1, 8),
    g.thumbnail_url,
    g.is_active
  )
  RETURNING id INTO new_game_id;

  SELECT * INTO wc FROM public.wheel_configs WHERE game_id = source_id;
  IF FOUND THEN
    INSERT INTO public.wheel_configs (game_id, slices, pointer_color, inner_circle, inner_circle_color, inner_circle_border_color, border_color)
    VALUES (
      new_game_id,
      wc.slices,
      wc.pointer_color,
      wc.inner_circle,
      wc.inner_circle_color,
      wc.inner_circle_border_color,
      wc.border_color
    );
  END IF;

  INSERT INTO public.questions (game_id, type, level, text_he, text_en, is_active)
  SELECT new_game_id, type, level, text_he, text_en, is_active
  FROM public.questions
  WHERE game_id = source_id;

  RETURN new_game_id;
END;
$$;

REVOKE ALL ON FUNCTION public.duplicate_game(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.duplicate_game(uuid) TO authenticated;
