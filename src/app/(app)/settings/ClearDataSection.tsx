"use client";

import { useState } from "react";
import { Trash2, Loader2, AlertCircle } from "lucide-react";
import { auth } from "@/lib/firebase/config";

interface ClearDataSectionProps {
  counts: { mf: number; stocks: number; usStocks: number; crypto: number; gold: number; snapshots: number };
  totalCount: number;
  onCleared?: () => void;
}

export default function ClearDataSection({ counts, totalCount, onCleared }: ClearDataSectionProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleClear = async (type: string, displayName: string) => {
    const confirmMsg = type === "all"
      ? `Are you sure you want to DELETE ALL ${totalCount} records? This action CANNOT be undone!`
      : `Are you sure you want to delete all ${displayName} data? This action CANNOT be undone!`;
    if (!window.confirm(confirmMsg)) return;

    if (type === "all") {
      const doubleConfirm = window.prompt('Type "DELETE ALL" to confirm:');
      if (doubleConfirm !== "DELETE ALL") { setError("Confirmation text did not match. Action cancelled."); return; }
    }

    setLoading(type); setError(""); setSuccess("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const endpoint = type === "all" ? "/api/clear/all" : `/api/clear/${type}`;
      const response = await fetch(endpoint, { method: "DELETE", headers: token ? { authorization: `Bearer ${token}` } : {} });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to clear data");
      setSuccess(data.message || `Successfully cleared ${displayName} data`);
      onCleared?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(null);
    }
  };

  const fundTypes = [
    { type: "mf", name: "Mutual Funds", count: counts.mf, colorClass: "border-violet-500/20 hover:border-violet-500/40" },
    { type: "stocks", name: "Indian Stocks", count: counts.stocks, colorClass: "border-emerald-500/20 hover:border-emerald-500/40" },
    { type: "us-stocks", name: "US Stocks", count: counts.usStocks, colorClass: "border-blue-500/20 hover:border-blue-500/40" },
    { type: "crypto", name: "Crypto", count: counts.crypto, colorClass: "border-orange-500/20 hover:border-orange-500/40" },
    { type: "gold", name: "Gold", count: counts.gold, colorClass: "border-yellow-500/20 hover:border-yellow-500/40" },
    { type: "snapshots", name: "Portfolio Snapshots", count: counts.snapshots, colorClass: "border-purple-500/20 hover:border-purple-500/40" },
  ];

  return (
    <div className="space-y-6">
      {error && (<div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg"><AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" /><p className="text-red-400 text-sm">{error}</p></div>)}
      {success && (<div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg"><AlertCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" /><p className="text-emerald-400 text-sm">{success}</p></div>)}

      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Clear Data by Type</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fundTypes.map((fund) => (
            <div key={fund.type} className={`p-4 bg-gray-800/40 border rounded-lg transition-all ${fund.colorClass}`}>
              <div className="flex items-center justify-between">
                <div><h4 className="font-semibold text-white">{fund.name}</h4><p className="text-sm text-gray-400">{fund.count} record{fund.count !== 1 ? "s" : ""}</p></div>
                <button onClick={() => handleClear(fund.type, fund.name)} disabled={loading !== null || fund.count === 0} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
                  {loading === fund.type ? <><Loader2 className="w-4 h-4 animate-spin" />Clearing...</> : <><Trash2 className="w-4 h-4" />Clear</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-6 border-t border-gray-800/60">
        <h3 className="text-lg font-semibold text-white mb-4">Clear All Data</h3>
        <div className="p-6 bg-red-500/5 border border-red-500/30 rounded-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="font-semibold text-red-400 mb-2">Delete Everything</h4>
              <p className="text-sm text-gray-400 mb-1">This will permanently delete all your data:</p>
              <ul className="text-sm text-gray-500 space-y-1 mt-2"><li>• All transactions ({totalCount} records)</li><li>• Portfolio snapshots</li><li>• User settings</li></ul>
              <p className="text-sm text-red-400 font-semibold mt-3">⚠️ This action is IRREVERSIBLE!</p>
            </div>
            <button onClick={() => handleClear("all", "All Data")} disabled={loading !== null || totalCount === 0} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 whitespace-nowrap">
              {loading === "all" ? <><Loader2 className="w-4 h-4 animate-spin" />Deleting...</> : <><Trash2 className="w-4 h-4" />Delete All</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}