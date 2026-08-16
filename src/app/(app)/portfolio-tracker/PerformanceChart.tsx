"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  ComposedChart,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { format } from "date-fns";

interface Snapshot {
  snapshot_date: string;
  total_invested: number;
  total_value: number;
  profit: number;
  gold_value?: number;
  crypto_value?: number;
  mf_value?: number;
  in_stocks_value?: number;
  us_stocks_value?: number;
}

interface PerformanceChartProps {
  snapshots: Snapshot[];
}

export default function PerformanceChart({ snapshots }: PerformanceChartProps) {
  if (snapshots.length === 0) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Performance Trend</h3>
            <p className="text-sm text-gray-400">Portfolio value over time</p>
          </div>
        </div>
        <div className="h-64 flex items-center justify-center">
          <p className="text-gray-500">No data available</p>
        </div>
      </div>
    );
  }

  const chartData = snapshots.map((snapshot) => ({
    date: format(new Date(snapshot.snapshot_date), "MMM yy"),
    fullDate: snapshot.snapshot_date,
    invested: snapshot.total_invested,
    value: snapshot.total_value,
    profit: snapshot.profit,
    gold: snapshot.gold_value ?? 0,
    crypto: snapshot.crypto_value ?? 0,
    mf: snapshot.mf_value ?? 0,
    stocks: snapshot.in_stocks_value ?? 0,
    usStocks: snapshot.us_stocks_value ?? 0,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-xl">
          <p className="text-white font-semibold mb-2">
            {format(new Date(data.fullDate), "MMM dd, yyyy")}
          </p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Invested:</span>
              <span className="text-white font-medium">{formatINR(data.invested)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Current:</span>
              <span className="text-emerald-400 font-bold">{formatINR(data.value)}</span>
            </div>
            <div className="flex justify-between gap-4 pt-1 border-t border-gray-700">
              <span className="text-gray-400">Profit:</span>
              <span className={`font-semibold ${data.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatINR(data.profit)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Performance Trend</h3>
          <p className="text-sm text-gray-400">Portfolio value vs investment over time</p>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="date"
              stroke="#9ca3af"
              tick={{ fill: "#9ca3af", fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              stroke="#9ca3af"
              tick={{ fill: "#9ca3af", fontSize: 12 }}
              tickLine={false}
              tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: "20px" }}
              iconType="line"
              formatter={(value) => (
                <span className="text-sm text-gray-300">{value}</span>
              )}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#10b981"
              strokeWidth={0}
              fill="url(#colorValue)"
            />
            <Line
              type="monotone"
              dataKey="invested"
              stroke="#6b7280"
              strokeWidth={2}
              dot={{ fill: "#6b7280", r: 3 }}
              activeDot={{ r: 5 }}
              name="Invested"
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ fill: "#10b981", r: 4 }}
              activeDot={{ r: 6 }}
              name="Current Value"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="p-3 bg-gray-800/40 rounded-lg border border-gray-700/50">
          <p className="text-xs text-gray-400 mb-1">Starting Value</p>
          <p className="text-lg font-bold text-white">
            {formatINR(chartData[0]?.invested ?? 0)}
          </p>
        </div>
        <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
          <p className="text-xs text-gray-400 mb-1">Current Value</p>
          <p className="text-lg font-bold text-emerald-400">
            {formatINR(chartData[chartData.length - 1]?.value ?? 0)}
          </p>
        </div>
      </div>
    </div>
  );
}
