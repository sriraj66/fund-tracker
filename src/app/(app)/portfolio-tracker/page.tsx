import { createClient } from "@/lib/supabase/server";
import { formatINR, formatDate } from "@/lib/utils";
import { TrendingUp, Calendar, BarChart3 } from "lucide-react";
import ImportButton from "@/components/ImportButton";
import SnapshotAddModal from "./SnapshotAddModal";
import PortfolioAnalytics from "./PortfolioAnalytics";
import AllocationChart from "./AllocationChart";
import PerformanceChart from "./PerformanceChart";

export default async function PortfolioTrackerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: snapshots } = await supabase
    .from("portfolio_snapshots")
    .select("*")
    .eq("user_id", user!.id)
    .order("snapshot_date", { ascending: true });

  const rows = snapshots ?? [];

  const latestSnapshot = rows[rows.length - 1];
  const oldestSnapshot = rows[0];

  const absoluteReturn = latestSnapshot && latestSnapshot.total_invested > 0
    ? ((latestSnapshot.total_value - latestSnapshot.total_invested) / latestSnapshot.total_invested) * 100
    : 0;

  const absoluteProfit = latestSnapshot
    ? latestSnapshot.total_value - latestSnapshot.total_invested
    : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Portfolio Tracker</h1>
          <p className="text-gray-400 text-sm mt-1">Historical portfolio performance snapshots</p>
        </div>
        <div className="flex items-center gap-2">
          <ImportButton
            endpoint="/api/import/portfolio-snapshots"
            accept=".xlsx,.xls,.csv"
            label="Import Snapshots"
            hint="Upload your portfolio tracking sheet"
          />
          <SnapshotAddModal userId={user!.id} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-sky-500/10 flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-sky-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No Portfolio Snapshots Yet</h3>
          <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
            Import your historical portfolio data or manually add snapshots to track performance over time
          </p>
          <div className="flex items-center justify-center gap-3">
            <ImportButton
              endpoint="/api/import/portfolio-snapshots"
              accept=".xlsx,.xls,.csv"
              label="Import Data"
              hint="Excel or CSV file with DATE, TYPE, INVESTED, TOTAL, % columns"
            />
            <SnapshotAddModal userId={user!.id} />
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Latest Snapshot</p>
                  <p className="text-lg font-semibold text-white">
                    {latestSnapshot ? formatDate(latestSnapshot.snapshot_date) : "—"}
                  </p>
                </div>
              </div>
              <div className="text-2xl font-bold text-white">
                {latestSnapshot ? formatINR(latestSnapshot.total_value) : "—"}
              </div>
              <p className="text-sm text-gray-400 mt-1">
                Invested: {latestSnapshot ? formatINR(latestSnapshot.total_invested) : "—"}
              </p>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Absolute Return</p>
                  <p className="text-lg font-semibold text-emerald-400">
                    {absoluteReturn.toFixed(2)}%
                  </p>
                </div>
              </div>
              <div className="text-2xl font-bold text-emerald-400">
                {formatINR(absoluteProfit)}
              </div>
              <p className="text-sm text-gray-400 mt-1">
                Current performance
              </p>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Snapshots</p>
                  <p className="text-lg font-semibold text-white">{rows.length}</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-white">
                {rows.length} months
              </div>
              <p className="text-sm text-gray-400 mt-1">Historical data points</p>
            </div>
          </div>

          {/* Analytics Section */}
          <PortfolioAnalytics snapshots={rows} />

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AllocationChart latestSnapshot={latestSnapshot} />
            <PerformanceChart snapshots={rows} />
          </div>

          {/* Snapshot History Table */}
          <div className="glass-card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800/60">
              <h2 className="text-base font-semibold text-white">Snapshot History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="text-right">Gold</th>
                    <th className="text-right">Crypto</th>
                    <th className="text-right">MF</th>
                    <th className="text-right">IN Stocks</th>
                    <th className="text-right">US Stocks</th>
                    <th className="text-right">Total Invested</th>
                    <th className="text-right">Total Value</th>
                    <th className="text-right">Return %</th>
                    <th className="text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice().reverse().map((snapshot) => (
                    <tr key={snapshot.id}>
                      <td className="font-medium text-white">
                        {formatDate(snapshot.snapshot_date)}
                      </td>
                      <td className="text-right text-yellow-400">
                        {formatINR(snapshot.gold_value ?? 0)}
                      </td>
                      <td className="text-right text-orange-400">
                        {formatINR(snapshot.crypto_value ?? 0)}
                      </td>
                      <td className="text-right text-violet-400">
                        {formatINR(snapshot.mf_value ?? 0)}
                      </td>
                      <td className="text-right text-emerald-400">
                        {formatINR(snapshot.in_stocks_value ?? 0)}
                      </td>
                      <td className="text-right text-blue-400">
                        {formatINR(snapshot.us_stocks_value ?? 0)}
                      </td>
                      <td className="text-right text-gray-300">
                        {formatINR(snapshot.total_invested ?? 0)}
                      </td>
                      <td className="text-right font-semibold text-white">
                        {formatINR(snapshot.total_value ?? 0)}
                      </td>
                      <td className={`text-right font-medium ${
                        (snapshot.total_return_pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {(snapshot.total_return_pct ?? 0).toFixed(2)}%
                      </td>
                      <td className={`text-right font-medium ${
                        (snapshot.profit ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {formatINR(snapshot.profit ?? 0)}
                      </td>
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
