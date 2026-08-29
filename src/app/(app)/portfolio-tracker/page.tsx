"use client";

import { useEffect, useState, useMemo } from "react";
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

const SNAPSHOT_PAGE_SIZE = 5;

function PaginationBar({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * SNAPSHOT_PAGE_SIZE + 1;
  const to = Math.min(page * SNAPSHOT_PAGE_SIZE, total);
  return (
    <div className="px-4 py-3 md:px-6 border-t border-gray-800/60 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
      <div className="flex items-center gap-1 flex-wrap justify-center order-1 sm:order-2">
        <button onClick={() => onPage(1)} disabled={page === 1} className="px-2 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">«</button>
        <button onClick={() => onPage(page - 1)} disabled={page === 1} className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹ Prev</button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
          <button key={p} onClick={() => onPage(p)}
            className={`hidden sm:inline-flex px-3 py-1.5 rounded text-xs font-medium transition-colors ${page === p ? "bg-sky-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>
            {p}
          </button>
        ))}
        <span className="sm:hidden text-xs text-gray-500 px-2">{page} / {totalPages}</span>
        <button onClick={() => onPage(page + 1)} disabled={page === totalPages} className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next ›</button>
        <button onClick={() => onPage(totalPages)} disabled={page === totalPages} className="px-2 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">»</button>
      </div>
      <p className="text-xs text-gray-500 order-2 sm:order-1 text-center sm:text-left">
        Showing <span className="text-gray-300 font-medium">{from}–{to}</span> of{" "}
        <span className="text-gray-300 font-medium">{total}</span> snapshots
      </p>
    </div>
  );
}

export default function PortfolioTrackerPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshotPage, setSnapshotPage] = useState(1);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "users", user.uid, "portfolio_snapshots"), orderBy("snapshot_date", "asc")));
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Snapshot)));
      setSnapshotPage(1);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [user]);

  const reversedRows = useMemo(() => rows.slice().reverse(), [rows]);
  const snapshotTotalPages = Math.max(1, Math.ceil(reversedRows.length / SNAPSHOT_PAGE_SIZE));
  const paginatedSnapshots = useMemo(() =>
    reversedRows.slice((snapshotPage - 1) * SNAPSHOT_PAGE_SIZE, snapshotPage * SNAPSHOT_PAGE_SIZE),
    [reversedRows, snapshotPage]
  );

  const latestSnapshot = rows[rows.length - 1];
  const absoluteReturn = latestSnapshot && latestSnapshot.total_invested > 0 ? ((latestSnapshot.total_value - latestSnapshot.total_invested) / latestSnapshot.total_invested) * 100 : 0;
  const absoluteProfit = latestSnapshot ? latestSnapshot.total_value - latestSnapshot.total_invested : 0;

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div><h1 className="text-xl md:text-2xl font-bold text-white">Portfolio Tracker</h1><p className="text-gray-400 text-sm mt-1">Historical portfolio performance snapshots</p></div>
        <div className="page-header-actions">
          <ImportButton endpoint="/api/import/portfolio-snapshots" accept=".xlsx,.xls,.csv" label="Import Snapshots" hint="Upload your portfolio tracking sheet" onSuccess={fetchData} />
          <SnapshotAddModal onAdded={fetchData} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="glass-card p-6 md:p-12 text-center">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full">
            <div className="glass-card p-4 md:p-6">
              <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center"><Calendar className="w-5 h-5 text-sky-400" /></div><div><p className="text-xs text-gray-500 uppercase tracking-wider">Latest Snapshot</p><p className="text-lg font-semibold text-white">{latestSnapshot ? formatDate(latestSnapshot.snapshot_date) : "—"}</p></div></div>
              <div className="text-2xl font-bold text-white">{latestSnapshot ? formatINR(latestSnapshot.total_value) : "—"}</div>
              <p className="text-sm text-gray-400 mt-1">Invested: {latestSnapshot ? formatINR(latestSnapshot.total_invested) : "—"}</p>
            </div>
            <div className="glass-card p-4 md:p-6">
              <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-emerald-400" /></div><div><p className="text-xs text-gray-500 uppercase tracking-wider">Absolute Return</p><p className="text-lg font-semibold text-emerald-400">{absoluteReturn.toFixed(2)}%</p></div></div>
              <div className="text-2xl font-bold text-emerald-400">{formatINR(absoluteProfit)}</div>
              <p className="text-sm text-gray-400 mt-1">Current performance</p>
            </div>
            <div className="glass-card p-4 md:p-6">
              <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-violet-400" /></div><div><p className="text-xs text-gray-500 uppercase tracking-wider">Snapshots</p><p className="text-lg font-semibold text-white">{rows.length}</p></div></div>
              <div className="text-2xl font-bold text-white">{rows.length} months</div>
              <p className="text-sm text-gray-400 mt-1">Historical data points</p>
            </div>
          </div>

          <PortfolioAnalytics snapshots={rows} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AllocationChart latestSnapshot={latestSnapshot} />
            <PerformanceChart snapshots={rows} />
          </div>

          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-800/60 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Snapshot History</h2>
                <p className="text-xs text-gray-500 mt-0.5">{rows.length} total snapshots</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Date</th><th className="text-right">Gold</th><th className="text-right">Crypto</th><th className="text-right">MF</th><th className="text-right">IN Stocks</th><th className="text-right">US Stocks</th><th className="text-right">Total Invested</th><th className="text-right">Total Value</th><th className="text-right">Return %</th><th className="text-right">Profit</th></tr></thead>
                <tbody>
                  {paginatedSnapshots.map((s) => (
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
            <PaginationBar page={snapshotPage} totalPages={snapshotTotalPages} total={reversedRows.length} onPage={setSnapshotPage} />
          </div>
        </>
      )}
    </div>
  );
}
