"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import StatCard from "@/components/StatCard";
import { BarChart3, TrendingUp, Globe, Bitcoin, Gem, Wallet, Receipt } from "lucide-react";
import { formatINR, formatUSD, formatDate } from "@/lib/utils";
import Link from "next/link";

export default function DashboardPage() {
  const { user } = useAuth();
  const [expenseThisMonth, setExpenseThisMonth] = useState<number>(0);
  const [expenseCount, setExpenseCount] = useState<number>(0);

  const [data, setData] = useState<{
    usdToInr: number;
    mfData: { amount: number; transaction_type: string }[];
    stockData: { value: number; transaction_type: string }[];
    usData: { amount: number; side: string }[];
    cryptoData: { total_inr: number; trade_type: string }[];
    goldData: { amount: number }[];
    goldHoldingsData: { invested_amount: number }[];
    recentMf: { id: string; scheme_name: string; amount: number; transaction_date: string; transaction_type: string }[];
    recentStocks: { id: string; stock_name: string; symbol: string; value: number; execution_date: string; transaction_type: string }[];
    recentUs: { id: string; symbol: string; amount: number; transaction_date: string; side: string }[];
    recentCrypto: { id: string; coin: string; market: string; total_inr: number; transaction_date: string; trade_type: string }[];
    recentGold: { id: string; grams: number; amount: number; purchase_date: string; gold_type: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

    async function fetchAll() {
      try {
        const base = (col: string) => collection(db, "users", uid, col);

        const [mfSnap, stockSnap, usSnap, cryptoSnap, goldSnap, goldHoldingsSnap, settingsSnap,
               recentMfSnap, recentStockSnap, recentUsSnap, recentCryptoSnap, recentGoldSnap] = await Promise.all([
          getDocs(base("mf_transactions")),
          getDocs(base("stock_transactions")),
          getDocs(base("us_stock_transactions")),
          getDocs(base("crypto_transactions")),
          getDocs(base("gold_transactions")),
          getDocs(base("gold_holdings")),
          getDocs(collection(db, "users", uid, "settings")),
          getDocs(query(base("mf_transactions"), orderBy("transaction_date", "desc"), limit(3))),
          getDocs(query(base("stock_transactions"), orderBy("execution_date", "desc"), limit(3))),
          getDocs(query(base("us_stock_transactions"), orderBy("transaction_date", "desc"), limit(3))),
          getDocs(query(base("crypto_transactions"), orderBy("transaction_date", "desc"), limit(3))),
          getDocs(query(base("gold_transactions"), orderBy("purchase_date", "desc"), limit(3))),
        ]);

        // Fetch expense total for current month
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        try {
          const expSnap = await getDocs(collection(db, "users", uid, "expenses"));
          const allExp = expSnap.docs.map((d) => d.data() as { amount: number; date: string });
          const thisMonthExp = allExp.filter((e) => e.date?.slice(0, 7) === monthKey);
          setExpenseThisMonth(thisMonthExp.reduce((s, e) => s + Number(e.amount), 0));
          setExpenseCount(thisMonthExp.length);
        } catch {
          // expenses collection may not exist yet — silently ignore
        }

        const settingsDoc = settingsSnap.docs.find((d) => d.id === "data");
        const usdToInr = settingsDoc?.data()?.usd_to_inr_rate ?? 83.50;

        setData({
          usdToInr,
          mfData: mfSnap.docs.map((d) => d.data() as { amount: number; transaction_type: string }),
          stockData: stockSnap.docs.map((d) => d.data() as { value: number; transaction_type: string }),
          usData: usSnap.docs.map((d) => d.data() as { amount: number; side: string }),
          cryptoData: cryptoSnap.docs.map((d) => d.data() as { total_inr: number; trade_type: string }),
          goldData: goldSnap.docs.map((d) => d.data() as { amount: number }),
          goldHoldingsData: goldHoldingsSnap.docs.map((d) => d.data() as { invested_amount: number }),
          recentMf: recentMfSnap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; scheme_name: string; amount: number; transaction_date: string; transaction_type: string })),
          recentStocks: recentStockSnap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; stock_name: string; symbol: string; value: number; execution_date: string; transaction_type: string })),
          recentUs: recentUsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; symbol: string; amount: number; transaction_date: string; side: string })),
          recentCrypto: recentCryptoSnap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; coin: string; market: string; total_inr: number; transaction_date: string; trade_type: string })),
          recentGold: recentGoldSnap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; grams: number; amount: number; purchase_date: string; gold_type: string })),
        });
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [user]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!data) return null;

  const { usdToInr, mfData, stockData, usData, cryptoData, goldData, goldHoldingsData } = data;

  const mfTotal = mfData.filter((t) => t.transaction_type !== "REDEMPTION").reduce((s, t) => s + Number(t.amount), 0);
  const mfRedemption = mfData.filter((t) => t.transaction_type === "REDEMPTION").reduce((s, t) => s + Number(t.amount), 0);
  const stockTotal = stockData.filter((t) => t.transaction_type === "BUY").reduce((s, t) => s + Number(t.value), 0);
  const stockSold = stockData.filter((t) => t.transaction_type === "SELL").reduce((s, t) => s + Number(t.value), 0);
  const usTotal = usData.filter((t) => t.side === "buy").reduce((s, t) => s + Math.abs(Number(t.amount ?? 0)), 0);
  const usSold = usData.filter((t) => t.side === "sell").reduce((s, t) => s + Math.abs(Number(t.amount ?? 0)), 0);
  const netUsUSD = usTotal - usSold;
  const netUsINR = netUsUSD * usdToInr;
  const cryptoTotal = cryptoData.filter((t) => t.trade_type === "BUY").reduce((s, t) => s + Number(t.total_inr ?? 0), 0);
  const goldTxTotal = goldData.reduce((s, t) => s + Number(t.amount), 0);
  const goldHoldingsTotal = goldHoldingsData.reduce((s, h) => s + Number(h.invested_amount), 0);
  const goldTotal = goldTxTotal + goldHoldingsTotal;
  const netMf = mfTotal - mfRedemption;
  const netStocks = stockTotal - stockSold;
  const totalINR = netMf + netStocks + netUsINR + cryptoTotal + goldTotal;

  type RecentItem = { id: string; label: string; sublabel: string; amount: string; date: string; type: string; side: "buy" | "sell"; category: string };
  const recentItems: RecentItem[] = [
    ...data.recentMf.map((t) => ({ id: t.id, label: t.scheme_name, sublabel: "Mutual Fund", amount: formatINR(t.amount), date: formatDate(t.transaction_date), type: t.transaction_type, side: (t.transaction_type === "REDEMPTION" ? "sell" : "buy") as "buy" | "sell", category: "mf" })),
    ...data.recentStocks.map((t) => ({ id: t.id, label: t.stock_name, sublabel: t.symbol, amount: formatINR(t.value), date: t.execution_date ? formatDate(t.execution_date) : "—", type: t.transaction_type, side: (t.transaction_type === "BUY" ? "buy" : "sell") as "buy" | "sell", category: "stocks" })),
    ...data.recentUs.map((t) => ({ id: t.id, label: t.symbol, sublabel: "US Stock", amount: `${formatUSD(Math.abs(t.amount ?? 0))} (≈${formatINR(Math.abs(t.amount ?? 0) * usdToInr)})`, date: formatDate(t.transaction_date), type: t.side.toUpperCase(), side: t.side as "buy" | "sell", category: "us" })),
    ...data.recentCrypto.map((t) => ({ id: t.id, label: t.coin, sublabel: t.market, amount: formatINR(t.total_inr ?? 0), date: formatDate(t.transaction_date), type: t.trade_type, side: (t.trade_type === "BUY" ? "buy" : "sell") as "buy" | "sell", category: "crypto" })),
    ...data.recentGold.map((t) => ({ id: t.id, label: `Gold (${t.gold_type})`, sublabel: `${t.grams}g`, amount: formatINR(t.amount), date: formatDate(t.purchase_date), type: "BUY", side: "buy" as const, category: "gold" })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white">Portfolio Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Welcome back, {user?.displayName || user?.email?.split("@")[0]}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Invested (INR)" value={formatINR(totalINR)} subtitle="MF + Stocks + US + Crypto + Gold" icon={Wallet} iconColor="text-sky-400" iconBg="bg-sky-500/10" className="sm:col-span-2 lg:col-span-1" />
        <StatCard title="Mutual Funds" value={formatINR(netMf)} subtitle={`${mfData.length} transactions`} icon={BarChart3} iconColor="text-violet-400" iconBg="bg-violet-500/10" />
        <StatCard title="Indian Stocks" value={formatINR(netStocks)} subtitle={`${stockData.length} orders`} icon={TrendingUp} iconColor="text-emerald-400" iconBg="bg-emerald-500/10" />
        <StatCard title="US Stocks" value={formatUSD(netUsUSD)} subtitle={`≈ ${formatINR(netUsINR)} • ${usData.length} trades`} icon={Globe} iconColor="text-blue-400" iconBg="bg-blue-500/10" />
        <StatCard title="Crypto" value={formatINR(cryptoTotal)} subtitle={`${cryptoData.length} trades`} icon={Bitcoin} iconColor="text-orange-400" iconBg="bg-orange-500/10" />
        <StatCard title="Gold" value={formatINR(goldTotal)} subtitle={`${goldData.length} purchase${goldData.length !== 1 ? "s" : ""}${goldHoldingsData.length > 0 ? ` + ${goldHoldingsData.length} holding${goldHoldingsData.length !== 1 ? "s" : ""}` : ""}`} icon={Gem} iconColor="text-yellow-400" iconBg="bg-yellow-500/10" />
        <StatCard title="Expenses (This Month)" value={formatINR(expenseThisMonth)} subtitle={`${expenseCount} expense${expenseCount !== 1 ? "s" : ""} recorded`} icon={Receipt} iconColor="text-rose-400" iconBg="bg-rose-500/10" />
      </div>

      <div className="glass-card p-4 md:p-6">
        <h2 className="text-base font-semibold text-white mb-4">Asset Allocation (INR)</h2>
        {totalINR === 0 ? (
          <p className="text-gray-500 text-sm">No data yet. Add transactions to see allocation.</p>
        ) : (
          <div className="space-y-3">
            {[
              { label: "Mutual Funds", value: netMf, color: "bg-violet-500" },
              { label: "Indian Stocks", value: netStocks, color: "bg-emerald-500" },
              { label: "Crypto", value: cryptoTotal, color: "bg-orange-500" },
              { label: "Gold", value: goldTotal, color: "bg-yellow-500" },
            ].map((item) => {
              const pct = totalINR > 0 ? (item.value / totalINR) * 100 : 0;
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-sm mb-1 gap-2 min-w-0">
                    <span className="text-gray-400 shrink-0">{item.label}</span>
                    <span className="text-gray-300 font-medium text-right truncate">{formatINR(item.value)} <span className="text-gray-500">({pct.toFixed(1)}%)</span></span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div className={`${item.color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-800/60 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Recent Activity</h2>
        </div>
        {recentItems.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-gray-500 text-sm">No transactions yet. Head to each section to add your investments.</p>
            <div className="flex gap-3 justify-center mt-4 flex-wrap">
              {[{ href: "/mutual-funds", label: "Mutual Funds" }, { href: "/stocks", label: "Indian Stocks" }, { href: "/us-stocks", label: "US Stocks" }, { href: "/crypto", label: "Crypto" }, { href: "/gold", label: "Gold" }].map((l) => (
                <Link key={l.href} href={l.href} className="btn-secondary text-xs py-1.5 px-3">{l.label}</Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Asset</th><th>Category</th><th>Type</th><th className="text-right">Amount</th><th>Date</th></tr></thead>
              <tbody>
                {recentItems.map((item) => (
                  <tr key={item.id}>
                    <td><div className="font-medium text-gray-200 truncate max-w-xs">{item.label}</div><div className="text-xs text-gray-500">{item.sublabel}</div></td>
                    <td className="capitalize text-gray-400">{item.category}</td>
                    <td><span className={item.side === "buy" ? "badge-buy" : "badge-sell"}>{item.type}</span></td>
                    <td className="text-right font-medium text-gray-200">{item.amount}</td>
                    <td className="text-gray-400 text-xs">{item.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
