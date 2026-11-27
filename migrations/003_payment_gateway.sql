CREATE TABLE IF NOT EXISTS payment_transactions (
  id VARCHAR(120) PRIMARY KEY,
  order_id VARCHAR(120) NOT NULL,
  order_number VARCHAR(120) NOT NULL,
  provider VARCHAR(40) NOT NULL,
  payment_method VARCHAR(40) NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(12) NOT NULL DEFAULT 'EGP',
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  gateway_reference VARCHAR(200),
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_transactions_order_idx ON payment_transactions(order_number);
CREATE INDEX IF NOT EXISTS payment_transactions_status_idx ON payment_transactions(status, created_at DESC);
