CREATE TABLE IF NOT EXISTS community_join_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  source VARCHAR(64) DEFAULT 'website_popup',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_join_leads_email
  ON community_join_leads (LOWER(email));

CREATE TABLE IF NOT EXISTS community_join_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 99,
  payment_type VARCHAR(32) NOT NULL DEFAULT 'full',
  payment_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  purchase_status VARCHAR(32) NOT NULL DEFAULT 'pending_payment',
  razorpay_order_id VARCHAR(255),
  razorpay_payment_id VARCHAR(255),
  razorpay_signature TEXT,
  source VARCHAR(64) DEFAULT 'website_popup',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_join_payments_order
  ON community_join_payments (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_community_join_payments_email
  ON community_join_payments (LOWER(email));
