"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, LineChart, BarChart3, TrendingUp, Globe,
  Bitcoin, Gem, Wallet, PieChart, Loader2, Check,
} from "lucide-react";

export const ALL_PAGES = [
  { href: "/dashboard",          label: "Financial Dashboard",  icon: LayoutDashboard, desc: "Your insights overview"          },
  { href: "/portfolio-tracker",  label: "Portfolio Tracker",    icon: LineChart,       desc: "Historical performance snapshots" },
  { href: "/mutual-funds",       label: "Mutual Funds",         icon: BarChart3,       desc: "MF transactions & schemes"       },
  { href: "/stocks",             label: "Indian Stocks",        icon: TrendingUp,      desc: "NSE / BSE equity orders"         },
  { href: "/us-stocks",          label: "US Stocks",            icon: Globe,           desc: "Alpaca / INDMoney portfolio"     },
  { href: "/crypto",             label: "Crypto",               icon: Bitcoin,         desc: "CoinSwitch spot trades"          },
  { href: "/gold",               label: "Gold",                 icon: Gem,             desc: "Physical, digital & sovereign"   },
  { href: "/expenses",           label: "Expenses",             icon: Wallet,          desc: "Track your spending"             },
  { href: "/expenses/dashboard", label: "Expense Dashboard",    icon: PieChart,        desc: "Expense analytics & charts"      },
];

export const DEFAULT_VIEW_KEY = "default_view";
const STORAGE_KEY = "ft_default_view";

interface Props {
  onChanged?: () => void;
}

export default function DefaultViewSetting({ onChanged }: Props) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string>("/dashboard");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load current setting
  useEffect(() => {
    if (!user) return;
    // Try localStorage first for instant feedback
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) setSelected(cached);

    // Then verify with Firestore
    getDoc(doc(db, "users", user.uid, "settings", "data"))
      .then((snap) => {
        const val = snap.data()?.[DEFAULT_VIEW_KEY];
        if (val) {
          setSelected(val);
          localStorage.setItem(STORAGE_KEY, val);
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  const handleSelect = async (href: string) => {
    if (!user || saving) return;
    setSelected(href);
    setSaving(true);
    setSaved(false);
    try {
      await setDoc(
        doc(db, "users", user.uid, "settings", "data"),
        { [DEFAULT_VIEW_KEY]: href },
        { merge: true }
      );
      localStorage.setItem(STORAGE_KEY, href);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onChanged?.();
    } catch (err) {
      alert(`Failed to save: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading preferences…</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">Choose which page opens when you launch FundTracker.</p>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
            <Check className="w-3 h-3" /> Saved
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {ALL_PAGES.map((page) => {
          const Icon = page.icon;
          const isSelected = selected === page.href;
          return (
            <button
              key={page.href}
              onClick={() => handleSelect(page.href)}
              disabled={saving}
              className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all disabled:opacity-60 ${
                isSelected
                  ? "bg-sky-500/10 border-sky-500/40 text-white"
                  : "bg-gray-800/40 border-gray-700/40 text-gray-400 hover:bg-gray-800 hover:text-gray-200 hover:border-gray-600"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? "bg-sky-500/20" : "bg-gray-700/60"}`}>
                <Icon className={`w-4 h-4 ${isSelected ? "text-sky-400" : "text-gray-500"}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{page.label}</p>
                <p className="text-xs text-gray-500 truncate">{page.desc}</p>
              </div>
              {isSelected && (
                <div className="ml-auto shrink-0">
                  <div className="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
