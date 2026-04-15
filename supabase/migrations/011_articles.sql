-- Articles/blog system: public articles + admin management + SEO + storage

CREATE TABLE IF NOT EXISTS public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,

  title_he text,
  title_en text,
  excerpt_he text,
  excerpt_en text,
  content_he text,
  content_en text,

  cover_image_url text,
  author text NOT NULL DEFAULT 'Itzik Berlav',

  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,

  -- SEO
  meta_title_he text,
  meta_title_en text,
  meta_description_he text,
  meta_description_en text,
  canonical_url text,
  og_image_url text,

  -- Content management
  tags text[] NOT NULL DEFAULT '{}'::text[],
  reading_time_minutes integer,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS articles_slug_key ON public.articles (slug);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Public: read only published articles
DROP POLICY IF EXISTS "articles_public_select_published" ON public.articles;
CREATE POLICY "articles_public_select_published"
  ON public.articles FOR SELECT
  USING (is_published = true);

-- Admin: full access
DROP POLICY IF EXISTS "articles_admin_all" ON public.articles;
CREATE POLICY "articles_admin_all"
  ON public.articles FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: article-covers bucket
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('article-covers', 'article-covers', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "article_covers_public_read" ON storage.objects;
CREATE POLICY "article_covers_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'article-covers');

DROP POLICY IF EXISTS "article_covers_admin_insert" ON storage.objects;
CREATE POLICY "article_covers_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'article-covers' AND public.is_admin());

DROP POLICY IF EXISTS "article_covers_admin_update" ON storage.objects;
CREATE POLICY "article_covers_admin_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'article-covers' AND public.is_admin());

DROP POLICY IF EXISTS "article_covers_admin_delete" ON storage.objects;
CREATE POLICY "article_covers_admin_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'article-covers' AND public.is_admin());

