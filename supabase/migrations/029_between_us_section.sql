-- ============================================================
-- 029_between_us_section.sql
-- "Between Us" (בינינו) - couples-games content section
--
-- Adds a new product line alongside the existing wheel/snakes games:
--   * Couple-ownership model (couples + couple_members)
--   * Experience games (dual-lang content with SEO meta)
--   * Categories & tags (fully admin-managed)
--   * Entitlements (couple-level ownership of purchased games)
--   * Subscription monthly picks (one free game per month)
--   * Promotions (Buy-X-Get-X, toggleable from admin)
--   * Between-us settings (single-row, all dynamic toggles)
--
-- Conventions followed from existing migrations (001, 012, 016):
--   * uuid PKs via gen_random_uuid()
--   * timestamptz with DEFAULT now()
--   * bilingual fields suffixed _he / _en
--   * is_active boolean flags
--   * public.is_admin() for admin RLS
--   * DROP POLICY IF EXISTS → CREATE POLICY pattern
-- ============================================================


-- ============================================================
-- SECTION 1 - COUPLES + COUPLE MEMBERSHIP
-- ============================================================

-- 1.1 couples: a pairing entity that owns purchases
CREATE TABLE IF NOT EXISTS public.couples (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_code   text        NOT NULL,
  created_by  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,                                  -- optional "The Smiths" etc
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 6-character uppercase alphanumeric pair code, unique while active
CREATE UNIQUE INDEX IF NOT EXISTS couples_pair_code_key
  ON public.couples (pair_code)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS couples_created_by_idx ON public.couples (created_by);


-- 1.2 couple_members: who belongs to which couple
CREATE TABLE IF NOT EXISTS public.couple_members (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id  uuid        NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text        NOT NULL DEFAULT 'partner',
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (couple_id, user_id)
);

ALTER TABLE public.couple_members
  DROP CONSTRAINT IF EXISTS couple_members_role_check;
ALTER TABLE public.couple_members
  ADD CONSTRAINT couple_members_role_check CHECK (role IN ('owner', 'partner'));

-- A user belongs to at most one ACTIVE couple at a time
CREATE UNIQUE INDEX IF NOT EXISTS couple_members_user_unique_active
  ON public.couple_members (user_id)
  WHERE couple_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS couple_members_couple_idx ON public.couple_members (couple_id);


-- 1.3 Helper: is current user member of this couple?
CREATE OR REPLACE FUNCTION public.is_couple_member(p_couple_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.couple_members cm
    WHERE cm.couple_id = p_couple_id
      AND cm.user_id = auth.uid()
  );
$$;


-- 1.4 Helper: current user's couple_id (NULL if not in a couple)
CREATE OR REPLACE FUNCTION public.current_couple_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cm.couple_id
  FROM public.couple_members cm
  WHERE cm.user_id = auth.uid()
  LIMIT 1;
$$;


-- 1.5 Helper: generate a fresh unique pair_code (6 chars, uppercase A-Z0-9, no ambiguous O/0/I/1)
CREATE OR REPLACE FUNCTION public.generate_pair_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code  text;
  exists_code boolean;
  tries integer := 0;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;

    SELECT EXISTS (
      SELECT 1 FROM public.couples
      WHERE pair_code = code AND is_active = true
    ) INTO exists_code;

    EXIT WHEN NOT exists_code;

    tries := tries + 1;
    IF tries > 50 THEN
      RAISE EXCEPTION 'could not generate unique pair_code after 50 attempts';
    END IF;
  END LOOP;

  RETURN code;
END;
$$;


-- 1.6 RPC: create a couple for the current user (owner role)
--     Used at first signup or when user explicitly creates a couple
CREATE OR REPLACE FUNCTION public.create_couple_for_current_user(p_display_name text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_couple_id uuid;
  v_pair_code text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- If user already in a couple, return it (idempotent)
  SELECT couple_id INTO v_couple_id
  FROM public.couple_members
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_couple_id IS NOT NULL THEN
    RETURN v_couple_id;
  END IF;

  v_pair_code := public.generate_pair_code();

  INSERT INTO public.couples (pair_code, created_by, display_name)
  VALUES (v_pair_code, v_user_id, p_display_name)
  RETURNING id INTO v_couple_id;

  INSERT INTO public.couple_members (couple_id, user_id, role)
  VALUES (v_couple_id, v_user_id, 'owner');

  RETURN v_couple_id;
END;
$$;


-- 1.7 RPC: join an existing couple by pair_code
--     Used when partner enters the code to link accounts
CREATE OR REPLACE FUNCTION public.join_couple_by_pair_code(p_pair_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_couple_id uuid;
  v_existing_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_pair_code IS NULL OR length(p_pair_code) <> 6 THEN
    RAISE EXCEPTION 'invalid pair_code';
  END IF;

  -- Find active couple by code
  SELECT id INTO v_couple_id
  FROM public.couples
  WHERE pair_code = upper(p_pair_code)
    AND is_active = true
  LIMIT 1;

  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'pair_code not found';
  END IF;

  -- User must not already be in another couple
  SELECT count(*) INTO v_existing_count
  FROM public.couple_members
  WHERE user_id = v_user_id;

  IF v_existing_count > 0 THEN
    RAISE EXCEPTION 'user already belongs to a couple';
  END IF;

  -- Couple must have room (max 2 members)
  SELECT count(*) INTO v_existing_count
  FROM public.couple_members
  WHERE couple_id = v_couple_id;

  IF v_existing_count >= 2 THEN
    RAISE EXCEPTION 'couple is full';
  END IF;

  INSERT INTO public.couple_members (couple_id, user_id, role)
  VALUES (v_couple_id, v_user_id, 'partner');

  RETURN v_couple_id;
END;
$$;


-- 1.8 RLS - couples
ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "couples_select_member" ON public.couples;
CREATE POLICY "couples_select_member"
  ON public.couples FOR SELECT
  USING (
    public.is_couple_member(id)
    OR public.is_admin()
  );

-- Insert only via create_couple_for_current_user RPC; direct inserts blocked
DROP POLICY IF EXISTS "couples_insert_none" ON public.couples;
CREATE POLICY "couples_insert_none"
  ON public.couples FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "couples_update_owner" ON public.couples;
CREATE POLICY "couples_update_owner"
  ON public.couples FOR UPDATE
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = couples.id
        AND cm.user_id = auth.uid()
        AND cm.role = 'owner'
    )
  );

DROP POLICY IF EXISTS "couples_admin_delete" ON public.couples;
CREATE POLICY "couples_admin_delete"
  ON public.couples FOR DELETE
  USING (public.is_admin());


-- 1.9 RLS - couple_members
ALTER TABLE public.couple_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "couple_members_select_own" ON public.couple_members;
CREATE POLICY "couple_members_select_own"
  ON public.couple_members FOR SELECT
  USING (
    public.is_couple_member(couple_id)
    OR public.is_admin()
  );

-- Insert only via RPCs above; direct inserts blocked from clients
DROP POLICY IF EXISTS "couple_members_admin_insert" ON public.couple_members;
CREATE POLICY "couple_members_admin_insert"
  ON public.couple_members FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "couple_members_admin_update" ON public.couple_members;
CREATE POLICY "couple_members_admin_update"
  ON public.couple_members FOR UPDATE
  USING (public.is_admin());

DROP POLICY IF EXISTS "couple_members_self_or_admin_delete" ON public.couple_members;
CREATE POLICY "couple_members_self_or_admin_delete"
  ON public.couple_members FOR DELETE
  USING (
    public.is_admin()
    OR user_id = auth.uid()
  );


-- ============================================================
-- SECTION 2 - EXPERIENCE GAMES (content catalog)
-- ============================================================

-- 2.1 experience_games: the game catalog (bilingual + SEO)
CREATE TABLE IF NOT EXISTS public.experience_games (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  text        NOT NULL,

  -- Bilingual display
  title_he              text        NOT NULL,
  title_en              text        NOT NULL DEFAULT '',
  short_desc_he         text        NOT NULL DEFAULT '',
  short_desc_en         text        NOT NULL DEFAULT '',
  full_desc_he          text        NOT NULL DEFAULT '',
  full_desc_en          text        NOT NULL DEFAULT '',

  -- SEO meta (bilingual)
  meta_title_he         text,
  meta_title_en         text,
  meta_description_he   text,
  meta_description_en   text,

  -- Structured sections (jsonb arrays of strings, bilingual)
  benefits_he           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  benefits_en           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  target_audience_he    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  target_audience_en    jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- Media
  cover_image_url       text,
  gallery               jsonb       NOT NULL DEFAULT '[]'::jsonb,
  intimacy_badge_url    text,       -- admin-uploaded WebP per-game
  communication_badge_url text,
  heat_badge_url        text,

  -- Experience metrics (1-5 scale, displayed via badges)
  intimacy_level        integer     NOT NULL DEFAULT 3,
  communication_level   integer     NOT NULL DEFAULT 3,
  heat_level            integer     NOT NULL DEFAULT 3,

  -- Pricing (kept per-game so admin can price individually;
  -- falls back to between_us_settings defaults if NULL)
  price_ils             numeric(10,2),
  price_usd             numeric(10,2),

  -- Flags
  is_new                boolean     NOT NULL DEFAULT false,
  is_popular            boolean     NOT NULL DEFAULT false,
  is_subscription_eligible boolean  NOT NULL DEFAULT true,
  is_active             boolean     NOT NULL DEFAULT false,   -- off by default until admin publishes

  -- Ordering hint for the library grid
  sort_weight           integer     NOT NULL DEFAULT 0,

  published_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS experience_games_slug_key
  ON public.experience_games (slug);

CREATE INDEX IF NOT EXISTS experience_games_active_idx
  ON public.experience_games (is_active, sort_weight DESC);

CREATE INDEX IF NOT EXISTS experience_games_published_idx
  ON public.experience_games (published_at DESC)
  WHERE is_active = true;

-- Scale constraints (1-5)
ALTER TABLE public.experience_games
  DROP CONSTRAINT IF EXISTS experience_games_intimacy_level_check;
ALTER TABLE public.experience_games
  ADD CONSTRAINT experience_games_intimacy_level_check
  CHECK (intimacy_level BETWEEN 1 AND 5);

ALTER TABLE public.experience_games
  DROP CONSTRAINT IF EXISTS experience_games_communication_level_check;
ALTER TABLE public.experience_games
  ADD CONSTRAINT experience_games_communication_level_check
  CHECK (communication_level BETWEEN 1 AND 5);

ALTER TABLE public.experience_games
  DROP CONSTRAINT IF EXISTS experience_games_heat_level_check;
ALTER TABLE public.experience_games
  ADD CONSTRAINT experience_games_heat_level_check
  CHECK (heat_level BETWEEN 1 AND 5);


-- 2.2 experience_game_categories: admin-managed taxonomy
CREATE TABLE IF NOT EXISTS public.experience_game_categories (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text        NOT NULL,
  name_he         text        NOT NULL,
  name_en         text        NOT NULL DEFAULT '',
  description_he  text        NOT NULL DEFAULT '',
  description_en  text        NOT NULL DEFAULT '',
  icon_url        text,
  color_hex       text,
  sort_weight     integer     NOT NULL DEFAULT 0,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS experience_game_categories_slug_key
  ON public.experience_game_categories (slug);


-- 2.3 experience_game_tags: admin-managed taxonomy (interests)
CREATE TABLE IF NOT EXISTS public.experience_game_tags (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text        NOT NULL,
  name_he     text        NOT NULL,
  name_en     text        NOT NULL DEFAULT '',
  color_hex   text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS experience_game_tags_slug_key
  ON public.experience_game_tags (slug);


-- 2.4 m2m: games <-> categories
CREATE TABLE IF NOT EXISTS public.experience_games_x_categories (
  game_id     uuid NOT NULL REFERENCES public.experience_games(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.experience_game_categories(id) ON DELETE CASCADE,
  sort_weight integer NOT NULL DEFAULT 0,
  PRIMARY KEY (game_id, category_id)
);

CREATE INDEX IF NOT EXISTS exg_x_cat_category_idx
  ON public.experience_games_x_categories (category_id);


-- 2.5 m2m: games <-> tags
CREATE TABLE IF NOT EXISTS public.experience_games_x_tags (
  game_id uuid NOT NULL REFERENCES public.experience_games(id) ON DELETE CASCADE,
  tag_id  uuid NOT NULL REFERENCES public.experience_game_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (game_id, tag_id)
);

CREATE INDEX IF NOT EXISTS exg_x_tag_tag_idx
  ON public.experience_games_x_tags (tag_id);


-- 2.6 experience_game_content: the actual text content, per level
-- Level values per Itzik 2026-04-20:
--   'מרגש' (emotional/moving) | 'מעורר' (arousing) | 'ללא_גבולות' (no-limits, 18+)
CREATE TABLE IF NOT EXISTS public.experience_game_content (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     uuid        NOT NULL REFERENCES public.experience_games(id) ON DELETE CASCADE,
  level       text        NOT NULL,
  order_index integer     NOT NULL DEFAULT 0,

  -- Bilingual content (supports MDX/markdown in body)
  title_he    text        NOT NULL DEFAULT '',
  title_en    text        NOT NULL DEFAULT '',
  body_he     text        NOT NULL DEFAULT '',
  body_en     text        NOT NULL DEFAULT '',

  -- Preview flag: if true, visible to non-purchasers on the product page
  is_preview  boolean     NOT NULL DEFAULT false,
  is_active   boolean     NOT NULL DEFAULT true,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.experience_game_content
  DROP CONSTRAINT IF EXISTS experience_game_content_level_check;
ALTER TABLE public.experience_game_content
  ADD CONSTRAINT experience_game_content_level_check
  CHECK (level IN ('מרגש', 'מעורר', 'ללא_גבולות'));

CREATE INDEX IF NOT EXISTS experience_game_content_game_idx
  ON public.experience_game_content (game_id, level, order_index);

CREATE INDEX IF NOT EXISTS experience_game_content_preview_idx
  ON public.experience_game_content (game_id)
  WHERE is_preview = true AND is_active = true;


-- 2.7 RLS - experience_games + taxonomy
ALTER TABLE public.experience_games            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_game_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_game_tags        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_games_x_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_games_x_tags     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_game_content     ENABLE ROW LEVEL SECURITY;

-- Public read active games
DROP POLICY IF EXISTS "exp_games_public_read_active" ON public.experience_games;
CREATE POLICY "exp_games_public_read_active"
  ON public.experience_games FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "exp_games_admin_all" ON public.experience_games;
CREATE POLICY "exp_games_admin_all"
  ON public.experience_games FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Public read active categories
DROP POLICY IF EXISTS "exp_cat_public_read_active" ON public.experience_game_categories;
CREATE POLICY "exp_cat_public_read_active"
  ON public.experience_game_categories FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "exp_cat_admin_all" ON public.experience_game_categories;
CREATE POLICY "exp_cat_admin_all"
  ON public.experience_game_categories FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Public read active tags
DROP POLICY IF EXISTS "exp_tag_public_read_active" ON public.experience_game_tags;
CREATE POLICY "exp_tag_public_read_active"
  ON public.experience_game_tags FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "exp_tag_admin_all" ON public.experience_game_tags;
CREATE POLICY "exp_tag_admin_all"
  ON public.experience_game_tags FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Junctions: public read if parent game is active; admin full
DROP POLICY IF EXISTS "exp_x_cat_public_read" ON public.experience_games_x_categories;
CREATE POLICY "exp_x_cat_public_read"
  ON public.experience_games_x_categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.experience_games g
      WHERE g.id = experience_games_x_categories.game_id
        AND g.is_active = true
    )
  );

DROP POLICY IF EXISTS "exp_x_cat_admin_all" ON public.experience_games_x_categories;
CREATE POLICY "exp_x_cat_admin_all"
  ON public.experience_games_x_categories FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "exp_x_tag_public_read" ON public.experience_games_x_tags;
CREATE POLICY "exp_x_tag_public_read"
  ON public.experience_games_x_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.experience_games g
      WHERE g.id = experience_games_x_tags.game_id
        AND g.is_active = true
    )
  );

DROP POLICY IF EXISTS "exp_x_tag_admin_all" ON public.experience_games_x_tags;
CREATE POLICY "exp_x_tag_admin_all"
  ON public.experience_games_x_tags FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Content: preview rows public; full content only to couple members with entitlement
-- Entitlement check happens server-side in API routes using is_admin or couple entitlement joins;
-- for RLS-level SELECT, we allow:
--   * Preview rows for anyone (if game is_active)
--   * Full content for admins
--   * Full content for members of a couple with an entitlement for this game (joined below)
DROP POLICY IF EXISTS "exp_content_public_preview" ON public.experience_game_content;
CREATE POLICY "exp_content_public_preview"
  ON public.experience_game_content FOR SELECT
  USING (
    is_active = true
    AND is_preview = true
    AND EXISTS (
      SELECT 1 FROM public.experience_games g
      WHERE g.id = experience_game_content.game_id
        AND g.is_active = true
    )
  );

-- NOTE: exp_content_entitled_read policy is defined in Section 3.4 below,
--       after the couple_entitlements table is created (it joins against it).

DROP POLICY IF EXISTS "exp_content_admin_all" ON public.experience_game_content;
CREATE POLICY "exp_content_admin_all"
  ON public.experience_game_content FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ============================================================
-- SECTION 3 - ENTITLEMENTS, SUBSCRIPTION PICKS, PROMOTIONS
-- ============================================================

-- 3.1 couple_entitlements: what this couple owns
CREATE TABLE IF NOT EXISTS public.couple_entitlements (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id           uuid        NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  game_id             uuid        NOT NULL REFERENCES public.experience_games(id) ON DELETE RESTRICT,
  source              text        NOT NULL DEFAULT 'purchase',
  acquired_at         timestamptz NOT NULL DEFAULT now(),

  -- Linkage to billing, for audit/traceability
  checkout_session_id uuid        REFERENCES public.checkout_sessions(id) ON DELETE SET NULL,
  subscription_id     uuid        REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  promotion_id        uuid,                          -- FK added after promotions table below
  acquired_by_user_id uuid        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Price snapshot at time of acquisition (for reporting / refunds)
  price_paid          numeric(10,2),
  currency            text,

  notes               text,

  -- A couple owns each game at most once
  UNIQUE (couple_id, game_id)
);

ALTER TABLE public.couple_entitlements
  DROP CONSTRAINT IF EXISTS couple_entitlements_source_check;
ALTER TABLE public.couple_entitlements
  ADD CONSTRAINT couple_entitlements_source_check
  CHECK (source IN ('purchase', 'promo_gift', 'subscription_pick', 'admin_grant'));

CREATE INDEX IF NOT EXISTS couple_entitlements_couple_idx
  ON public.couple_entitlements (couple_id);
CREATE INDEX IF NOT EXISTS couple_entitlements_game_idx
  ON public.couple_entitlements (game_id);


-- 3.2 subscription_monthly_picks: one free game per billing period
CREATE TABLE IF NOT EXISTS public.subscription_monthly_picks (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id       uuid        NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  couple_id             uuid        NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  game_id               uuid        REFERENCES public.experience_games(id) ON DELETE RESTRICT,

  -- Pick window (one billing period)
  period_start          timestamptz NOT NULL,
  period_end            timestamptz NOT NULL,
  picked_at             timestamptz,
  entitlement_id        uuid        REFERENCES public.couple_entitlements(id) ON DELETE SET NULL,

  created_at            timestamptz NOT NULL DEFAULT now(),

  -- One pick slot per subscription per period
  UNIQUE (subscription_id, period_start)
);

CREATE INDEX IF NOT EXISTS sub_monthly_picks_couple_idx
  ON public.subscription_monthly_picks (couple_id);
CREATE INDEX IF NOT EXISTS sub_monthly_picks_pending_idx
  ON public.subscription_monthly_picks (couple_id, period_end)
  WHERE picked_at IS NULL;


-- 3.3 promotions: admin-managed (Buy-X-Get-Y and potentially more types later)
CREATE TABLE IF NOT EXISTS public.promotions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text,                              -- optional coupon code (NULL = automatic)
  name_he         text        NOT NULL,
  name_en         text        NOT NULL DEFAULT '',
  description_he  text        NOT NULL DEFAULT '',
  description_en  text        NOT NULL DEFAULT '',

  type            text        NOT NULL DEFAULT 'buy_x_get_y',
  buy_qty         integer     NOT NULL DEFAULT 1,
  get_qty         integer     NOT NULL DEFAULT 1,
  max_tiers       integer     NOT NULL DEFAULT 2,    -- e.g. buy 1 get 1, buy 2 get 2

  is_active       boolean     NOT NULL DEFAULT true,
  starts_at       timestamptz,
  ends_at         timestamptz,

  applies_to_scope text       NOT NULL DEFAULT 'between_us',
  stacking_allowed boolean    NOT NULL DEFAULT false,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.promotions
  DROP CONSTRAINT IF EXISTS promotions_type_check;
ALTER TABLE public.promotions
  ADD CONSTRAINT promotions_type_check
  CHECK (type IN ('buy_x_get_y', 'percent_off', 'amount_off'));

ALTER TABLE public.promotions
  DROP CONSTRAINT IF EXISTS promotions_scope_check;
ALTER TABLE public.promotions
  ADD CONSTRAINT promotions_scope_check
  CHECK (applies_to_scope IN ('between_us', 'wheel', 'snakes', 'all'));

CREATE UNIQUE INDEX IF NOT EXISTS promotions_code_unique
  ON public.promotions (code)
  WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS promotions_active_idx
  ON public.promotions (is_active, starts_at, ends_at);

-- Now add the deferred FK from couple_entitlements.promotion_id
ALTER TABLE public.couple_entitlements
  DROP CONSTRAINT IF EXISTS couple_entitlements_promotion_fk;
ALTER TABLE public.couple_entitlements
  ADD CONSTRAINT couple_entitlements_promotion_fk
  FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE SET NULL;


-- 3.4 RLS - entitlements
ALTER TABLE public.couple_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_monthly_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- Couples can read their own entitlements
DROP POLICY IF EXISTS "entitlements_couple_read" ON public.couple_entitlements;
CREATE POLICY "entitlements_couple_read"
  ON public.couple_entitlements FOR SELECT
  USING (
    public.is_couple_member(couple_id)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "entitlements_admin_all" ON public.couple_entitlements;
CREATE POLICY "entitlements_admin_all"
  ON public.couple_entitlements FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Content entitlement policy (deferred from Section 2.7 - needs couple_entitlements to exist)
DROP POLICY IF EXISTS "exp_content_entitled_read" ON public.experience_game_content;
CREATE POLICY "exp_content_entitled_read"
  ON public.experience_game_content FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.couple_entitlements ce
      JOIN public.couple_members cm ON cm.couple_id = ce.couple_id
      WHERE ce.game_id = experience_game_content.game_id
        AND cm.user_id = auth.uid()
    )
  );

-- Monthly picks: couple reads, admin manages; pick flow uses a SECURITY DEFINER RPC (added in Stage E)
DROP POLICY IF EXISTS "monthly_picks_couple_read" ON public.subscription_monthly_picks;
CREATE POLICY "monthly_picks_couple_read"
  ON public.subscription_monthly_picks FOR SELECT
  USING (
    public.is_couple_member(couple_id)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "monthly_picks_admin_all" ON public.subscription_monthly_picks;
CREATE POLICY "monthly_picks_admin_all"
  ON public.subscription_monthly_picks FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Promotions: public can read active (to render on cart); admin full
DROP POLICY IF EXISTS "promotions_public_read_active" ON public.promotions;
CREATE POLICY "promotions_public_read_active"
  ON public.promotions FOR SELECT
  USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at   IS NULL OR ends_at   >  now())
  );

DROP POLICY IF EXISTS "promotions_admin_all" ON public.promotions;
CREATE POLICY "promotions_admin_all"
  ON public.promotions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ============================================================
-- SECTION 4 - BETWEEN-US SETTINGS (single-row, fully dynamic)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.between_us_settings (
  id                           integer PRIMARY KEY DEFAULT 1,

  -- Section branding (admin can rename the whole section without code changes)
  section_slug                 text    NOT NULL DEFAULT 'between-us',
  section_name_he              text    NOT NULL DEFAULT 'בינינו',
  section_name_en              text    NOT NULL DEFAULT 'Between Us',
  section_tagline_he           text    NOT NULL DEFAULT '',
  section_tagline_en           text    NOT NULL DEFAULT '',

  -- Master switches
  single_purchase_enabled      boolean NOT NULL DEFAULT true,
  subscription_enabled         boolean NOT NULL DEFAULT false,   -- per Itzik: off at launch
  buy_x_get_x_enabled          boolean NOT NULL DEFAULT true,    -- per Itzik: on at launch

  -- Default single-game prices (overridable per game)
  single_price_ils             numeric(10,2) NOT NULL DEFAULT 87.00,
  single_price_usd             numeric(10,2) NOT NULL DEFAULT 29.00,

  -- Subscription pricing (used when subscription_enabled = true)
  subscription_price_ils       numeric(10,2) NOT NULL DEFAULT 39.00,
  subscription_price_usd       numeric(10,2) NOT NULL DEFAULT 12.00,
  subscription_interval        text    NOT NULL DEFAULT 'monthly',

  -- Buy-X-Get-X tier config (editable from admin UI)
  buy_x_get_x_tiers            jsonb   NOT NULL DEFAULT '[{"buy":1,"get":1},{"buy":2,"get":2}]'::jsonb,

  -- Default badge images (used when a game has no per-game badge)
  default_intimacy_badge_url   text,
  default_communication_badge_url text,
  default_heat_badge_url       text,

  -- Operational
  preview_cards_count          integer NOT NULL DEFAULT 2,
  show_empty_state_cta         boolean NOT NULL DEFAULT true,

  updated_at                   timestamptz NOT NULL DEFAULT now(),
  updated_by                   uuid    REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT between_us_settings_singleton CHECK (id = 1)
);

ALTER TABLE public.between_us_settings
  DROP CONSTRAINT IF EXISTS between_us_settings_interval_check;
ALTER TABLE public.between_us_settings
  ADD CONSTRAINT between_us_settings_interval_check
  CHECK (subscription_interval IN ('weekly', 'monthly', 'annual'));

-- Seed the one and only row (idempotent)
INSERT INTO public.between_us_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;


-- 4.1 RLS - settings
ALTER TABLE public.between_us_settings ENABLE ROW LEVEL SECURITY;

-- Public read (needed to render prices, section name, switches on the storefront)
DROP POLICY IF EXISTS "between_us_settings_public_read" ON public.between_us_settings;
CREATE POLICY "between_us_settings_public_read"
  ON public.between_us_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "between_us_settings_admin_write" ON public.between_us_settings;
CREATE POLICY "between_us_settings_admin_write"
  ON public.between_us_settings FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Only admins can insert (singleton row already seeded)
DROP POLICY IF EXISTS "between_us_settings_admin_insert" ON public.between_us_settings;
CREATE POLICY "between_us_settings_admin_insert"
  ON public.between_us_settings FOR INSERT
  WITH CHECK (public.is_admin());


-- ============================================================
-- SECTION 5 - UPDATED_AT TRIGGERS (consistency with the rest of the schema)
-- ============================================================

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'couples_set_updated_at') THEN
    CREATE TRIGGER couples_set_updated_at
      BEFORE UPDATE ON public.couples
      FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'experience_games_set_updated_at') THEN
    CREATE TRIGGER experience_games_set_updated_at
      BEFORE UPDATE ON public.experience_games
      FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'experience_game_categories_set_updated_at') THEN
    CREATE TRIGGER experience_game_categories_set_updated_at
      BEFORE UPDATE ON public.experience_game_categories
      FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'experience_game_content_set_updated_at') THEN
    CREATE TRIGGER experience_game_content_set_updated_at
      BEFORE UPDATE ON public.experience_game_content
      FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'promotions_set_updated_at') THEN
    CREATE TRIGGER promotions_set_updated_at
      BEFORE UPDATE ON public.promotions
      FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'between_us_settings_set_updated_at') THEN
    CREATE TRIGGER between_us_settings_set_updated_at
      BEFORE UPDATE ON public.between_us_settings
      FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;
END
$$;


-- ============================================================
-- SECTION 6 - STORAGE: between-us media bucket
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('between-us', 'between-us', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "between_us_public_read" ON storage.objects;
CREATE POLICY "between_us_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'between-us');

DROP POLICY IF EXISTS "between_us_admin_insert" ON storage.objects;
CREATE POLICY "between_us_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'between-us' AND public.is_admin());

DROP POLICY IF EXISTS "between_us_admin_update" ON storage.objects;
CREATE POLICY "between_us_admin_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'between-us' AND public.is_admin());

DROP POLICY IF EXISTS "between_us_admin_delete" ON storage.objects;
CREATE POLICY "between_us_admin_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'between-us' AND public.is_admin());


-- ============================================================
-- SECTION 7 - SEED: starter categories, tags, demo game
-- All content is placeholder - Itzik will edit via admin UI.
-- Seed rows are idempotent (ON CONFLICT DO NOTHING).
-- ============================================================

-- 7.1 Starter categories
INSERT INTO public.experience_game_categories
  (slug, name_he, name_en, description_he, description_en, sort_weight, is_active)
VALUES
  ('emotional-connection', 'חיבור רגשי',  'Emotional Connection',
   'משחקים שמעמיקים את הקרבה הרגשית',
   'Games that deepen emotional closeness', 10, true),
  ('communication',        'תקשורת זוגית', 'Couples Communication',
   'לפתוח ערוצי שיחה חדשים',
   'Open new conversation channels',          20, true),
  ('friendship',           'חיזוק חברות', 'Friendship Boost',
   'לזכור שאתם גם חברים הכי טובים',
   'Remember you are also best friends',      30, true),
  ('playful',              'קליל ומצחיק', 'Playful & Fun',
   'לצחוק יחד ולהשתובב',
   'Laugh and play together',                 40, true),
  ('intimate',             'לוהט במיטה',  'Hot in Bed',
   'לחוויות אינטימיות עם טעם',
   'Intimate experiences done tastefully',    50, true)
ON CONFLICT (slug) DO NOTHING;


-- 7.2 Starter tags (interests/moods)
INSERT INTO public.experience_game_tags (slug, name_he, name_en, is_active)
VALUES
  ('new-couples',       'זוגות חדשים',    'New Couples',        true),
  ('long-term',         'אחרי שנים יחד',  'Long-term',          true),
  ('date-night',        'ערב דייט',       'Date Night',         true),
  ('deep-talk',         'שיחה עמוקה',     'Deep Talk',          true),
  ('humor',             'הומור',          'Humor',              true),
  ('adventure',         'הרפתקני',        'Adventurous',        true),
  ('cozy',              'חמים ורגוע',     'Cozy',               true)
ON CONFLICT (slug) DO NOTHING;


-- 7.3 Demo game - fully populated placeholder so admin UI has a live example
DO $$
DECLARE
  v_game_id  uuid;
  v_cat_emotional uuid;
  v_cat_comm      uuid;
  v_tag_date      uuid;
  v_tag_deep      uuid;
BEGIN
  -- Idempotent insert
  INSERT INTO public.experience_games (
    slug,
    title_he, title_en,
    short_desc_he, short_desc_en,
    full_desc_he,  full_desc_en,
    meta_title_he, meta_title_en,
    meta_description_he, meta_description_en,
    benefits_he, benefits_en,
    target_audience_he, target_audience_en,
    intimacy_level, communication_level, heat_level,
    is_new, is_popular, is_subscription_eligible, is_active,
    sort_weight,
    published_at
  )
  VALUES (
    'demo-night-of-us',
    'לילה של שנינו',     'A Night of Us',
    'ערב שיחה שלם על מה שחשוב באמת',
    'A full evening of conversation about what really matters',
    'המשחק מוביל אתכם דרך שאלות מדורגות - מהכי רכות ועד להכי אינטימיות. בלי לחץ, בלי דדליין, בלי טלפונים. רק שניכם והשאלות שאף פעם לא שאלתם אחד את השני.',
    'The game guides you through graduated questions - from the softest to the most intimate. No pressure, no deadline, no phones. Just the two of you and the questions you never thought to ask.',
    'לילה של שנינו - משחק זוגי לערב שיחה עמוקה | בינינו',
    'A Night of Us - Deep-talk game for couples | Between Us',
    'משחק דיגיטלי לזוגות שרוצים להתקרב. שאלות מדורגות ברמות מרגש, מעורר וללא גבולות. ללא הורדה, נפתח ישירות בחשבונכם.',
    'A digital couples-game for getting closer. Graduated questions at Touching, Stirring and No-Limits levels. No downloads - unlocked straight in your account.',
    '["מעמיק את ההכרות ההדדית","פותח שיחות שנמנעתם מהן","סביבה בטוחה לשיתוף"]'::jsonb,
    '["Deepens mutual knowing","Opens conversations you''ve been avoiding","A safe space for sharing"]'::jsonb,
    '["זוגות אחרי תקופה של שגרה","זוגות חדשים שרוצים להעמיק מהר","זוגות לפני החלטה משמעותית"]'::jsonb,
    '["Couples stuck in routine","New couples wanting to deepen fast","Couples facing a big decision"]'::jsonb,
    4, 5, 3,
    true, false, true, true,
    100,
    now()
  )
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO v_game_id;

  -- If game already existed, fetch its id
  IF v_game_id IS NULL THEN
    SELECT id INTO v_game_id
    FROM public.experience_games
    WHERE slug = 'demo-night-of-us';
  END IF;

  -- Link categories
  SELECT id INTO v_cat_emotional FROM public.experience_game_categories WHERE slug = 'emotional-connection';
  SELECT id INTO v_cat_comm      FROM public.experience_game_categories WHERE slug = 'communication';

  IF v_game_id IS NOT NULL AND v_cat_emotional IS NOT NULL THEN
    INSERT INTO public.experience_games_x_categories (game_id, category_id, sort_weight)
    VALUES (v_game_id, v_cat_emotional, 10)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_game_id IS NOT NULL AND v_cat_comm IS NOT NULL THEN
    INSERT INTO public.experience_games_x_categories (game_id, category_id, sort_weight)
    VALUES (v_game_id, v_cat_comm, 20)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Link tags
  SELECT id INTO v_tag_date FROM public.experience_game_tags WHERE slug = 'date-night';
  SELECT id INTO v_tag_deep FROM public.experience_game_tags WHERE slug = 'deep-talk';

  IF v_game_id IS NOT NULL AND v_tag_date IS NOT NULL THEN
    INSERT INTO public.experience_games_x_tags (game_id, tag_id)
    VALUES (v_game_id, v_tag_date)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_game_id IS NOT NULL AND v_tag_deep IS NOT NULL THEN
    INSERT INTO public.experience_games_x_tags (game_id, tag_id)
    VALUES (v_game_id, v_tag_deep)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Seed a small set of demo content cards (preview + paid) if empty
  IF v_game_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.experience_game_content WHERE game_id = v_game_id)
  THEN
    -- Preview cards (public)
    INSERT INTO public.experience_game_content
      (game_id, level, order_index, title_he, title_en, body_he, body_en, is_preview, is_active)
    VALUES
      (v_game_id, 'מרגש', 1,
       'הרגע הראשון',
       'The First Moment',
       'ספר/י לי על הרגע הראשון שבו הבנת שאת/ה רוצה להיות איתי. איפה היינו? מה הרגשת?',
       'Tell me about the first moment you knew you wanted to be with me. Where were we? What did you feel?',
       true, true),
      (v_game_id, 'מרגש', 2,
       'שאלה שלא שאלתי',
       'A Question I Never Asked',
       'מה שאלה שתמיד רצית שאשאל אותך, אבל אני לא שאלתי? בחר/י אחת ותן/י לי אותה כעת.',
       'What''s a question you always wanted me to ask but I never did? Pick one and offer it to me now.',
       true, true);

    -- Paid content (hidden from non-owners)
    INSERT INTO public.experience_game_content
      (game_id, level, order_index, title_he, title_en, body_he, body_en, is_preview, is_active)
    VALUES
      (v_game_id, 'מרגש', 3,
       'הפחד השקט שלי',
       'My Quiet Fear',
       'מהו פחד שאת/ה סוחב/ת איתך בקשר הזה, ולא דיברת עליו? אני מבטיח/ה רק להקשיב.',
       'What''s a fear you carry in this relationship that you haven''t spoken about? I promise only to listen.',
       false, true),
      (v_game_id, 'מעורר', 1,
       'רגע שאני זוכר/ת',
       'A Moment I Remember',
       'תאר/י רגע ביננו שהיה טעון בלי שאמרנו מילה. מה היה בו בשבילך?',
       'Describe a moment between us that was charged without a word spoken. What was in it for you?',
       false, true),
      (v_game_id, 'מעורר', 2,
       'משהו שאני מתגעגע/ת אליו',
       'Something I Miss',
       'משהו קטן שהיה בינינו בהתחלה, שאני מתגעגע/ת אליו עכשיו. שיתוף בלי ציפייה.',
       'A small something between us in the beginning, that I miss now. Sharing without expectation.',
       false, true),
      (v_game_id, 'ללא_גבולות', 1,
       'פנטזיה שלא סיפרתי',
       'A Fantasy I Haven''t Shared',
       'פנטזיה שלא סיפרת עליה מעולם. אפשר רק כותרת. אפשר יותר. אתם מחליטים ביחד.',
       'A fantasy you''ve never shared. A title is enough. More is welcome. You decide together.',
       false, true);
  END IF;
END
$$;


-- 7.4 Starter promotion: Buy 1 Get 1 (matches between_us_settings defaults)
INSERT INTO public.promotions (
  code, name_he, name_en,
  description_he, description_en,
  type, buy_qty, get_qty, max_tiers,
  is_active, applies_to_scope
)
VALUES (
  NULL,
  'קנה 1 קבל 1 חינם', 'Buy 1 Get 1 Free',
  'רכוש משחק אחד וקבל את השני במתנה',
  'Buy one game and get the second one free',
  'buy_x_get_y', 1, 1, 2,
  true, 'between_us'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- END OF MIGRATION 029
-- ============================================================
