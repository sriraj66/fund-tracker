"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { formatUSD, formatINR, formatDate, formatNumber } from "@/lib/utils";
import StatCard from "@/components/StatCard";
import { Globe, TrendingUp, TrendingDown, Plus } from "lucide-react";
import UsStockAddModal from "./UsStockAddModal";
import UsStockMonthlyStats from "./UsStockMonthlyStats";
import ImportButton from "@/components/ImportButton";
import DeleteButton from "@/components/DeleteButton";
import ExchangeRateSettings from "@/components/ExchangeRateSettings";

interface UsTx { id: string; symbol: string; description?: string; side: string; quantity: number; price?: number; amount?: number; transaction_date: string; }

const TX_PAGE_SIZE = 8;

function PaginationBar({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * TX_PAGE_SIZE + 1;
  const to = Math.min(page * TX_PAGE_SIZE, total);
  const pageNums = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || (p >= page - 2 && p <= page + 2))
    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
      acc.push(p);
      return acc;
    }, []);
  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-gray-800/60">
      <p className="text-xs text-gray-500">
        Showing <span className="text-gray-300 font-medium">{from}–{to}</span> of{" "}
        <span className="text-gray-300 font-medium">{total}</span> trades
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(1)} disabled={page === 1} className="px-2 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">«</button>
        <button onClick={() => onPage(page - 1)} disabled={page === 1} className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹ Prev</button>
        {pageNums.map((item, idx) =>
          item === "..." ? (
            <span key={`e${idx}`} className="px-2 py-1 text-xs text-gray-600">…</span>
          ) : (
            <button key={item} onClick={() => onPage(item as number)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${page === item ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>
              {item}
            </button>
          )
        )}
        <button onClick={() => onPage(page + 1)} disabled={page === totalPages} className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next ›</button>
        <button onClick={() => onPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">»</button>
      </div>
    </div>
  );
}

export default function UsStocksPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<UsTx[]>([]);
  const [usdToInr, setUsdToInr] = useState(83.50);
  const [loading, setLoading] = useState(true);
  const [txPage, setTxPage] = useState(1);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [snap, settingsSnap] = await Promise.all([
        getDocs(query(collection(db, "users", user.uid, "us_stock_transactions"), orderBy("transaction_date", "desc"))),
        getDocs(collection(db, "users", user.uid, "settings")),
      ]);
      const settingsDoc = settingsSnap.docs.find((d) => d.id === "data");
      setUsdToInr(settingsDoc?.data()?.usd_to_inr_rate ?? 83.50);
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() } as UsTx)));
      setTxPage(1);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [user]);

  const totalBought = rows.filter((t) => t.side === "buy").reduce((s, t) => s + Math.abs(Number(t.amount ?? 0)), 0);
  const totalSold = rows.filter((t) => t.side === "sell").reduce((s, t) => s + Math.abs(Number(t.amount ?? 0)), 0);
  const netInvested = totalBought - totalSold;

  const txTotalPages = Math.max(1, Math.ceil(rows.length / TX_PAGE_SIZE));
  const paginatedRows = useMemo(() => rows.slice((txPage - 1) * TX_PAGE_SIZE, txPage * TX_PAGE_SIZE), [rows, txPage]);

  const holdingsMap = new Map<string, { symbol: string; qty: number; invested: number }>();
  for (const t of rows) {
    const ex = holdingsMap.get(t.symbol) ?? { symbol: t.symbol, qty: 0, invested: 0 };
    if (t.side === "buy") { ex.qty += Number(t.quantity); ex.invested += Math.abs(Number(t.amount ?? 0)); }
    else { ex.qty -= Math.abs(Number(t.quantity)); ex.invested -= Math.abs(Number(t.amount ?? 0)); }
    holdingsMap.set(t.symbol, ex);
  }
  const holdings = Array.from(holdingsMap.values()).filter((h) => h.qty > 0.00001);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">US Stocks</h1>
          <p className="text-gray-400 text-sm mt-1 flex items-center gap-2">
            INDMoney / Alpaca global portfolio (USD)
            <span className="text-gray-600">•</span>
            <ExchangeRateSettings currentRate={usdToInr} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportButton endpoint="/api/import/us-stocks" accept=".pdf" label="Import Transactions" hint="INDMoney Monthly Statement PDF (Alpaca)" />
          <ImportButton endpoint="/api/import/holdings/us-stocks" accept=".xls,.xlsx" label="Import Holdings" hint="INDMoney US Stocks Holdings Report XLS" />
          <UsStockAddModal onAdded={fetchData} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Net Invested" value={formatUSD(netInvested)} subtitle={`≈ ${formatINR(netInvested * usdToInr)} at ₹${usdToInr}/USD`} icon={Globe} iconColor="text-blue-400" iconBg="bg-blue-500/10" />
        <StatCard title="Total Bought" value={formatUSD(totalBought)} subtitle={`≈ ${formatINR(totalBought * usdToInr)} • ${rows.filter((t) => t.side === "buy").length} orders`} icon={TrendingUp} iconColor="text-emerald-400" iconBg="bg-emerald-500/10" />
        <StatCard title="Total Sold" value={formatUSD(totalSold)} subtitle={`≈ ${formatINR(totalSold * usdToInr)} • ${rows.filter((t) => t.side === "sell").length} orders`} icon={TrendingDown} iconColor="text-red-400" iconBg="bg-red-500/10" />
      </div>

      {rows.length > 0 && <UsStockMonthlyStats transactions={rows} usdToInr={usdToInr} onDeleted={fetchData} />}

      {holdings.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800/60"><h2 className="text-base font-semibold text-white">Current Holdings</h2></div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Symbol</th><th className="text-right">Shares</th><th className="text-right">Avg Cost</th><th className="text-right">Invested (USD)</th></tr></thead>
              <tbody>{holdings.map((h) => (<tr key={h.symbol}><td><span className="font-mono font-semibold text-sky-400">{h.symbol}</span></td><td className="text-right text-gray-300">{formatNumber(h.qty, 8)}</td><td className="text-right text-gray-300">{h.qty > 0 ? formatUSD(h.invested / h.qty) : "—"}</td><td className="text-right font-medium text-gray-200">{formatUSD(h.invested)}</td></tr>))}</tbody>
            </table>
          </div>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800/60"><h2 className="text-base font-semibold text-white">Trade History</h2></div>
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center"><div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-3"><Plus className="w-6 h-6 text-blue-400" /></div><p className="text-gray-400 text-sm font-medium">No US stock trades yet</p></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Symbol</th><th>Description</th><th>Side</th><th className="text-right">Shares</th><th className="text-right">Price</th><th className="text-right">Amount (USD)</th><th className="text-right">Amount (INR)</th><th>Date</th><th className="text-center">Action</th></tr></thead>
                <tbody>
                  {paginatedRows.map((t) => (
                    <tr key={t.id}>
                      <td><span className="font-mono font-semibold text-sky-400">{t.symbol}</span></td>
                      <td className="text-gray-400 text-xs max-w-[160px] truncate">{t.description ?? "—"}</td>
                      <td><span className={t.side === "buy" ? "badge-buy" : "badge-sell"}>{t.side.toUpperCase()}</span></td>
                      <td className="text-right text-gray-300">{formatNumber(Number(t.quantity), 8)}</td>
                      <td className="text-right text-gray-300">{t.price ? formatUSD(Number(t.price)) : "—"}</td>
                      <td className="text-right font-medium text-gray-200">{t.amount ? formatUSD(Math.abs(Number(t.amount))) : "—"}</td>
                      <td className="text-right text-gray-400 text-sm">{t.amount ? formatINR(Math.abs(Number(t.amount)) * usdToInr) : "—"}</td>
                      <td className="text-gray-400 text-xs">{formatDate(t.transaction_date)}</td>
                      <td className="text-center"><DeleteButton id={t.id} endpoint="/api/delete/us-stocks" itemName={t.symbol} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar page={txPage} totalPages={txTotalPages} total={rows.length} onPage={setTxPage} />
          </>
        )}
      </div>
    </div>
  );
}
