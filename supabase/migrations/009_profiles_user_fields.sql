-- Freemium + subscriptions: user fields and subscriptions table

-- ---------------------------------------------------------------------------
-- profiles: user fields + spin tracking
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mobile text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS spins_used integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_spin_reset timestamptz;

-- ---------------------------------------------------------------------------
-- subscriptions: managed by Stripe webhook later (service_role)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('weekly', 'monthly', 'annual')),
  status text NOT NULL CHECK (status IN ('active', 'cancelled', 'expired')),
  current_period_end timestamptz,
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions (user_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscriptions
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update (cancel) their own subscription rows.
-- Inserts/deletes intentionally have NO policies, so only service_role can do them.
DROP POLICY IF EXISTS "subscriptions_update_own" ON public.subscriptions;
CREATE POLICY "subscriptions_update_own"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

