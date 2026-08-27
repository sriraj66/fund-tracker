"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { Settings as SettingsIcon, AlertTriangle } from "lucide-react";
import ClearDataSection from "./ClearDataSection";

interface Counts { mf: number; stocks: number; usStocks: number; crypto: number; gold: number; snapshots: number; }

export default function SettingsPage() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Counts>({ mf: 0, stocks: 0, usStocks: 0, crypto: 0, gold: 0, snapshots: 0 });
  const [loading, setLoading] = useState(true);

  const fetchCounts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const uid = user.uid;
      const [mf, stocks, us, crypto, gold, snap] = await Promise.all([
        getDocs(collection(db, "users", uid, "mf_transactions")),
        getDocs(collection(db, "users", uid, "stock_transactions")),
        getDocs(collection(db, "users", uid, "us_stock_transactions")),
        getDocs(collection(db, "users", uid, "crypto_transactions")),
        getDocs(collection(db, "users", uid, "gold_transactions")),
        getDocs(collection(db, "users", uid, "portfolio_snapshots")),
      ]);
      setCounts({ mf: mf.size, stocks: stocks.size, usStocks: us.size, crypto: crypto.size, gold: gold.size, snapshots: snap.size });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchCounts(); }, [user]);

  const totalCount = Object.values(counts).reduce((s, c) => s + c, 0);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your account and data</p>
      </div>

      <div className="glass-card border-2 border-red-500/20">
        <div className="p-4 md:p-6 border-b border-gray-800/60">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center"><AlertTriangle className="w-6 h-6 text-red-400" /></div>
            <div><h2 className="text-xl font-bold text-white">Danger Zone</h2><p className="text-sm text-gray-400">Irreversible actions - proceed with caution</p></div>
          </div>
        </div>
        <div className="p-4 md:p-6 space-y-6">
          <ClearDataSection counts={counts} totalCount={totalCount} onCleared={fetchCounts} />
        </div>
      </div>

      <div className="glass-card">
        <div className="p-4 md:p-6 border-b border-gray-800/60">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center"><SettingsIcon className="w-6 h-6 text-sky-400" /></div>
            <div><h2 className="text-xl font-bold text-white">Account Information</h2><p className="text-sm text-gray-400">Your profile details</p></div>
          </div>
        </div>
        <div className="p-4 md:p-6 space-y-4">
          <div><label className="block text-sm font-semibold text-gray-400 mb-1">Display Name</label><div className="text-white font-medium">{user?.displayName ?? "—"}</div></div>
          <div><label className="block text-sm font-semibold text-gray-400 mb-1">Email</label><div className="text-white font-medium">{user?.email}</div></div>
          <div><label className="block text-sm font-semibold text-gray-400 mb-1">User ID</label><div className="text-gray-500 text-xs font-mono">{user?.uid}</div></div>
          <div><label className="block text-sm font-semibold text-gray-400 mb-1">Total Records</label><div className="text-white font-medium">{totalCount.toLocaleString()} transactions</div></div>
        </div>
      </div>
    </div>
  );
}