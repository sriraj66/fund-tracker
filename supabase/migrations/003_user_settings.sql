-- User Settings Table for preferences like USD to INR exchange rate
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  usd_to_inr_rate DECIMAL(10, 4) DEFAULT 83.50, -- Current approximate rate
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own settings"
  ON user_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Helper function to get or create user settings
CREATE OR REPLACE FUNCTION get_user_usd_to_inr(p_user_id UUID)
RETURNS DECIMAL(10, 4) AS $$
DECLARE
  v_rate DECIMAL(10, 4);
BEGIN
  SELECT usd_to_inr_rate INTO v_rate
  FROM user_settings
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    INSERT INTO user_settings (user_id, usd_to_inr_rate)
    VALUES (p_user_id, 83.50)
    RETURNING usd_to_inr_rate INTO v_rate;
  END IF;
  
  RETURN v_rate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
