"use client";

import { useState, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
  Cell,
} from "recharts";
import { formatINR } from "@/lib/utils";

interface MonthlyEntry {
  id:            string;
  month:         string;
  month_label:   string;
  invested:      number;
  current_value: number;
  pnl:           number;
  pnl_pct:       number;
}

interface Props {
  entries:    MonthlyEntry[];
  onDeleted?: () => void;
}

const TIME_FRAMES = [
  { label: "3M",  months: 3  },
  { label: "6M",  months: 6  },
  { label: "1Y",  months: 12 },
  { label: "All", months: 0  },
];

type ChartTab = "value" | "pnl" | "investment";

function CustomTooltip({
  active, payload, label,
}: {
  active?:  boolean;
  payload?: { name: string; value: number; color: string }[];
  label?:   string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 shadow-xl text-sm">
      <p className="text-white font-semibold mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-6">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="text-gray-200">{formatINR(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function PnlTooltip({
  active, payload, label,
}: {
  active?:  boolean;
  payload?: { name: string; value: number; fill: string }[];
  label?:   string;
}) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value ?? 0;
  const pct = payload[1]?.value ?? 0;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 shadow-xl text-sm">
      <p className="text-white font-semibold mb-2">{label}</p>
      <div className="flex justify-between gap-6">
        <span className="text-gray-400">P&amp;L</span>
        <span className={val >= 0 ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
          {val >= 0 ? "+" : ""}₹{Math.abs(val).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </span>
      </div>
      <div className="flex justify-between gap-6">
        <span className="text-gray-400">Return</span>
        <span className={pct >= 0 ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
          {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

/* ─── Monthly Investment Bar Tooltip ─────────────────────────────────────── */
function InvestmentTooltip({
  active, payload, label,
}: {
  active?:  boolean;
  payload?: { name: string; value: number; fill: string }[];
  label?:   string;
}) {
  if (!active || !payload?.length) return null;
  const invested = payload.find((p) => p.name === "Invested")?.value ?? 0;
  const delta    = payload.find((p) => p.name === "Monthly Change")?.value ?? 0;
  const pos      = delta >= 0;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 shadow-xl text-sm">
      <p className="text-white font-semibold mb-2">{label}</p>
      <div className="flex justify-between gap-6">
        <span className="text-gray-400">Invested</span>
        <span className="text-gray-200 font-medium">{formatINR(invested)}</span>
      </div>
      <div className="flex justify-between gap-6 mt-1">
        <span className="text-gray-400">Added this month</span>
        <span className={`font-medium ${pos ? "text-emerald-400" : "text-red-400"}`}>
          {pos ? "+" : ""}{formatINR(Math.abs(delta))}
        </span>
      </div>
    </div>
  );
}

export default function StockMonthlyStats({ entries }: Props) {
  const [timeFrame, setTimeFrame] = useState("6M");
  const [tab,       setTab]       = useState<ChartTab>("investment");

  // Sort ascending for chart
  const sorted = useMemo(
    () => [...entries].sort((a, b) => a.month.localeCompare(b.month)),
    [entries],
  );

  const tf      = TIME_FRAMES.find((t) => t.label === timeFrame)!;
  const sliced  = tf.months === 0 ? sorted : sorted.slice(-tf.months);

  const chartData = sliced.map((e) => ({
    month:         e.month_label,
    Invested:      Math.round(Number(e.invested)),
    "Current":     Math.round(Number(e.current_value)),
    "P&L":         Math.round(Number(e.pnl)),
    "Return %":    Number(e.pnl_pct),
  }));

  // Monthly investment bar chart — how much was added each month
  const investmentData = sliced.map((e, i, arr) => {
    const prev  = i > 0 ? Number(arr[i - 1].invested) : Number(e.invested);
    const delta = i > 0 ? Math.round(Number(e.invested) - prev) : 0;
    return {
      month:            e.month_label,
      Invested:         Math.round(Number(e.invested)),
      "Monthly Change": delta,
    };
  });

  // Latest month's investment delta for headline callout
  const latestDelta = investmentData.length > 1
    ? investmentData[investmentData.length - 1]["Monthly Change"]
    : null;

  if (entries.length === 0) return null;

  return (
    <div className="glass-card p-4 md:p-6 space-y-4">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">
            {tab === "investment" ? "Monthly Investment" : "Portfolio Performance"}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {tab === "investment"
              ? "How much you invested in stocks each month"
              : tab === "value"
              ? "Invested vs. current value over time"
              : "Unrealised P&L over time"}
          </p>
        </div>

        <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:items-center sm:flex-wrap sm:justify-end">
          {/* Tab switch — full width on mobile */}
          <div className="flex items-center gap-1 bg-gray-800/60 rounded-lg p-1 w-full sm:w-auto">
            {(["investment", "value", "pnl"] as ChartTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  tab === t ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {t === "investment" ? "Monthly" : t === "value" ? "Inv vs Cur" : "P&L"}
              </button>
            ))}
          </div>

          {/* Time frame */}
          <div className="flex items-center gap-1 bg-gray-800/60 rounded-lg p-1 w-full sm:w-auto">
            {TIME_FRAMES.map((t) => (
              <button
                key={t.label}
                onClick={() => setTimeFrame(t.label)}
                className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  timeFrame === t.label
                    ? "bg-emerald-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Monthly Investment callout banner (only on investment tab) ── */}
      {tab === "investment" && latestDelta !== null && sliced.length > 1 && (
        <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm
          ${latestDelta >= 0
            ? "bg-emerald-500/10 border border-emerald-500/20"
            : "bg-red-500/10 border border-red-500/20"}`}>
          <div className={`text-lg font-bold ${latestDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {latestDelta >= 0 ? "↑" : "↓"}
          </div>
          <div>
            <p className={`font-semibold ${latestDelta >= 0 ? "text-emerald-300" : "text-red-300"}`}>
              {latestDelta >= 0 ? "+" : ""}
              {formatINR(Math.abs(latestDelta))} invested this month
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {sliced[sliced.length - 1].month_label} vs {sliced[sliced.length - 2].month_label}
              {" — "}Total invested: {formatINR(Number(sliced[sliced.length - 1].invested))}
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="h-52 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          {tab === "investment" ? (
            <BarChart data={investmentData} barCategoryGap="30%" margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: "#9ca3af", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                width={44}
              />
              <Tooltip content={<InvestmentTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <ReferenceLine y={0} stroke="#374151" />
              {/* Cumulative invested — area line in background */}
              <Bar dataKey="Invested" fill="#1d4ed8" opacity={0.18} radius={[3,3,0,0]} maxBarSize={36} />
              {/* Monthly change — coloured bars in foreground */}
              <Bar dataKey="Monthly Change" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {investmentData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={
                      i === 0
                        ? "#6b7280"                                       // first month — grey (no delta)
                        : entry["Monthly Change"] >= 0
                        ? "#10b981"                                       // added — green
                        : "#ef4444"                                       // withdrew — red
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          ) : tab === "value" ? (
            <AreaChart data={chartData} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="investedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6b7280" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6b7280" stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="currentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: "#9ca3af", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                width={44}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(v) => <span className="text-xs text-gray-400">{v}</span>}
                wrapperStyle={{ paddingTop: "12px" }}
              />
              <Area
                type="monotone"
                dataKey="Invested"
                stroke="#6b7280"
                strokeWidth={2}
                fill="url(#investedGrad)"
                dot={{ r: 3, fill: "#6b7280" }}
                activeDot={{ r: 5 }}
              />
              <Area
                type="monotone"
                dataKey="Current"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#currentGrad)"
                dot={{ r: 3, fill: "#3b82f6" }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          ) : (
            <BarChart data={chartData} barCategoryGap="35%" margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: "#9ca3af", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                width={44}
              />
              <Tooltip content={<PnlTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <ReferenceLine y={0} stroke="#374151" />
              <Bar
                dataKey="P&L"
                radius={[3, 3, 0, 0]}
                maxBarSize={40}
                label={false}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry["P&L"] >= 0 ? "#10b981" : "#ef4444"}
                  />
                ))}
              </Bar>
              <Bar dataKey="Return %" hide />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
