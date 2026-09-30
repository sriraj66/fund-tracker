import { formatINR, formatUSD } from "@/lib/utils";

export type Currency = "USD" | "INR";

// Portfolio Tracker snapshot; per-asset fields are `<asset>_invested` / `<asset>_value` (INR).
export type TrackerAssetKey = "us_stocks" | "crypto" | "gold" | "mf" | "in_stocks";

export interface PortfolioSnapshot {
  id: string;
  snapshot_date: string;
  total_value?: number;
  [field: string]: unknown;
}

export interface UsPoint {
  id: string;
  date: string;
  label: string;
  invested: number;
  value: number;
  pnl: number;
  ret: number;            // cumulative return %
  share: number | null;   // % of total portfolio value
  dInvested: number;      // net contribution since previous snapshot
  dValue: number;
  marketGain: number;     // dValue - dInvested
  periodRet: number | null; // market return % for the period (excludes new money)
}

export const moneyFmt = (c: Currency) => (c === "USD" ? formatUSD : formatINR);
export const currencySymbol = (c: Currency) => (c === "USD" ? "$" : "₹");

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildSeries(
  snaps: PortfolioSnapshot[], asset: TrackerAssetKey, rate: number, currency: Currency,
): UsPoint[] {
  const f = currency === "USD" ? 1 / rate : 1;
  const inv = (s: PortfolioSnapshot) => Number(s[`${asset}_invested`] ?? 0);
  const val = (s: PortfolioSnapshot) => Number(s[`${asset}_value`] ?? 0);
  const usable = snaps
    .filter((s) => inv(s) > 0 || val(s) > 0)
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

  return usable.map((s, i) => {
    const invested = inv(s) * f;
    const value = val(s) * f;
    const prev = i > 0 ? usable[i - 1] : null;
    const pInv = prev ? inv(prev) * f : invested;
    const pVal = prev ? val(prev) * f : value;
    const dInvested = invested - pInv;
    const dValue = value - pVal;
    const marketGain = dValue - dInvested;
    const total = Number(s.total_value ?? 0);
    return {
      id: s.id,
      date: s.snapshot_date,
      label: new Date(s.snapshot_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }),
      invested: round2(invested),
      value: round2(value),
      pnl: round2(value - invested),
      ret: invested > 0 ? round2(((value - invested) / invested) * 100) : 0,
      share: total > 0 ? round2(((val(s)) / total) * 100) : null,
      dInvested: round2(dInvested),
      dValue: round2(dValue),
      marketGain: round2(marketGain),
      periodRet: prev && pVal > 0 ? round2((marketGain / pVal) * 100) : null,
    };
  });
}

export function sliceByMonths(series: UsPoint[], months: number): UsPoint[] {
  if (months === 0 || series.length === 0) return series;
  const last = new Date(series[series.length - 1].date);
  const cutoff = new Date(last.getFullYear(), last.getMonth() - months, last.getDate());
  return series.filter((p) => new Date(p.date) >= cutoff);
}

export interface UsAnalysis {
  totalContributed: number;
  marketGain: number;
  twr: number | null;         // time-weighted return %, chained from period returns
  annualised: number | null;  // % p.a., only when the range spans >= 30 days
  avgPeriodRet: number | null;
  volatility: number | null;  // std dev of period returns
  winRate: { up: number; total: number } | null;
  best: UsPoint | null;
  worst: UsPoint | null;
  peak: UsPoint | null;
  maxDrawdown: number | null; // % fall of value from a running peak, ignoring new contributions
  shareFrom: number | null;
  shareTo: number | null;
}

export function analyse(series: UsPoint[]): UsAnalysis {
  const empty: UsAnalysis = {
    totalContributed: 0, marketGain: 0, twr: null, annualised: null, avgPeriodRet: null,
    volatility: null, winRate: null, best: null, worst: null, peak: null, maxDrawdown: null,
    shareFrom: null, shareTo: null,
  };
  if (series.length === 0) return empty;

  const first = series[0];
  const last = series[series.length - 1];
  const periods = series.slice(1).filter((p) => p.periodRet !== null);
  const rets = periods.map((p) => p.periodRet as number);

  const twr = rets.length ? (rets.reduce((acc, r) => acc * (1 + r / 100), 1) - 1) * 100 : null;
  const days = (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86_400_000;
  const annualised = twr !== null && days >= 30 ? (Math.pow(1 + twr / 100, 365 / days) - 1) * 100 : null;
  const avg = rets.length ? rets.reduce((s, r) => s + r, 0) / rets.length : null;
  const vol = rets.length > 1 && avg !== null
    ? Math.sqrt(rets.reduce((s, r) => s + (r - avg) ** 2, 0) / (rets.length - 1))
    : null;

  // Drawdown on cumulative market growth so that deposits/withdrawals don't distort it.
  let growth = 1, peakGrowth = 1, maxDd = 0;
  for (const p of periods) {
    growth *= 1 + (p.periodRet as number) / 100;
    peakGrowth = Math.max(peakGrowth, growth);
    maxDd = Math.max(maxDd, (peakGrowth - growth) / peakGrowth);
  }

  return {
    totalContributed: round2(last.invested - first.invested),
    marketGain: round2(series.reduce((s, p, i) => (i === 0 ? s : s + p.marketGain), 0)),
    twr: twr === null ? null : round2(twr),
    annualised: annualised === null ? null : round2(annualised),
    avgPeriodRet: avg === null ? null : round2(avg),
    volatility: vol === null ? null : round2(vol),
    winRate: periods.length ? { up: periods.filter((p) => (p.periodRet as number) > 0).length, total: periods.length } : null,
    best: periods.length ? periods.reduce((a, b) => ((b.periodRet as number) > (a.periodRet as number) ? b : a)) : null,
    worst: periods.length ? periods.reduce((a, b) => ((b.periodRet as number) < (a.periodRet as number) ? b : a)) : null,
    peak: series.reduce((a, b) => (b.value > a.value ? b : a)),
    maxDrawdown: periods.length ? round2(maxDd * 100) : null,
    shareFrom: first.share,
    shareTo: last.share,
  };
}
