export type TransactionType = "PURCHASE" | "REDEMPTION" | "SIP";
export type StockSide = "BUY" | "SELL";
export type UsSide = "buy" | "sell";

export interface MfTransaction {
  id: string;
  user_id: string;
  scheme_name: string;
  transaction_type: TransactionType;
  units: number | null;
  nav: number | null;
  amount: number;
  transaction_date: string;
  notes?: string;
  created_at: string;
}

export interface StockTransaction {
  id: string;
  user_id: string;
  stock_name: string;
  symbol: string;
  isin?: string;
  transaction_type: StockSide;
  quantity: number;
  price?: number;
  value: number;
  exchange?: string;
  execution_date?: string;
  order_status?: string;
  notes?: string;
  created_at: string;
}

export interface UsStockTransaction {
  id: string;
  user_id: string;
  symbol: string;
  description?: string;
  side: UsSide;
  quantity: number;
  price?: number;
  amount?: number; // in USD
  transaction_date: string;
  notes?: string;
  created_at: string;
}

export interface CryptoTransaction {
  id: string;
  user_id: string;
  transaction_ref?: string;
  market: string;
  coin: string;
  trade_type: StockSide;
  price?: number;
  volume?: number;
  total_inr?: number;
  tds_amount?: number;
  fee_amount?: number;
  transaction_date: string;
  notes?: string;
  created_at: string;
}

export interface GoldTransaction {
  id: string;
  user_id: string;
  purchase_date: string;
  price_per_gram: number;
  grams: number;
  amount: number;
  gold_type: string;
  notes?: string;
  created_at: string;
}

export interface PortfolioSummary {
  totalInvested: number;
  mfTotal: number;
  stocksTotal: number;
  usStocksTotal: number; // in USD
  cryptoTotal: number;
  goldTotal: number;
}

export interface ExpenseCategory {
  id: string;
  user_id?: string;
  name: string;
  icon: string; // lucide icon name
  color: string; // tailwind color key e.g. "red", "blue"
  budget_limit?: number | null;
  created_at: string;
  isDefault?: boolean;
}

export interface ExpenseTag {
  id: string;
  user_id?: string;
  name: string;
  color: string; // tailwind color key
  created_at: string;
}

export interface Expense {
  id: string;
  user_id?: string;
  amount: number;
  category_id: string;
  category_name: string;
  category_icon: string;
  category_color: string;
  description: string;
  date: string; // YYYY-MM-DD
  payment_method: "Cash" | "Card" | "UPI" | "Net Banking" | "Other";
  tags?: string[]; // array of tag names
  notes?: string | null;
  created_at: string;
}
