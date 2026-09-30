"use client";

import { useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, Cell,
} from "recharts";
import FullscreenChartCard from "@/components/FullscreenChartCard";
import { ChartTip, Kpi } from "./chartKit";
import { type Currency, type UsAnalysis, type UsPoint, moneyFmt, currencySymbol } from "@/lib/trackerAnalytics";

interface Props {
  title: string;          // asset name, e.g. "Gold"
  series: UsPoint[];      // already limited to the selected time range
  analysis: UsAnalysis;
  currency: Currency;
}

const pct = (n: number | null, digits = 2) => (n === null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`);
const tone = (n: number | null) => (n === null ? "text-gray-300" : n >= 0 ? "text-emerald-400" : "text-red-400");

export default function TrackerAnalysis({ title, series, analysis: a, currency }: Props) {
  const fmt = moneyFmt(currency);
  const sym = currencySymbol(currency);

  const axisMoney = (v: number) => {
    const abs = Math.abs(v);
    if (currency === "INR" && abs >= 1e5) return `${sym}${(v / 1e5).toFixed(1)}L`;
    return abs >= 1000 ? `${sym}${(v / 1000).toFixed(1)}k` : `${sym}${Math.round(v)}`;
  };
  const axisPct = (v: number) => `${v}%`;
  const tick = (big: boolean) => ({ fill: "#9ca3af", fontSize: big ? 12 : 10 });
  const margin = { left: 0, right: 8, top: 8, bottom: 0 };
  const grid = <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />;
  const xAxis = (big: boolean) => (
    <XAxis dataKey="label" tick={tick(big)} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={big ? 24 : 16} />
  );
  const yMoney = (big: boolean) => (
    <YAxis tick={tick(big)} axisLine={false} tickLine={false} tickFormatter={axisMoney} width={big ? 60 : 50} />
  );
  const yPct = (big: boolean) => (
    <YAxis tick={tick(big)} axisLine={false} tickLine={false} tickFormatter={axisPct} width={big ? 52 : 42} />
  );
  const moneyTip = (name: string, v: number) => `${v < 0 ? "-" : ""}${fmt(Math.abs(v))}`;
  const pctTip = (name: string, v: number) => pct(v);

  const withShare = useMemo(() => series.filter((p) => p.share !== null), [series]);
  const periods = useMemo(() => series.slice(1).filter((p) => p.periodRet !== null), [series]);

  if (series.length === 0) return null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
        <Kpi label="Time-weighted return" value={pct(a.twr)} valueClass={tone(a.twr)} sub="Excludes new deposits" />
        <Kpi label="Annualised return" value={pct(a.annualised, 1)} valueClass={tone(a.annualised)} sub={a.annualised === null ? "Needs 30+ days of data" : "Approx. per year"} />
        <Kpi label="Net contributed" value={`${a.totalContributed < 0 ? "-" : ""}${fmt(Math.abs(a.totalContributed))}`} sub="Change in invested amount" />
        <Kpi label="Market gain" value={`${a.marketGain < 0 ? "-" : "+"}${fmt(Math.abs(a.marketGain))}`} valueClass={tone(a.marketGain)} sub="Value change minus new money" />
        <Kpi label="Avg period return" value={pct(a.avgPeriodRet)} valueClass={tone(a.avgPeriodRet)} sub={`${periods.length} period${periods.length !== 1 ? "s" : ""}`} />
        <Kpi label="Volatility" value={a.volatility === null ? "—" : `${a.volatility.toFixed(2)}%`} sub="Std dev of period returns" />
        <Kpi label="Win rate" value={a.winRate ? `${Math.round((a.winRate.up / a.winRate.total) * 100)}%` : "—"} sub={a.winRate ? `${a.winRate.up} of ${a.winRate.total} periods up` : undefined} />
        <Kpi label="Max drawdown" value={a.maxDrawdown === null ? "—" : `-${a.maxDrawdown.toFixed(2)}%`} valueClass={a.maxDrawdown ? "text-red-400" : "text-white"} sub="Peak to trough" />
        <Kpi label="Best period" value={a.best ? pct(a.best.periodRet) : "—"} valueClass="text-emerald-400" sub={a.best?.label} />
        <Kpi label="Worst period" value={a.worst ? pct(a.worst.periodRet) : "—"} valueClass="text-red-400" sub={a.worst?.label} />
        <Kpi label="Peak value" value={a.peak ? fmt(a.peak.value) : "—"} sub={a.peak?.label} />
        <Kpi
          label="Portfolio share"
          value={a.shareTo === null ? "—" : `${a.shareTo.toFixed(1)}%`}
          sub={a.shareFrom !== null && series.length > 1 ? `from ${a.shareFrom.toFixed(1)}%` : "of total portfolio"}
        />
      </div>

      {/* Invested vs current */}
      <FullscreenChartCard title="Invested vs Current Value" subtitle="Gap between the lines is your unrealised P&L" heightClass="h-60 sm:h-72">
        {(big) => (
          <AreaChart data={series} margin={margin}>
            <defs>
              <linearGradient id="usInv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6b7280" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#6b7280" stopOpacity={0.03} />
              </linearGradient>
              <linearGradient id="usCur" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            {grid}{xAxis(big)}{yMoney(big)}
            <Tooltip content={<ChartTip format={moneyTip} />} />
            <Legend formatter={(v) => <span className="text-xs text-gray-400">{v}</span>} wrapperStyle={{ paddingTop: "12px" }} />
            <Area type="monotone" name="Invested" dataKey="invested" stroke="#6b7280" strokeWidth={2} fill="url(#usInv)" dot={{ r: 3, fill: "#6b7280" }} activeDot={{ r: 5 }} />
            <Area type="monotone" name="Current" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#usCur)" dot={{ r: 3, fill: "#3b82f6" }} activeDot={{ r: 5 }} />
          </AreaChart>
        )}
      </FullscreenChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Cumulative return */}
        <FullscreenChartCard title="Return Trend" subtitle="Cumulative return on invested amount">
          {(big) => (
            <LineChart data={series} margin={margin}>
              {grid}{xAxis(big)}{yPct(big)}
              <Tooltip content={<ChartTip format={pctTip} />} />
              <ReferenceLine y={0} stroke="#374151" />
              <Line type="monotone" name="Return" dataKey="ret" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: "#10b981" }} activeDot={{ r: 5 }} />
            </LineChart>
          )}
        </FullscreenChartCard>

        {/* Portfolio share */}
        <FullscreenChartCard title="Share of Total Portfolio" subtitle={`${title} as a % of your Portfolio Tracker total`}>
          {(big) =>
            withShare.length > 0 ? (
              <AreaChart data={withShare} margin={margin}>
                <defs>
                  <linearGradient id="usShare" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                {grid}{xAxis(big)}{yPct(big)}
                <Tooltip content={<ChartTip format={pctTip} />} />
                <Area type="monotone" name="Share" dataKey="share" stroke="#8b5cf6" strokeWidth={2} fill="url(#usShare)" dot={{ r: 3, fill: "#8b5cf6" }} activeDot={{ r: 5 }} />
              </AreaChart>
            ) : (
              <BarChart data={[]} />
            )
          }
        </FullscreenChartCard>

        {/* Contribution vs market */}
        <FullscreenChartCard title="New Money vs Market Gain" subtitle="What drove the change in value each period">
          {(big) => (
            <BarChart data={periods} margin={margin} barCategoryGap="30%">
              {grid}{xAxis(big)}{yMoney(big)}
              <Tooltip content={<ChartTip format={moneyTip} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Legend formatter={(v) => <span className="text-xs text-gray-400">{v}</span>} wrapperStyle={{ paddingTop: "12px" }} />
              <ReferenceLine y={0} stroke="#374151" />
              <Bar name="New money" dataKey="dInvested" stackId="g" fill="#3b82f6" maxBarSize={big ? 56 : 32} />
              <Bar name="Market gain" dataKey="marketGain" stackId="g" maxBarSize={big ? 56 : 32}>
                {periods.map((p, i) => <Cell key={i} fill={p.marketGain >= 0 ? "#10b981" : "#ef4444"} />)}
              </Bar>
            </BarChart>
          )}
        </FullscreenChartCard>

        {/* Period return */}
        <FullscreenChartCard title="Period Market Return" subtitle="% change in value per snapshot, excluding new money">
          {(big) => (
            <BarChart data={periods} margin={margin} barCategoryGap="30%">
              {grid}{xAxis(big)}{yPct(big)}
              <Tooltip content={<ChartTip format={pctTip} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <ReferenceLine y={0} stroke="#374151" />
              <Bar name="Return" dataKey="periodRet" radius={[3, 3, 0, 0]} maxBarSize={big ? 56 : 32}>
                {periods.map((p, i) => <Cell key={i} fill={(p.periodRet ?? 0) >= 0 ? "#10b981" : "#ef4444"} />)}
              </Bar>
            </BarChart>
          )}
        </FullscreenChartCard>
      </div>
    </div>
  );
}
