-- Run this in Supabase → SQL Editor

CREATE TABLE licenses (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  key              TEXT        UNIQUE NOT NULL,
  email            TEXT        NOT NULL,
  plan             TEXT        NOT NULL DEFAULT 'pro',
  provider         TEXT        NOT NULL,          -- 'razorpay' | 'lemonsqueezy'
  status           TEXT        NOT NULL DEFAULT 'active', -- 'active' | 'cancelled' | 'expired'
  payment_id       TEXT,                          -- Razorpay payment_id or LS order id
  subscription_id  TEXT,                          -- for recurring billing tracking
  amount           INTEGER,                       -- amount in smallest unit (paise / cents)
  currency         TEXT        DEFAULT 'INR',
  expires_at       TIMESTAMPTZ,                   -- NULL = lifetime, else monthly renewal date
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast key lookups (Looly app calls this on every launch)
CREATE INDEX idx_licenses_key ON licenses(key);
CREATE INDEX idx_licenses_email ON licenses(email);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER licenses_updated_at
  BEFORE UPDATE ON licenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
