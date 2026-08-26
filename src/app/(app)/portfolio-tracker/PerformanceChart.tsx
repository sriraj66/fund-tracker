"use client";

import { useState, useMemo } from "react";
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Maximize2, X } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { format, subMonths } from "date-fns";

interface Snapshot {
  snapshot_date: string;
  total_invested: number;
  total_value: number;
  profit: number;
  total_return_pct: number;
}

interface Props { snapshots: Snapshot[]; }

const TIME_FRAMES = [
  { label: "3M",  months: 3 },
  { label: "6M",  months: 6 },
  { label: "1Y",  months: 12 },
  { label: "2Y",  months: 24 },
  { label: "All", months: 0 },
];

const LINES = [
  { key: "invested",   name: "Invested",      color: "#6b7280", strokeWidth: 2, dashed: true },
  { key: "value",      name: "Current Value", color: "#10b981", strokeWidth: 3, dashed: false },
];

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: { date: string; invested: number; value: number; profit: number } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 shadow-xl text-sm min-w-[180px]">
      <p className="text-white font-semibold mb-2">{d.date}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4"><span className="text-gray-400">Invested</span><span className="text-gray-200 font-medium">{formatINR(d.invested)}</span></div>
        <div className="flex justify-between gap-4"><span className="text-emerald-400">Value</span><span className="text-emerald-400 font-bold">{formatINR(d.value)}</span></div>
        <div className="flex justify-between gap-4 pt-1 border-t border-gray-700/60">
          <span className="text-gray-400">Profit</span>
          <span className={`font-semibold ${d.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatINR(d.profit)}</span>
        </div>
      </div>
    </div>
  );
}

function ChartInner({ chartData, hiddenLines }: { chartData: { date: string; invested: number; value: number; profit: number }[]; hiddenLines: Record<string, boolean> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false}
          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} width={52} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#374151", strokeWidth: 1 }} />
        {!hiddenLines["value"] && (
          <Area type="monotone" dataKey="value" stroke="none" fill="url(#perfGrad)" />
        )}
        {LINES.map(l => (
          !hiddenLines[l.key] && (
            <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color}
              strokeWidth={l.strokeWidth} strokeDasharray={l.dashed ? "5 3" : undefined}
              dot={false} activeDot={{ r: 4, fill: l.color }} />
          )
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export default function PerformanceChart({ snapshots }: Props) {
  const [timeFrame, setTimeFrame] = useState("All");
  const [hiddenLines, setHiddenLines] = useState<Record<string, boolean>>({});
  const [maximized, setMaximized] = useState(false);

  const toggleLine = (key: string) =>
    setHiddenLines(prev => ({ ...prev, [key]: !prev[key] }));

  const chartData = useMemo(() => {
    const tf = TIME_FRAMES.find(t => t.label === timeFrame)!;
    const cutoff = tf.months === 0 ? null : subMonths(new Date(), tf.months);
    const filtered = cutoff
      ? snapshots.filter(s => new Date(s.snapshot_date) >= cutoff)
      : snapshots;
    return filtered.map(s => ({
      date: format(new Date(s.snapshot_date), "MMM yy"),
      invested: s.total_invested,
      value: s.total_value,
      profit: s.profit,
    }));
  }, [snapshots, timeFrame]);

  const first = chartData[0];
  const last = chartData[chartData.length - 1];
  const gain = last && first ? last.value - first.value : 0;
  const gainPct = first?.value > 0 ? (gain / first.value) * 100 : 0;

  // Best & worst month from ALL snapshots (not filtered)
  const bestSnap = [...snapshots].sort((a, b) => b.total_return_pct - a.total_return_pct)[0];
  const worstSnap = [...snapshots].sort((a, b) => a.total_return_pct - b.total_return_pct)[0];
  const bestMonthLabel = bestSnap ? format(new Date(bestSnap.snapshot_date), "MMM yyyy") : "—";
  const worstMonthLabel = worstSnap ? format(new Date(worstSnap.snapshot_date), "MMM yyyy") : "—";

  // Max drawdown from ALL snapshots
  const allValues = snapshots.map(s => s.total_value);
  let peak = allValues[0] ?? 0;
  let maxDrawdown = 0;
  for (const v of allValues) {
    if (v > peak) peak = v;
    const dd = peak > 0 ? ((peak - v) / peak) * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  if (snapshots.length === 0) {
    return (
      <div className="glass-card p-6 flex flex-col items-center justify-center min-h-[320px]">
        <TrendingUp className="w-8 h-8 text-gray-600 mb-3" />
        <p className="text-gray-500 text-sm">No performance data</p>
      </div>
    );
  }

  const Legend = () => (
    <div className="flex items-center gap-4 mt-4">
      {LINES.map(l => (
        <button key={l.key} onClick={() => toggleLine(l.key)}
          className={`flex items-center gap-1.5 text-xs transition-opacity ${hiddenLines[l.key] ? "opacity-30" : "opacity-100"}`}>
          <span className="w-6 h-0.5 inline-block rounded" style={{
            backgroundColor: l.color,
            borderTop: l.dashed ? `2px dashed ${l.color}` : undefined,
            background: l.dashed ? "none" : l.color,
          }} />
          <span className="text-gray-400">{l.name}</span>
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Performance Trend</h3>
              <p className="text-xs text-gray-500">Value vs investment over time</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-800/60 rounded-lg p-1">
              {TIME_FRAMES.map(tf => (
                <button key={tf.label} onClick={() => setTimeFrame(tf.label)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${timeFrame === tf.label ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white"}`}>
                  {tf.label}
                </button>
              ))}
            </div>
            <button onClick={() => setMaximized(true)}
              className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800/60 transition-colors">
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="h-64">
          <ChartInner chartData={chartData} hiddenLines={hiddenLines} />
        </div>

        <Legend />

        <div className="mt-4 pt-4 border-t border-gray-800/60 space-y-3">
          {/* Row 1: value summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-0.5">Start Value</p>
              <p className="text-sm font-bold text-white">{formatINR(first?.value ?? 0)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-0.5">Current Value</p>
              <p className="text-sm font-bold text-emerald-400">{formatINR(last?.value ?? 0)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-0.5">Return ({timeFrame})</p>
              <p className={`text-sm font-bold ${gain >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {gain >= 0 ? "+" : ""}{gainPct.toFixed(1)}%
              </p>
            </div>
          </div>
          {/* Row 2: best / worst month / max drawdown */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-800/40">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-0.5">Best Month</p>
              <p className="text-sm font-bold text-green-400">+{(bestSnap?.total_return_pct ?? 0).toFixed(2)}%</p>
              <p className="text-xs text-gray-600 mt-0.5">{bestMonthLabel}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-0.5">Worst Month</p>
              <p className={`text-sm font-bold ${(worstSnap?.total_return_pct ?? 0) >= 0 ? "text-yellow-400" : "text-red-400"}`}>
                {(worstSnap?.total_return_pct ?? 0) >= 0 ? "+" : ""}{(worstSnap?.total_return_pct ?? 0).toFixed(2)}%
              </p>
              <p className="text-xs text-gray-600 mt-0.5">{worstMonthLabel}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-0.5">Max Drawdown</p>
              <p className={`text-sm font-bold ${maxDrawdown > 0 ? "text-rose-400" : "text-gray-400"}`}>
                -{maxDrawdown.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-600 mt-0.5">Peak-to-trough</p>
            </div>
          </div>
        </div>
      </div>

      {/* Maximize Modal */}
      {maximized && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMaximized(false)} />
          <div className="relative glass-card w-full max-w-4xl p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Performance Trend</h3>
                <p className="text-xs text-gray-500">{chartData.length} data points</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-gray-800/60 rounded-lg p-1">
                  {TIME_FRAMES.map(tf => (
                    <button key={tf.label} onClick={() => setTimeFrame(tf.label)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${timeFrame === tf.label ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white"}`}>
                      {tf.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setMaximized(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="h-96">
              <ChartInner chartData={chartData} hiddenLines={hiddenLines} />
            </div>
            <Legend />
            <div className="mt-4 pt-4 border-t border-gray-800/60 grid grid-cols-4 gap-3">
              <div className="p-3 bg-gray-800/40 rounded-lg text-center">
                <p className="text-xs text-gray-500 mb-1">Start Value</p>
                <p className="text-base font-bold text-white">{formatINR(first?.value ?? 0)}</p>
              </div>
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-center">
                <p className="text-xs text-gray-500 mb-1">Current Value</p>
                <p className="text-base font-bold text-emerald-400">{formatINR(last?.value ?? 0)}</p>
              </div>
              <div className="p-3 bg-gray-800/40 rounded-lg text-center">
                <p className="text-xs text-gray-500 mb-1">Total Invested</p>
                <p className="text-base font-bold text-white">{formatINR(last?.invested ?? 0)}</p>
              </div>
              <div className={`p-3 rounded-lg text-center border ${gain >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                <p className="text-xs text-gray-500 mb-1">Period Gain</p>
                <p className={`text-base font-bold ${gain >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {gain >= 0 ? "+" : ""}{gainPct.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
