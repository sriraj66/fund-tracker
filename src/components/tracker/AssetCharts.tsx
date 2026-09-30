"use client";

import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import FullscreenChartCard from "@/components/FullscreenChartCard";
import { formatINR } from "@/lib/utils";
import type { TradePoint } from "@/lib/assetAnalytics";
import { ChartTip, axisINR, chartTick } from "./chartKit";

const margin = { left: 0, right: 8, top: 8, bottom: 0 };
const grid = <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />;

export const fmtPrice = (n: number) => (Math.abs(n) > 0 && Math.abs(n) < 1 ? `₹${n.toFixed(6)}` : formatINR(n));

const xAxis = (big: boolean, key = "label") => (
  <XAxis dataKey={key} tick={chartTick(big)} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={big ? 24 : 16} />
);
const yMoney = (big: boolean) => (
  <YAxis tick={chartTick(big)} axisLine={false} tickLine={false} tickFormatter={axisINR} width={big ? 64 : 54} />
);

export function MonthlyFlowChart({ rows, title, subtitle, buyName = "Bought", sellName = "Sold" }: {
  rows: { label: string; Buy: number; Sell: number }[];
  title: string;
  subtitle?: string;
  buyName?: string;
  sellName?: string;
}) {
  const showSell = rows.some((r) => r.Sell > 0);
  return (
    <FullscreenChartCard title={title} subtitle={subtitle}>
      {(big) => (
        <BarChart data={rows} margin={margin} barCategoryGap="25%">
          {grid}{xAxis(big)}{yMoney(big)}
          <Tooltip content={<ChartTip format={(_, v) => formatINR(v)} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          {showSell && <Legend formatter={(v) => <span className="text-xs text-gray-400">{v}</span>} wrapperStyle={{ paddingTop: "12px" }} />}
          <Bar name={buyName} dataKey="Buy" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={big ? 48 : 28} />
          {showSell && <Bar name={sellName} dataKey="Sell" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={big ? 48 : 28} />}
        </BarChart>
      )}
    </FullscreenChartCard>
  );
}

// Per-item drill-down: what you paid each time vs your average, and how the position was built.
export function DrillDownCharts({ points, avgPrice, priceTitle, priceName }: {
  points: TradePoint[];
  avgPrice: number | null;
  priceTitle: string;
  priceName: string;
}) {
  const buys = points.filter((p) => p.side === "buy");
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <FullscreenChartCard title={priceTitle} subtitle="Dotted line is your weighted average price">
        {(big) => (
          <LineChart data={buys} margin={margin}>
            {grid}{xAxis(big)}
            <YAxis
              tick={chartTick(big)} axisLine={false} tickLine={false} width={big ? 72 : 60}
              domain={["auto", "auto"]} tickFormatter={(v: number) => (Math.abs(v) < 1 ? v.toFixed(4) : axisINR(v))}
            />
            <Tooltip content={<ChartTip format={(_, v) => fmtPrice(v)} />} />
            {avgPrice !== null && <ReferenceLine y={avgPrice} stroke="#f59e0b" strokeDasharray="4 4" />}
            <Line type="monotone" name={priceName} dataKey="price" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: "#3b82f6" }} activeDot={{ r: 5 }} />
          </LineChart>
        )}
      </FullscreenChartCard>

      <FullscreenChartCard title="Cumulative Invested" subtitle="Net amount put in after each transaction">
        {(big) => (
          <AreaChart data={points} margin={margin}>
            <defs>
              <linearGradient id="ddCum" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            {grid}{xAxis(big)}{yMoney(big)}
            <Tooltip content={<ChartTip format={(_, v) => formatINR(v)} />} />
            <Area type="stepAfter" name="Invested" dataKey="cumInvested" stroke="#10b981" strokeWidth={2} fill="url(#ddCum)" />
          </AreaChart>
        )}
      </FullscreenChartCard>
    </div>
  );
}
