"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { Settings as SettingsIcon, AlertTriangle } from "lucide-react";
import ClearDataSection from "./ClearDataSection";
import InstallPWA from "./InstallPWA";
import DefaultViewSetting from "./DefaultViewSetting";
import FontSizeSetting from "./FontSizeSetting";

interface Counts {
  snapshots: number;
  expenses: number;
}

const ZERO: Counts = { snapshots: 0, expenses: 0 };

export default function SettingsPage() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Counts>(ZERO);
  const [loading, setLoading] = useState(true);

  const fetchCounts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const uid = user.uid;
      const safe = (col: string) =>
        getDocs(collection(db, "users", uid, col)).catch(() => ({ size: 0 }));

      const [snap, expenses] = await Promise.all([
        safe("portfolio_snapshots"),
        safe("expenses"),
      ]);

      setCounts({ snapshots: snap.size, expenses: expenses.size });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchCounts(); }, [user]);

  const totalCount = counts.snapshots + counts.expenses;

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your account and data</p>
      </div>

      {/* Font Size */}
      <div className="glass-card">
        <div className="p-4 md:p-6 border-b border-gray-800/60">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
              <span className="text-violet-400 font-bold text-lg">Aa</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Font Size</h2>
              <p className="text-sm text-gray-400">Adjust text size across the app</p>
            </div>
          </div>
        </div>
        <div className="p-4 md:p-6">
          <FontSizeSetting />
        </div>
      </div>

      {/* Default View */}
      <div className="glass-card">
        <div className="p-4 md:p-6 border-b border-gray-800/60">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Default View</h2>
              <p className="text-sm text-gray-400">Page to open when you launch the app</p>
            </div>
          </div>
        </div>
        <div className="p-4 md:p-6">
          <DefaultViewSetting />
        </div>
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

      {/* Install App (PWA) — at the bottom */}
      <div className="glass-card">
        <div className="p-4 md:p-6 border-b border-gray-800/60">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Install App</h2>
              <p className="text-sm text-gray-400">Add FundTracker to your home screen</p>
            </div>
          </div>
        </div>
        <div className="p-4 md:p-6">
          <InstallPWA />
        </div>
      </div>
    </div>
  );
}
