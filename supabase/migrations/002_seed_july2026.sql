-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: July 2026 transaction data from INDMoney statements
-- Replace 'YOUR_USER_ID' with your actual Supabase auth.users UUID before running
-- ─────────────────────────────────────────────────────────────────────────────

-- Set the user ID as a variable (replace with your actual user UUID)
DO $$
DECLARE
  uid UUID := 'YOUR_USER_ID'; -- ← REPLACE THIS with your user UUID from auth.users
BEGIN

-- ─────────────────────────────────────────────────────────────────────────────
-- MUTUAL FUNDS (INDMoney Grow — July 2026)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO mf_transactions (user_id, scheme_name, transaction_type, units, nav, amount, transaction_date) VALUES
  (uid, 'ICICI Prudential Corporate Bond Fund Direct Plan Growth', 'PURCHASE', 14.97, 33.39, 499,  '2026-07-09'),
  (uid, 'Parag Parikh Flexi Cap Fund Direct Growth',              'PURCHASE', 16.41, 91.41, 1499, '2026-07-06'),
  (uid, 'Bandhan Small Cap Fund Direct Growth',                   'PURCHASE', 18.06, 55.38, 999,  '2026-07-02'),
  (uid, 'Navi Nifty 50 Index Fund Direct Growth',                 'PURCHASE', 125.58, 15.92, 1999, '2026-07-02');

-- ─────────────────────────────────────────────────────────────────────────────
-- INDIAN STOCKS (INDMoney / Grow — July 2026)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO stock_transactions (user_id, stock_name, symbol, isin, transaction_type, quantity, price, value, exchange, execution_date, order_status) VALUES
  (uid, 'TATA MOTORS PASS VEH LTD',  'TMPV',       'INE155A01022', 'BUY', 2,  348.70, 697.40,  'NSE', '2026-07-01 11:55:00+05:30', 'Executed'),
  (uid, 'KALYAN JEWELLERS IND LTD',  'KALYANKJIL', 'INE303R01014', 'BUY', 5,  384.45, 1922.25, 'NSE', '2026-07-01 12:00:00+05:30', 'Executed'),
  (uid, 'HDFC BANK LTD',             'HDFCBANK',   'INE040A01034', 'BUY', 1,  802.00, 802.00,  'NSE', '2026-07-01 12:00:00+05:30', 'Executed'),
  (uid, 'THE SOUTH INDIAN BANK LTD', 'SOUTHBANK',  'INE683A01023', 'BUY', 1,  46.14,  46.14,   'NSE', '2026-07-01 12:02:00+05:30', 'Executed'),
  (uid, 'KALYAN JEWELLERS IND LTD',  'KALYANKJIL', 'INE303R01014', 'BUY', 5,  381.60, 1908.00, 'NSE', '2026-07-06 14:42:00+05:30', 'Executed'),
  (uid, 'INFOSYS LIMITED',           'INFY',       'INE009A01021', 'BUY', 1,  1034.30, 1034.30,'BSE', '2026-07-06 14:43:00+05:30', 'Executed'),
  (uid, 'INDIAN RAIL TOUR CORP LTD', 'IRCTC',      'INE335Y01020', 'BUY', 2,  509.60, 1019.20, 'NSE', '2026-07-06 14:45:00+05:30', 'Executed'),
  (uid, 'INDIAN RAIL TOUR CORP LTD', 'IRCTC',      'INE335Y01020', 'BUY', 1,  493.50, 493.50,  'NSE', '2026-07-29 11:41:00+05:30', 'Executed'),
  (uid, 'HDFC BANK LTD',             'HDFCBANK',   'INE040A01034', 'BUY', 1,  752.40, 752.40,  'NSE', '2026-07-30 14:47:00+05:30', 'Executed'),
  (uid, 'NATCO PHARMA LTD.',         'NATCOPHARM', 'INE987B01026', 'BUY', 1,  930.55, 930.55,  'NSE', '2026-07-30 15:00:00+05:30', 'Executed');

-- ─────────────────────────────────────────────────────────────────────────────
-- US STOCKS (INDMoney / Alpaca — July 2026)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO us_stock_transactions (user_id, symbol, description, side, quantity, price, amount, transaction_date) VALUES
  (uid, 'EWJV',  'ISHARES MSCI JAPAN VALUE',     'buy',  0.131805157, 45.37,  -5.98,  '2026-07-02'),
  (uid, 'GOOGL', 'ALPHABET INC CL A',            'buy',  0.027650817, 360.57, -9.97,  '2026-07-02'),
  (uid, 'IGPT',  'ISHARES AI & TECH ETF',        'buy',  0.062968639, 96.56,  -6.08,  '2026-07-02'),
  (uid, 'MSFT',  'MICROSOFT CORP',               'buy',  0.025582075, 389.73, -9.97,  '2026-07-02'),
  (uid, 'QQQM',  'INVESCO NASDAQ 100 ETF',       'buy',  0.067343478, 296.09, -19.94, '2026-07-02'),
  (uid, 'TSM',   'TAIWAN SEMICONDUCTOR ADR',     'buy',  0.022195803, 449.18, -9.97,  '2026-07-02'),
  (uid, 'CNYA',  'ISHARES MSCI CHINA A',         'buy',  0.569471512, 34.89,  -19.87, '2026-07-20'),
  (uid, 'IGPT',  'ISHARES AI & TECH ETF',        'sell', 0.231338243, 89.96,  20.81,  '2026-07-20'),
  (uid, 'IHF',   'ISHARES US HEALTHCARE PROV',   'buy',  0.37006259,  56.56,  -20.93, '2026-07-20'),
  (uid, 'TSM',   'TAIWAN SEMICONDUCTOR ADR',     'sell', 0.049505685, 403.99, 20.00,  '2026-07-20'),
  (uid, 'META',  'META PLATFORMS INC',           'buy',  0.002097284, 543.56, -1.14,  '2026-07-31');

-- ─────────────────────────────────────────────────────────────────────────────
-- CRYPTO (CoinSwitch — July 2026)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO crypto_transactions (user_id, transaction_ref, market, coin, trade_type, price, volume, total_inr, tds_amount, fee_amount, transaction_date) VALUES
  (uid, 'bf34d14a-f64a-46b5-acb8-50e73652adc3', 'BTCINR', 'BTC', 'BUY',  6410689.81, 0.0000219,  140.33, 0,    4, '2026-07-02 18:38:13+05:30'),
  (uid, '6a626c05-e86d-48ad-ba70-d816ff180a7c', 'SOLINR', 'SOL', 'SELL', 7868.24,    0.017835,  140.33, 1.42, 4, '2026-07-02 18:37:29+05:30');

END $$;