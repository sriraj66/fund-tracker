"use client";

import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import FullscreenChartCard from "@/components/FullscreenChartCard";

export const PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899", "#84cc16", "#6b7280"];

export const axisINR = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1e7) return `₹${(v / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  return abs >= 1000 ? `₹${(v / 1000).toFixed(1)}k` : `₹${Math.round(v)}`;
};

export const chartTick = (big: boolean) => ({ fill: "#9ca3af", fontSize: big ? 12 : 10 });

export function Kpi({ label, value, sub, valueClass = "text-white" }: {
  label: string; value: string; sub?: string; valueClass?: string;
}) {
  return (
    <div className="glass-card p-3 md:p-4 min-w-0">
      <p className="text-[11px] uppercase tracking-wider text-gray-500 truncate">{label}</p>
      <p className={`text-base sm:text-lg md:text-xl font-bold mt-1 truncate ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

export function ChartTip({ active, payload, label, format }: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string; fill?: string }[];
  label?: string;
  format: (name: string, value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 sm:px-4 sm:py-3 shadow-xl text-xs sm:text-sm max-w-[80vw]">
      {label && <p className="text-white font-semibold mb-1.5 sm:mb-2">{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4 sm:gap-6">
          <span style={{ color: p.color ?? p.fill }} className="font-medium">{p.name}</span>
          <span className="text-gray-200">{format(p.name, p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Keeps the largest `n` slices and folds the rest into "Others".
export function topN(data: { name: string; value: number }[], n = 6) {
  const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= n) return sorted;
  const rest = sorted.slice(n).reduce((s, d) => s + d.value, 0);
  return [...sorted.slice(0, n), { name: "Others", value: rest }];
}

interface DonutProps {
  title: string;
  subtitle?: string;
  data: { name: string; value: number }[];
  format: (v: number) => string;
}

export function AllocationDonut({ title, subtitle, data, format }: DonutProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <FullscreenChartCard title={title} subtitle={subtitle} heightClass="h-64 sm:h-72">
      {(big) => (
        <PieChart>
          <Pie
            data={data} dataKey="value" nameKey="name"
            innerRadius={big ? "45%" : "50%"} outerRadius={big ? "75%" : "80%"}
            paddingAngle={2} stroke="none"
          >
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip
            content={<ChartTip format={(_, v) => `${format(v)} (${total > 0 ? ((v / total) * 100).toFixed(1) : 0}%)`} />}
          />
          <Legend
            verticalAlign="bottom"
            formatter={(v) => <span className="text-xs text-gray-400">{v}</span>}
            wrapperStyle={{ paddingTop: "8px" }}
          />
        </PieChart>
      )}
    </FullscreenChartCard>
  );
}
