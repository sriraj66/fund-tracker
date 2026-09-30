export interface Flow {
  date: string;              // YYYY-MM-DD
  amount: number;            // INR
  side: "buy" | "sell";
  qty?: number;
}

export interface TradePoint {
  date: string;
  label: string;
  side: "buy" | "sell";
  price: number;             // amount / qty
  qty: number;
  amount: number;
  cumQty: number;
  cumInvested: number;
}

export const dayLabel = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });

export const monthLabelOf = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function monthlyFlow(items: Flow[]) {
  const map = new Map<string, { Buy: number; Sell: number }>();
  for (const f of items) {
    if (!f.date) continue;
    const key = f.date.slice(0, 7);
    const ex = map.get(key) ?? { Buy: 0, Sell: 0 };
    if (f.side === "buy") ex.Buy += f.amount; else ex.Sell += f.amount;
    map.set(key, ex);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({ key, label: monthLabelOf(key), Buy: round2(v.Buy), Sell: round2(v.Sell), Net: round2(v.Buy - v.Sell) }));
}

export function tradePoints(items: Flow[]): TradePoint[] {
  const sorted = items.filter((f) => f.date && (f.qty ?? 0) > 0).sort((a, b) => a.date.localeCompare(b.date));
  let cumQty = 0, cumInvested = 0;
  return sorted.map((f) => {
    const qty = f.qty as number;
    cumQty += f.side === "buy" ? qty : -qty;
    cumInvested += f.side === "buy" ? f.amount : -f.amount;
    return {
      date: f.date,
      label: dayLabel(f.date),
      side: f.side,
      price: round2(f.amount / qty),
      qty,
      amount: round2(f.amount),
      cumQty: Math.round(cumQty * 1e8) / 1e8,
      cumInvested: round2(cumInvested),
    };
  });
}

export interface FlowStats {
  trades: number;
  buys: number;
  sells: number;
  avgBuy: number | null;
  largestBuy: number | null;
  totalBought: number;
  totalSold: number;
  avgBuyPrice: number | null;   // weighted by quantity
  firstDate: string | null;
  lastDate: string | null;
  activeMonths: number;
  spanMonths: number;
}

export function flowStats(items: Flow[]): FlowStats {
  const buys = items.filter((f) => f.side === "buy");
  const sells = items.filter((f) => f.side === "sell");
  const totalBought = buys.reduce((s, f) => s + f.amount, 0);
  const totalSold = sells.reduce((s, f) => s + f.amount, 0);
  const buyQty = buys.reduce((s, f) => s + (f.qty ?? 0), 0);
  const dates = items.map((f) => f.date).filter(Boolean).sort();
  const months = new Set(items.map((f) => f.date?.slice(0, 7)).filter(Boolean));
  let spanMonths = 0;
  if (dates.length) {
    const a = new Date(dates[0]), b = new Date(dates[dates.length - 1]);
    spanMonths = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
  }
  return {
    trades: items.length,
    buys: buys.length,
    sells: sells.length,
    avgBuy: buys.length ? round2(totalBought / buys.length) : null,
    largestBuy: buys.length ? round2(Math.max(...buys.map((f) => f.amount))) : null,
    totalBought: round2(totalBought),
    totalSold: round2(totalSold),
    avgBuyPrice: buyQty > 0 ? round2(totalBought / buyQty) : null,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
    activeMonths: months.size,
    spanMonths,
  };
}
