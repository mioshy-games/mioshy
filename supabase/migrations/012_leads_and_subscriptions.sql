-- Anonymous-first onboarding: leads (pre-payment) + subscriptions (post-payment)

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text,
  language text NOT NULL,
  device_id text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_language_idx ON public.leads (language);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON public.leads (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS leads_email_device_key ON public.leads (email, device_id);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_language_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_language_check CHECK (language IN ('he', 'en'));

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_status_check CHECK (status IN ('new', 'converted', 'invalid'));

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_email_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_email_check CHECK (email ~* '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$');

-- Public: allow anonymous insert only (pre-payment lead capture).
DROP POLICY IF EXISTS "leads_public_insert" ON public.leads;
CREATE POLICY "leads_public_insert"
  ON public.leads FOR INSERT
  WITH CHECK (
    email IS NOT NULL
    AND length(email) > 3
    AND device_id IS NOT NULL
    AND length(device_id) > 8
    AND language IN ('he', 'en')
    AND status = 'new'
  );

-- Admin: full access
DROP POLICY IF EXISTS "leads_admin_all" ON public.leads;
CREATE POLICY "leads_admin_all"
  ON public.leads FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  plan text,
  current_period_end timestamptz,
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON public.subscriptions (status);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_active_key
  ON public.subscriptions (user_id)
  WHERE status = 'active';

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check CHECK (status IN ('active', 'paused', 'canceled', 'cancelled', 'expired'));

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_email_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_email_check CHECK (email ~* '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$');

-- Authenticated users can read their own subscription
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Admin: full access
DROP POLICY IF EXISTS "subscriptions_admin_all" ON public.subscriptions;
CREATE POLICY "subscriptions_admin_all"
  ON public.subscriptions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- Conversion RPC: lead -> subscription (requires auth.uid())
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.convert_lead_to_subscription(
  lead_id uuid,
  plan text,
  device_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  lead public.leads%ROWTYPE;
  sub_id uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO lead FROM public.leads WHERE id = lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'lead not found';
  END IF;
  IF lead.status <> 'new' THEN
    RAISE EXCEPTION 'lead already converted';
  END IF;
  IF lead.device_id <> device_id THEN
    RAISE EXCEPTION 'device mismatch';
  END IF;

  INSERT INTO public.subscriptions (user_id, email, status, plan)
  VALUES (uid, lead.email, 'active', NULLIF(plan, ''))
  RETURNING id INTO sub_id;

  UPDATE public.leads
  SET status = 'converted'
  WHERE id = lead_id;

  RETURN sub_id;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_lead_to_subscription(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_lead_to_subscription(uuid, text, text) TO authenticated;

