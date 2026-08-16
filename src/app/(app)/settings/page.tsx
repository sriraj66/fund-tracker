import { createClient } from "@/lib/supabase/server";
import { Settings as SettingsIcon, Trash2, AlertTriangle } from "lucide-react";
import ClearDataSection from "./ClearDataSection";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div>Unauthorized</div>;
  }

  // Get counts for each data type
  const [mfCount, stocksCount, usStocksCount, cryptoCount, goldCount, snapshotsCount] = await Promise.all([
    supabase.from("mf_transactions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("stock_transactions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("us_stock_transactions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("crypto_transactions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("gold_transactions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("portfolio_snapshots").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  const counts = {
    mf: mfCount.count ?? 0,
    stocks: stocksCount.count ?? 0,
    usStocks: usStocksCount.count ?? 0,
    crypto: cryptoCount.count ?? 0,
    gold: goldCount.count ?? 0,
    snapshots: snapshotsCount.count ?? 0,
  };

  const totalCount = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your account and data</p>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="glass-card border-2 border-red-500/20">
        <div className="p-6 border-b border-gray-800/60">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Danger Zone</h2>
              <p className="text-sm text-gray-400">Irreversible actions - proceed with caution</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <ClearDataSection counts={counts} totalCount={totalCount} />
        </div>
      </div>

      {/* User Info */}
      <div className="glass-card">
        <div className="p-6 border-b border-gray-800/60">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
              <SettingsIcon className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Account Information</h2>
              <p className="text-sm text-gray-400">Your profile details</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-400 mb-1">Email</label>
            <div className="text-white font-medium">{user.email}</div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-400 mb-1">User ID</label>
            <div className="text-gray-500 text-xs font-mono">{user.id}</div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-400 mb-1">Total Records</label>
            <div className="text-white font-medium">{totalCount.toLocaleString()} transactions</div>
          </div>
        </div>
      </div>
    </div>
  );
}
