-- ============================================================
-- 016_cardcom_billing.sql
-- Full Cardcom billing integration for mioshy
-- ============================================================

-- 1. Cardcom checkout sessions
CREATE TABLE IF NOT EXISTS checkout_sessions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  lead_id       uuid        REFERENCES leads(id) ON DELETE SET NULL,
  email         text        NOT NULL,
  name          text,
  plan          text        NOT NULL CHECK (plan IN ('weekly','monthly','annual')),
  amount        numeric(10,2) NOT NULL,
  currency      text        NOT NULL DEFAULT 'ILS',
  coin_id       integer     NOT NULL DEFAULT 1,   -- 1=ILS  2=USD
  country_code  text,
  language      text        NOT NULL DEFAULT 'he',
  is_israeli    boolean     NOT NULL DEFAULT false,
  vat_rate_percent integer  NOT NULL DEFAULT 0,
  status        text        NOT NULL DEFAULT 'created'
                CHECK (status IN ('created','redirected','paid','failed')),
  low_profile_code text,
  deal_number      text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checkout_sessions_user_id_idx     ON checkout_sessions(user_id);
CREATE INDEX IF NOT EXISTS checkout_sessions_low_profile_idx ON checkout_sessions(low_profile_code)
  WHERE low_profile_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS checkout_sessions_status_idx      ON checkout_sessions(status);

-- 2. Stored Cardcom tokens (encrypted, never raw)
CREATE TABLE IF NOT EXISTS customer_payment_methods (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider    text    NOT NULL DEFAULT 'cardcom',
  token_enc   text    NOT NULL,       -- AES-256-GCM encrypted JSON
  token_hash  text    NOT NULL,       -- SHA-256(raw_token) for uniqueness
  expiry_mmyy text,                   -- normalised "MMYY"
  card_brand  text,
  last4       text,
  first6      text,
  status      text    NOT NULL DEFAULT 'active'
              CHECK (status IN ('active','expired','revoked')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, token_hash)
);

CREATE INDEX IF NOT EXISTS cpm_user_id_idx ON customer_payment_methods(user_id);

-- 3. Idempotency table for Cardcom indicator callbacks
CREATE TABLE IF NOT EXISTS billing_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text        NOT NULL UNIQUE,
  processed       boolean     NOT NULL DEFAULT false,
  payload         jsonb,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 4. Charge attempts (initial + renewals)
CREATE TABLE IF NOT EXISTS subscription_charges (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id      uuid        NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  payment_method_id    uuid        REFERENCES customer_payment_methods(id) ON DELETE SET NULL,
  amount               numeric(10,2) NOT NULL,
  currency             text        NOT NULL DEFAULT 'ILS',
  status               text        NOT NULL DEFAULT 'created'
                       CHECK (status IN ('created','succeeded','failed')),
  uniq_asmachta        text        NOT NULL,
  billing_period_start timestamptz,
  billing_period_end   timestamptz,
  raw_response         jsonb,
  invoice_url          text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (uniq_asmachta)
);

CREATE INDEX IF NOT EXISTS sc_user_id_idx        ON subscription_charges(user_id);
CREATE INDEX IF NOT EXISTS sc_subscription_id_idx ON subscription_charges(subscription_id);
CREATE INDEX IF NOT EXISTS sc_status_idx          ON subscription_charges(status);

-- 5. Extend subscriptions table with Cardcom / billing fields
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS plan_amount       numeric(10,2),
  ADD COLUMN IF NOT EXISTS currency          text    NOT NULL DEFAULT 'ILS',
  ADD COLUMN IF NOT EXISTS coin_id           integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_israeli        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vat_rate_percent  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_billing_date timestamptz,
  ADD COLUMN IF NOT EXISTS failed_attempts   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grace_until       timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_url       text,
  ADD COLUMN IF NOT EXISTS checkout_session_id uuid REFERENCES checkout_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_method_id   uuid REFERENCES customer_payment_methods(id) ON DELETE SET NULL;

-- Allow status 'past_due' and 'blocked' in addition to existing values
-- (recreate the constraint after dropping the old one)
ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active','cancelled','expired','past_due','blocked'));

-- 6. RLS policies ----------------------------------------------------------

ALTER TABLE checkout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkout_sessions: service_role full access"
  ON checkout_sessions FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "checkout_sessions: user reads own"
  ON checkout_sessions FOR SELECT
  TO authenticated USING (user_id = auth.uid());

-- ---

ALTER TABLE customer_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cpm: service_role full access"
  ON customer_payment_methods FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "cpm: user reads own"
  ON customer_payment_methods FOR SELECT
  TO authenticated USING (user_id = auth.uid());

-- ---

ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_events: service_role full access"
  ON billing_events FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ---

ALTER TABLE subscription_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sc: service_role full access"
  ON subscription_charges FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "sc: user reads own"
  ON subscription_charges FOR SELECT
  TO authenticated USING (user_id = auth.uid());
