-- Enable RLS on all tables
-- Run this in your Supabase SQL editor

-- ─────────────────────────────────────────────
-- Mutual Fund Transactions
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mf_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  scheme_name TEXT NOT NULL,
  transaction_type TEXT NOT NULL DEFAULT 'PURCHASE', -- PURCHASE | REDEMPTION | SIP
  units DECIMAL(15, 4),
  nav DECIMAL(15, 4),
  amount DECIMAL(15, 2) NOT NULL,
  transaction_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mf_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own mf_transactions"
  ON mf_transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- Indian Stock Transactions
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stock_name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  isin TEXT,
  transaction_type TEXT NOT NULL DEFAULT 'BUY', -- BUY | SELL
  quantity DECIMAL(15, 4) NOT NULL,
  price DECIMAL(15, 4),          -- price per share
  value DECIMAL(15, 2) NOT NULL, -- total order value
  exchange TEXT,
  execution_date TIMESTAMPTZ,
  order_status TEXT DEFAULT 'Executed',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own stock_transactions"
  ON stock_transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- US Stock Transactions (INDMoney / Alpaca)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS us_stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  description TEXT,
  side TEXT NOT NULL DEFAULT 'buy', -- buy | sell
  quantity DECIMAL(20, 8) NOT NULL,
  price DECIMAL(15, 4),            -- price per share in USD
  amount DECIMAL(15, 4),           -- total in USD (negative = debit)
  transaction_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE us_stock_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own us_stock_transactions"
  ON us_stock_transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- Crypto Transactions (CoinSwitch)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crypto_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  transaction_ref TEXT,            -- CoinSwitch transaction id
  market TEXT NOT NULL,            -- e.g. BTCINR
  coin TEXT NOT NULL,              -- e.g. BTC
  trade_type TEXT NOT NULL DEFAULT 'BUY', -- BUY | SELL
  price DECIMAL(20, 8),            -- price per coin in INR
  volume DECIMAL(20, 8),           -- quantity of coin
  total_inr DECIMAL(15, 2),        -- total value in INR
  tds_amount DECIMAL(15, 4) DEFAULT 0,
  fee_amount DECIMAL(15, 4) DEFAULT 0,
  transaction_date TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE crypto_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own crypto_transactions"
  ON crypto_transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- Gold Transactions (manual input)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gold_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  purchase_date DATE NOT NULL,
  price_per_gram DECIMAL(15, 4) NOT NULL,  -- INR per gram
  grams DECIMAL(15, 4) NOT NULL,           -- weight in grams
  amount DECIMAL(15, 2) NOT NULL,          -- total amount = grams * price_per_gram
  gold_type TEXT DEFAULT '24K',            -- 24K | 22K | Digital
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE gold_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own gold_transactions"
  ON gold_transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- Indexes for performance
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mf_user_date ON mf_transactions (user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_stocks_user_date ON stock_transactions (user_id, execution_date DESC);
CREATE INDEX IF NOT EXISTS idx_us_stocks_user_date ON us_stock_transactions (user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_crypto_user_date ON crypto_transactions (user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_gold_user_date ON gold_transactions (user_id, purchase_date DESC);