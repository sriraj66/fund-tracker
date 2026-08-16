"use client";

import { useMemo } from "react";
import { TrendingUp, Target, Percent } from "lucide-react";
import { formatINR } from "@/lib/utils";

interface Snapshot {
  snapshot_date: string;
  total_invested: number;
  total_value: number;
  profit: number;
  total_return_pct: number;
}

interface PortfolioAnalyticsProps {
  snapshots: Snapshot[];
}

// Calculate XIRR using Newton-Raphson method
function calculateXIRR(cashflows: { date: Date; amount: number }[]): number {
  if (cashflows.length < 2) return 0;

  const sorted = cashflows.sort((a, b) => a.date.getTime() - b.date.getTime());
  const startDate = sorted[0].date;

  // Convert to days-based cashflows
  const daysCashflows = sorted.map(cf => ({
    days: (cf.date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    amount: cf.amount
  }));

  // Newton-Raphson iteration
  let rate = 0.1; // Initial guess 10%
  const maxIterations = 100;
  const tolerance = 0.0001;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0;

    for (const cf of daysCashflows) {
      const factor = Math.pow(1 + rate, cf.days / 365);
      npv += cf.amount / factor;
      dnpv -= (cf.days / 365) * cf.amount / (factor * (1 + rate));
    }

    const newRate = rate - npv / dnpv;

    if (Math.abs(newRate - rate) < tolerance) {
      return newRate * 100; // Convert to percentage
    }

    rate = newRate;
  }

  return rate * 100;
}

export default function PortfolioAnalytics({ snapshots }: PortfolioAnalyticsProps) {
  const analytics = useMemo(() => {
    if (snapshots.length === 0) return null;

    const oldest = snapshots[0];
    const latest = snapshots[snapshots.length - 1];

    // Calculate time period in years
    const startDate = new Date(oldest.snapshot_date);
    const endDate = new Date(latest.snapshot_date);
    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const years = daysDiff / 365;

    // Calculate XIRR (assuming monthly investments)
    const cashflows: { date: Date; amount: number }[] = [];
    
    // Add investments as negative cashflows
    snapshots.forEach((snapshot, idx) => {
      if (idx === 0) {
        // First investment
        cashflows.push({
          date: new Date(snapshot.snapshot_date),
          amount: -snapshot.total_invested
        });
      } else {
        // Incremental investments
        const prevInvestment = snapshots[idx - 1].total_invested;
        const newInvestment = snapshot.total_invested - prevInvestment;
        if (newInvestment !== 0) {
          cashflows.push({
            date: new Date(snapshot.snapshot_date),
            amount: -newInvestment
          });
        }
      }
    });

    // Add final value as positive cashflow
    cashflows.push({
      date: new Date(latest.snapshot_date),
      amount: latest.total_value
    });

    const xirr = calculateXIRR(cashflows);

    // Calculate absolute return percentage (current performance)
    const absoluteReturn = latest.total_invested > 0
      ? ((latest.total_value - latest.total_invested) / latest.total_invested) * 100
      : 0;

    // Best and worst month
    const returns = snapshots.map(s => s.total_return_pct);
    const bestMonth = Math.max(...returns);
    const worstMonth = Math.min(...returns);

    // Volatility (standard deviation of returns)
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);

    // Portfolio value growth (how much the portfolio size has grown, not performance)
    const portfolioValueGrowth = oldest.total_value > 0
      ? ((latest.total_value - oldest.total_value) / oldest.total_value) * 100
      : 0;

    return {
      xirr,
      absoluteReturn,
      bestMonth,
      worstMonth,
      volatility,
      portfolioValueGrowth,
      totalProfit: latest.profit,
      totalInvested: latest.total_invested,
      currentValue: latest.total_value,
      timeperiod: years,
      months: snapshots.length,
    };
  }, [snapshots]);

  if (!analytics) return null;

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center">
          <Target className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Portfolio Analytics</h2>
          <p className="text-sm text-gray-400">Performance metrics and returns analysis</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {/* XIRR */}
        <div className="p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">XIRR</p>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{analytics.xirr.toFixed(2)}%</p>
          <p className="text-xs text-gray-500 mt-1">Annualized return</p>
        </div>

        {/* Absolute Return */}
        <div className="p-4 bg-gradient-to-br from-sky-500/10 to-sky-600/5 border border-sky-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Percent className="w-4 h-4 text-sky-400" />
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Absolute Return</p>
          </div>
          <p className="text-2xl font-bold text-sky-400">{analytics.absoluteReturn.toFixed(2)}%</p>
          <p className="text-xs text-gray-500 mt-1">Current performance</p>
        </div>

        {/* Best Month */}
        <div className="p-4 bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Best Month</p>
          </div>
          <p className="text-2xl font-bold text-green-400">{analytics.bestMonth.toFixed(2)}%</p>
          <p className="text-xs text-gray-500 mt-1">Peak return</p>
        </div>

        {/* Worst Month */}
        <div className="p-4 bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-red-400 rotate-180" />
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Worst Month</p>
          </div>
          <p className="text-2xl font-bold text-red-400">{analytics.worstMonth.toFixed(2)}%</p>
          <p className="text-xs text-gray-500 mt-1">Lowest return</p>
        </div>

        {/* Volatility */}
        <div className="p-4 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-yellow-400" />
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Volatility</p>
          </div>
          <p className="text-2xl font-bold text-yellow-400">{analytics.volatility.toFixed(2)}%</p>
          <p className="text-xs text-gray-500 mt-1">Std deviation</p>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 pt-6 border-t border-gray-800/60">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-400 mb-1">Total Invested</p>
            <p className="text-xl font-bold text-white">{formatINR(analytics.totalInvested)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Current Value</p>
            <p className="text-xl font-bold text-emerald-400">{formatINR(analytics.currentValue)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Absolute Profit</p>
            <p className={`text-xl font-bold ${analytics.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatINR(analytics.totalProfit)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Portfolio Growth</p>
            <p className="text-xl font-bold text-violet-400">{analytics.portfolioValueGrowth.toFixed(2)}%</p>
            <p className="text-xs text-gray-500 mt-0.5">Since inception</p>
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-500">
          Analysis period: {analytics.timeperiod.toFixed(1)} years ({analytics.months} months) • XIRR based on snapshot data
        </div>
      </div>
    </div>
  );
}