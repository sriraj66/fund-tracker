"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { formatINR, formatNumber } from "@/lib/utils";
import Link from "next/link";

interface CryptoTx { id: string; market: string; coin: string; trade_type: string; volume?: number; total_inr?: number; tds_amount?: number; fee_amount?: number; transaction_date: string; }

export default function CryptoDiagnosticPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CryptoTx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      try {
        const snap = await getDocs(query(collection(db, "users", user.uid, "crypto_transactions"), orderBy("transaction_date", "asc")));
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CryptoTx)));
      } finally { setLoading(false); }
    };
    fetch();
  }, [user]);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" /></div>;

  // Group by coin
  const coinMap = new Map<string, { buys: number; sells: number; buyVol: number; sellVol: number; tds: number; fees: number; txCount: number }>();
  for (const t of rows) {
    const ex = coinMap.get(t.coin) ?? { buys: 0, sells: 0, buyVol: 0, sellVol: 0, tds: 0, fees: 0, txCount: 0 };
    if (t.trade_type === "BUY") { ex.buys += Number(t.total_inr ?? 0); ex.buyVol += Number(t.volume ?? 0); }
    else { ex.sells += Number(t.total_inr ?? 0); ex.sellVol += Number(t.volume ?? 0); }
    ex.tds += Number(t.tds_amount ?? 0);
    ex.fees += Number(t.fee_amount ?? 0);
    ex.txCount += 1;
    coinMap.set(t.coin, ex);
  }

  const totalBuys = rows.filter((t) => t.trade_type === "BUY").reduce((s, t) => s + Number(t.total_inr ?? 0), 0);
  const totalSells = rows.filter((t) => t.trade_type === "SELL").reduce((s, t) => s + Number(t.total_inr ?? 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Crypto Diagnostic</h1>
          <p className="text-gray-400 text-sm mt-1">Detailed breakdown of all crypto transactions</p>
        </div>
        <Link href="/crypto" className="btn-secondary">← Back to Crypto</Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4"><p className="text-gray-400 text-sm">Total Transactions</p><p className="text-2xl font-bold text-white">{rows.length}</p></div>
        <div className="glass-card p-4"><p className="text-gray-400 text-sm">Total Buys (INR)</p><p className="text-2xl font-bold text-emerald-400">{formatINR(totalBuys)}</p></div>
        <div className="glass-card p-4"><p className="text-gray-400 text-sm">Total Sells (INR)</p><p className="text-2xl font-bold text-red-400">{formatINR(totalSells)}</p></div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800/60"><h2 className="text-base font-semibold text-white">Breakdown by Coin</h2></div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Coin</th><th className="text-right">Txns</th><th className="text-right">Buy Vol</th><th className="text-right">Sell Vol</th><th className="text-right">Net Vol</th><th className="text-right">Total Bought (₹)</th><th className="text-right">Total Sold (₹)</th><th className="text-right">Net (₹)</th><th className="text-right">TDS</th><th className="text-right">Fees</th></tr></thead>
            <tbody>
              {Array.from(coinMap.entries()).map(([coin, d]) => (
                <tr key={coin}>
                  <td><span className="font-mono font-semibold text-orange-400">{coin}</span></td>
                  <td className="text-right text-gray-400">{d.txCount}</td>
                  <td className="text-right text-gray-300">{formatNumber(d.buyVol, 8)}</td>
                  <td className="text-right text-gray-300">{formatNumber(d.sellVol, 8)}</td>
                  <td className={`text-right font-medium ${d.buyVol - d.sellVol > 0 ? "text-emerald-400" : "text-red-400"}`}>{formatNumber(d.buyVol - d.sellVol, 8)}</td>
                  <td className="text-right text-emerald-400">{formatINR(d.buys)}</td>
                  <td className="text-right text-red-400">{formatINR(d.sells)}</td>
                  <td className={`text-right font-semibold ${d.buys - d.sells >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatINR(d.buys - d.sells)}</td>
                  <td className="text-right text-yellow-400 text-xs">{formatINR(d.tds)}</td>
                  <td className="text-right text-gray-400 text-xs">{formatINR(d.fees)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}