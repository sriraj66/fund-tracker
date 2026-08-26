"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { PieChartIcon, Maximize2, X } from "lucide-react";
import { formatINR } from "@/lib/utils";

interface Snapshot {
  gold_value?: number;
  crypto_value?: number;
  mf_value?: number;
  in_stocks_value?: number;
  us_stocks_value?: number;
}

const SEGMENTS = [
  { key: "Gold",          field: "gold_value" as const,      color: "#eab308" },
  { key: "Crypto",        field: "crypto_value" as const,    color: "#f97316" },
  { key: "Mutual Funds",  field: "mf_value" as const,        color: "#8b5cf6" },
  { key: "Indian Stocks", field: "in_stocks_value" as const, color: "#10b981" },
  { key: "US Stocks",     field: "us_stocks_value" as const, color: "#3b82f6" },
];

interface Props { latestSnapshot: Snapshot | null; }

function CustomTooltip({ active, payload, total }: { active?: boolean; payload?: { name: string; value: number; payload: { color: string } }[]; total: number }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 shadow-xl text-sm">
      <p className="text-white font-semibold mb-1">{p.name}</p>
      <p className="font-bold" style={{ color: p.payload.color }}>{formatINR(p.value)}</p>
      <p className="text-gray-400 text-xs mt-0.5">{((p.value / total) * 100).toFixed(1)}% of portfolio</p>
    </div>
  );
}

function Chart({ data, total, hiddenSegments }: { data: { name: string; value: number; color: string }[]; total: number; hiddenSegments: Set<string> }) {
  const visible = data.filter(d => !hiddenSegments.has(d.name));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={visible} cx="50%" cy="50%" outerRadius="75%" innerRadius="42%"
          dataKey="value" paddingAngle={2} strokeWidth={0}>
          {visible.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip total={total} />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export default function AllocationChart({ latestSnapshot }: Props) {
  const [hiddenSegments, setHiddenSegments] = useState<Set<string>>(new Set());
  const [maximized, setMaximized] = useState(false);

  const toggle = (name: string) =>
    setHiddenSegments(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  if (!latestSnapshot) {
    return (
      <div className="glass-card p-6 flex flex-col items-center justify-center min-h-[320px]">
        <PieChartIcon className="w-8 h-8 text-gray-600 mb-3" />
        <p className="text-gray-500 text-sm">No allocation data</p>
      </div>
    );
  }

  const data = SEGMENTS
    .map(s => ({ name: s.key, value: Number(latestSnapshot[s.field] ?? 0), color: s.color }))
    .filter(d => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  const Legend = () => (
    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
      {data.map(d => {
        const hidden = hiddenSegments.has(d.name);
        const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
        return (
          <button key={d.name} onClick={() => toggle(d.name)}
            className={`flex items-center gap-2 text-xs rounded-md px-2 py-1 transition-all ${hidden ? "opacity-30" : "opacity-100"} hover:bg-gray-800/60`}>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-gray-300 font-medium">{d.name}</span>
            <span className="text-gray-500">{pct}%</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <PieChartIcon className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Asset Allocation</h3>
              <p className="text-xs text-gray-500">Click legend to toggle segments</p>
            </div>
          </div>
          <button onClick={() => setMaximized(true)}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800/60 transition-colors"
            title="Maximize">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        <div className="h-64">
          <Chart data={data} total={total} hiddenSegments={hiddenSegments} />
        </div>

        <Legend />

        <div className="mt-4 pt-4 border-t border-gray-800/60 flex items-center justify-between">
          <span className="text-xs text-gray-500">Total Portfolio Value</span>
          <span className="text-base font-bold text-white">{formatINR(total)}</span>
        </div>

        {/* Allocation bars */}
        <div className="mt-3 space-y-2">
          {data.filter(d => !hiddenSegments.has(d.name)).map(d => {
            const pct = total > 0 ? (d.value / total) * 100 : 0;
            return (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <span className="w-20 text-gray-400 truncate">{d.name}</span>
                <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: d.color }} />
                </div>
                <span className="w-12 text-right text-gray-300 font-medium">{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Maximize Modal */}
      {maximized && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMaximized(false)} />
          <div className="relative glass-card w-full max-w-2xl p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Asset Allocation</h3>
              <button onClick={() => setMaximized(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="h-96">
              <Chart data={data} total={total} hiddenSegments={hiddenSegments} />
            </div>
            <Legend />
            <div className="mt-6 grid grid-cols-2 gap-3">
              {data.filter(d => !hiddenSegments.has(d.name)).map(d => (
                <div key={d.name} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800/40">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-sm text-gray-300">{d.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white">{formatINR(d.value)}</div>
                    <div className="text-xs text-gray-500">{((d.value / total) * 100).toFixed(1)}%</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-800/60 flex items-center justify-between">
              <span className="text-sm text-gray-400">Total Portfolio Value</span>
              <span className="text-xl font-bold text-white">{formatINR(total)}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
