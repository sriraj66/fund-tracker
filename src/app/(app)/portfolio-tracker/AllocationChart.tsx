"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { PieChartIcon } from "lucide-react";
import { formatINR } from "@/lib/utils";

interface Snapshot {
  gold_value?: number;
  crypto_value?: number;
  mf_value?: number;
  in_stocks_value?: number;
  us_stocks_value?: number;
  total_value?: number;
}

interface AllocationChartProps {
  latestSnapshot: Snapshot | null;
}

const COLORS = {
  gold: "#eab308", // yellow-500
  crypto: "#f97316", // orange-500
  mf: "#8b5cf6", // violet-500
  stocks: "#10b981", // emerald-500
  usStocks: "#3b82f6", // blue-500
};

export default function AllocationChart({ latestSnapshot }: AllocationChartProps) {
  if (!latestSnapshot) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
            <PieChartIcon className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Asset Allocation</h3>
            <p className="text-sm text-gray-400">Portfolio distribution</p>
          </div>
        </div>
        <div className="h-64 flex items-center justify-center">
          <p className="text-gray-500">No data available</p>
        </div>
      </div>
    );
  }

  const data = [
    {
      name: "Gold",
      value: latestSnapshot.gold_value ?? 0,
      color: COLORS.gold,
    },
    {
      name: "Crypto",
      value: latestSnapshot.crypto_value ?? 0,
      color: COLORS.crypto,
    },
    {
      name: "Mutual Funds",
      value: latestSnapshot.mf_value ?? 0,
      color: COLORS.mf,
    },
    {
      name: "Indian Stocks",
      value: latestSnapshot.in_stocks_value ?? 0,
      color: COLORS.stocks,
    },
    {
      name: "US Stocks",
      value: latestSnapshot.us_stocks_value ?? 0,
      color: COLORS.usStocks,
    },
  ].filter(item => item.value > 0);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl">
          <p className="text-white font-semibold">{data.name}</p>
          <p className="text-emerald-400 font-bold">{formatINR(data.value)}</p>
          <p className="text-gray-400 text-sm">
            {((data.value / total) * 100).toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap justify-center gap-3 mt-4">
        {payload.map((entry: any, index: number) => (
          <div key={`legend-${index}`} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-gray-300">{entry.value}</span>
            <span className="text-xs text-gray-500">
              {((entry.payload.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-500/20 to-blue-500/20 border border-sky-500/30 flex items-center justify-center">
          <PieChartIcon className="w-5 h-5 text-sky-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Asset Allocation</h3>
          <p className="text-sm text-gray-400">Current portfolio distribution</p>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={100}
              innerRadius={60}
              fill="#8884d8"
              dataKey="value"
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 p-4 bg-gray-800/40 rounded-lg border border-gray-700/50">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Total Portfolio Value</span>
          <span className="text-lg font-bold text-white">{formatINR(total)}</span>
        </div>
      </div>
    </div>
  );
}
