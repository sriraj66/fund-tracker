-- Portfolio Snapshots Table to track monthly portfolio performance
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  snapshot_date DATE NOT NULL,
  
  -- Gold
  gold_invested DECIMAL(15, 2) DEFAULT 0,
  gold_value DECIMAL(15, 2) DEFAULT 0,
  gold_return_pct DECIMAL(10, 4) DEFAULT 0,
  
  -- Crypto
  crypto_invested DECIMAL(15, 2) DEFAULT 0,
  crypto_value DECIMAL(15, 2) DEFAULT 0,
  crypto_return_pct DECIMAL(10, 4) DEFAULT 0,
  
  -- Mutual Funds
  mf_invested DECIMAL(15, 2) DEFAULT 0,
  mf_value DECIMAL(15, 2) DEFAULT 0,
  mf_return_pct DECIMAL(10, 4) DEFAULT 0,
  
  -- Indian Stocks
  in_stocks_invested DECIMAL(15, 2) DEFAULT 0,
  in_stocks_value DECIMAL(15, 2) DEFAULT 0,
  in_stocks_return_pct DECIMAL(10, 4) DEFAULT 0,
  
  -- US Stocks
  us_stocks_invested DECIMAL(15, 2) DEFAULT 0,
  us_stocks_value DECIMAL(15, 2) DEFAULT 0,
  us_stocks_return_pct DECIMAL(10, 4) DEFAULT 0,
  
  -- Totals
  total_invested DECIMAL(15, 2) DEFAULT 0,
  total_value DECIMAL(15, 2) DEFAULT 0,
  total_return_pct DECIMAL(10, 4) DEFAULT 0,
  profit DECIMAL(15, 2) DEFAULT 0,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, snapshot_date)
);

ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own snapshots"
  ON portfolio_snapshots FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_portfolio_snapshots_user_date ON portfolio_snapshots(user_id, snapshot_date DESC);
