-- Per-game background config (color or image) + Storage bucket for backgrounds

-- ---------------------------------------------------------------------------
-- games: background config
-- ---------------------------------------------------------------------------
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS bg_type text NOT NULL DEFAULT 'color';

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS bg_value text NOT NULL DEFAULT '#0b0b0f';

ALTER TABLE public.games
  DROP CONSTRAINT IF EXISTS games_bg_type_check;

ALTER TABLE public.games
  ADD CONSTRAINT games_bg_type_check CHECK (bg_type IN ('color', 'image'));

-- ---------------------------------------------------------------------------
-- Storage: backgrounds bucket
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('backgrounds', 'backgrounds', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "backgrounds_public_read" ON storage.objects;
CREATE POLICY "backgrounds_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'backgrounds');

DROP POLICY IF EXISTS "backgrounds_admin_insert" ON storage.objects;
CREATE POLICY "backgrounds_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'backgrounds' AND public.is_admin());

DROP POLICY IF EXISTS "backgrounds_admin_update" ON storage.objects;
CREATE POLICY "backgrounds_admin_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'backgrounds' AND public.is_admin());

DROP POLICY IF EXISTS "backgrounds_admin_delete" ON storage.objects;
CREATE POLICY "backgrounds_admin_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'backgrounds' AND public.is_admin());

