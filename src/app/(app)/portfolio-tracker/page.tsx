"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { formatINR, formatDate } from "@/lib/utils";
import { TrendingUp, Calendar, BarChart3 } from "lucide-react";
import ImportButton from "@/components/ImportButton";
import SnapshotAddModal from "./SnapshotAddModal";
import PortfolioAnalytics from "./PortfolioAnalytics";
import AllocationChart from "./AllocationChart";
import PerformanceChart from "./PerformanceChart";

interface Snapshot {
  id: string; snapshot_date: string; total_invested: number; total_value: number; total_return_pct: number;
  profit: number; gold_value: number; crypto_value: number; mf_value: number; in_stocks_value: number; us_stocks_value: number;
  gold_invested?: number; crypto_invested?: number; mf_invested?: number; in_stocks_invested?: number; us_stocks_invested?: number;
}

export default function PortfolioTrackerPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "users", user.uid, "portfolio_snapshots"), orderBy("snapshot_date", "asc")));
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Snapshot)));
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [user]);

  const latestSnapshot = rows[rows.length - 1];
  const absoluteReturn = latestSnapshot && latestSnapshot.total_invested > 0 ? ((latestSnapshot.total_value - latestSnapshot.total_invested) / latestSnapshot.total_invested) * 100 : 0;
  const absoluteProfit = latestSnapshot ? latestSnapshot.total_value - latestSnapshot.total_invested : 0;

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">Portfolio Tracker</h1><p className="text-gray-400 text-sm mt-1">Historical portfolio performance snapshots</p></div>
        <div className="flex items-center gap-2">
          <ImportButton endpoint="/api/import/portfolio-snapshots" accept=".xlsx,.xls,.csv" label="Import Snapshots" hint="Upload your portfolio tracking sheet" />
          <SnapshotAddModal onAdded={fetchData} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-sky-500/10 flex items-center justify-center mx-auto mb-4"><BarChart3 className="w-8 h-8 text-sky-400" /></div>
          <h3 className="text-lg font-semibold text-white mb-2">No Portfolio Snapshots Yet</h3>
          <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">Import your historical portfolio data or manually add snapshots to track performance over time</p>
          <div className="flex items-center justify-center gap-3">
            <ImportButton endpoint="/api/import/portfolio-snapshots" accept=".xlsx,.xls,.csv" label="Import Data" hint="Excel or CSV file" />
            <SnapshotAddModal onAdded={fetchData} />
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center"><Calendar className="w-5 h-5 text-sky-400" /></div><div><p className="text-xs text-gray-500 uppercase tracking-wider">Latest Snapshot</p><p className="text-lg font-semibold text-white">{latestSnapshot ? formatDate(latestSnapshot.snapshot_date) : "—"}</p></div></div>
              <div className="text-2xl font-bold text-white">{latestSnapshot ? formatINR(latestSnapshot.total_value) : "—"}</div>
              <p className="text-sm text-gray-400 mt-1">Invested: {latestSnapshot ? formatINR(latestSnapshot.total_invested) : "—"}</p>
            </div>
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-emerald-400" /></div><div><p className="text-xs text-gray-500 uppercase tracking-wider">Absolute Return</p><p className="text-lg font-semibold text-emerald-400">{absoluteReturn.toFixed(2)}%</p></div></div>
              <div className="text-2xl font-bold text-emerald-400">{formatINR(absoluteProfit)}</div>
              <p className="text-sm text-gray-400 mt-1">Current performance</p>
            </div>
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-violet-400" /></div><div><p className="text-xs text-gray-500 uppercase tracking-wider">Snapshots</p><p className="text-lg font-semibold text-white">{rows.length}</p></div></div>
              <div className="text-2xl font-bold text-white">{rows.length} months</div>
              <p className="text-sm text-gray-400 mt-1">Historical data points</p>
            </div>
          </div>

          <PortfolioAnalytics snapshots={rows} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AllocationChart latestSnapshot={latestSnapshot} />
            <PerformanceChart snapshots={rows} />
          </div>

          <div className="glass-card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800/60"><h2 className="text-base font-semibold text-white">Snapshot History</h2></div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Date</th><th className="text-right">Gold</th><th className="text-right">Crypto</th><th className="text-right">MF</th><th className="text-right">IN Stocks</th><th className="text-right">US Stocks</th><th className="text-right">Total Invested</th><th className="text-right">Total Value</th><th className="text-right">Return %</th><th className="text-right">Profit</th></tr></thead>
                <tbody>
                  {rows.slice().reverse().map((s) => (
                    <tr key={s.id}>
                      <td className="font-medium text-white">{formatDate(s.snapshot_date)}</td>
                      <td className="text-right text-yellow-400">{formatINR(s.gold_value ?? 0)}</td>
                      <td className="text-right text-orange-400">{formatINR(s.crypto_value ?? 0)}</td>
                      <td className="text-right text-violet-400">{formatINR(s.mf_value ?? 0)}</td>
                      <td className="text-right text-emerald-400">{formatINR(s.in_stocks_value ?? 0)}</td>
                      <td className="text-right text-blue-400">{formatINR(s.us_stocks_value ?? 0)}</td>
                      <td className="text-right text-gray-300">{formatINR(s.total_invested ?? 0)}</td>
                      <td className="text-right font-semibold text-white">{formatINR(s.total_value ?? 0)}</td>
                      <td className={`text-right font-medium ${(s.total_return_pct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>{(s.total_return_pct ?? 0).toFixed(2)}%</td>
                      <td className={`text-right font-medium ${(s.profit ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatINR(s.profit ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
