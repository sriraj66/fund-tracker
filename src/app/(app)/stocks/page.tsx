"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { formatINR, formatDate, formatNumber } from "@/lib/utils";
import StatCard from "@/components/StatCard";
import { TrendingUp, TrendingDown, Plus } from "lucide-react";
import StockAddModal from "./StockAddModal";
import StockMonthlyStats from "./StockMonthlyStats";
import ImportButton from "@/components/ImportButton";
import DeleteButton from "@/components/DeleteButton";

interface StockTx {
  id: string; stock_name: string; symbol: string; transaction_type: string;
  quantity: number; value: number; exchange?: string; execution_date?: string; isin?: string;
}

function PaginationBar({ page, totalPages, total, pageSize, label, onPage, activeColor = "bg-emerald-600" }: {
  page: number; totalPages: number; total: number; pageSize: number; label: string;
  onPage: (p: number) => void; activeColor?: string;
}) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pageNums = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || (p >= page - 2 && p <= page + 2))
    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
      acc.push(p);
      return acc;
    }, []);
  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-gray-800/60">
      <p className="text-xs text-gray-500">Showing <span className="text-gray-300 font-medium">{from}–{to}</span> of <span className="text-gray-300 font-medium">{total}</span> {label}</p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(1)} disabled={page === 1} className="px-2 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">«</button>
        <button onClick={() => onPage(page - 1)} disabled={page === 1} className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹ Prev</button>
        {pageNums.map((item, idx) => item === "..." ? (
          <span key={`e${idx}`} className="px-2 py-1 text-xs text-gray-600">…</span>
        ) : (
          <button key={item} onClick={() => onPage(item as number)} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${page === item ? `${activeColor} text-white` : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>{item}</button>
        ))}
        <button onClick={() => onPage(page + 1)} disabled={page === totalPages} className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next ›</button>
        <button onClick={() => onPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">»</button>
      </div>
    </div>
  );
}

export default function StocksPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<StockTx[]>([]);
  const [loading, setLoading] = useState(true);

  const [holdingsPage, setHoldingsPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const HOLDINGS_PAGE_SIZE = 8;
  const ORDER_PAGE_SIZE = 20;

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "users", user.uid, "stock_transactions"), orderBy("execution_date", "desc")));
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StockTx)));
      setHoldingsPage(1);
      setOrderPage(1);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [user]);

  const totalBought = rows.filter((t) => t.transaction_type === "BUY").reduce((s, t) => s + Number(t.value), 0);
  const totalSold = rows.filter((t) => t.transaction_type === "SELL").reduce((s, t) => s + Number(t.value), 0);
  const netInvested = totalBought - totalSold;

  // Build holdings map
  const holdingsMap = new Map<string, { name: string; symbol: string; qty: number; invested: number; avgPrice: number }>();
  for (const t of rows) {
    const ex = holdingsMap.get(t.symbol) ?? { name: t.stock_name, symbol: t.symbol, qty: 0, invested: 0, avgPrice: 0 };
    if (t.transaction_type === "BUY") { ex.qty += Number(t.quantity); ex.invested += Number(t.value); }
    else { ex.qty -= Number(t.quantity); ex.invested -= Number(t.value); }
    ex.avgPrice = ex.qty > 0 ? ex.invested / ex.qty : 0;
    holdingsMap.set(t.symbol, ex);
  }
  const holdings = Array.from(holdingsMap.values()).filter((h) => h.qty > 0);

  // Pagination
  const holdingsTotalPages = Math.max(1, Math.ceil(holdings.length / HOLDINGS_PAGE_SIZE));
  const paginatedHoldings = useMemo(() => holdings.slice((holdingsPage - 1) * HOLDINGS_PAGE_SIZE, holdingsPage * HOLDINGS_PAGE_SIZE), [holdings, holdingsPage]);

  const orderTotalPages = Math.max(1, Math.ceil(rows.length / ORDER_PAGE_SIZE));
  const paginatedOrders = useMemo(() => rows.slice((orderPage - 1) * ORDER_PAGE_SIZE, orderPage * ORDER_PAGE_SIZE), [rows, orderPage]);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">Indian Stocks</h1><p className="text-gray-400 text-sm mt-1">NSE / BSE equity orders</p></div>
        <div className="flex items-center gap-2">
          <ImportButton endpoint="/api/import/stocks" accept=".xlsx,.xls" label="Import Transactions" hint="INDMoney / Grow Stocks Order History XLSX" />
          <ImportButton endpoint="/api/import/holdings/stocks" accept=".xlsx,.xls" label="Import Holdings" hint="INDMoney Stocks Holdings Statement XLSX" />
          <StockAddModal onAdded={fetchData} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Net Invested" value={formatINR(netInvested)} subtitle="Bought minus sold" icon={TrendingUp} iconColor="text-emerald-400" iconBg="bg-emerald-500/10" />
        <StatCard title="Total Bought" value={formatINR(totalBought)} subtitle={`${rows.filter((t) => t.transaction_type === "BUY").length} buy orders`} icon={TrendingUp} iconColor="text-blue-400" iconBg="bg-blue-500/10" />
        <StatCard title="Total Sold" value={formatINR(totalSold)} subtitle={`${rows.filter((t) => t.transaction_type === "SELL").length} sell orders`} icon={TrendingDown} iconColor="text-red-400" iconBg="bg-red-500/10" />
      </div>

      {/* Monthly stats: bar chart + month-wise accordion (5 per page) */}
      {rows.length > 0 && <StockMonthlyStats transactions={rows} onDeleted={fetchData} />}

      {/* Current Holdings — paginated at 8 per page */}
      {holdings.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800/60"><h2 className="text-base font-semibold text-white">Current Holdings</h2></div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Stock</th><th>Symbol</th><th className="text-right">Qty</th><th className="text-right">Avg Price</th><th className="text-right">Invested</th></tr></thead>
              <tbody>
                {paginatedHoldings.map((h) => (
                  <tr key={h.symbol}>
                    <td className="font-medium text-gray-200">{h.name}</td>
                    <td><span className="font-mono text-xs bg-gray-800 text-sky-400 px-2 py-0.5 rounded">{h.symbol}</span></td>
                    <td className="text-right text-gray-300">{formatNumber(h.qty, 2)}</td>
                    <td className="text-right text-gray-300">{formatINR(h.avgPrice)}</td>
                    <td className="text-right font-medium text-gray-200">{formatINR(h.invested)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar page={holdingsPage} totalPages={holdingsTotalPages} total={holdings.length} pageSize={HOLDINGS_PAGE_SIZE} label="holdings" onPage={setHoldingsPage} />
        </div>
      )}

      {/* Order History — paginated at 20 per page */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800/60"><h2 className="text-base font-semibold text-white">Order History</h2></div>
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3"><Plus className="w-6 h-6 text-emerald-400" /></div>
            <p className="text-gray-400 text-sm font-medium">No stock orders yet</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Stock</th><th>Symbol</th><th>Type</th><th className="text-right">Qty</th><th className="text-right">Value</th><th>Exchange</th><th>Date</th><th className="text-center">Action</th></tr></thead>
                <tbody>
                  {paginatedOrders.map((t) => (
                    <tr key={t.id}>
                      <td className="font-medium text-gray-200 max-w-[200px] truncate">{t.stock_name}</td>
                      <td><span className="font-mono text-xs bg-gray-800 text-sky-400 px-2 py-0.5 rounded">{t.symbol}</span></td>
                      <td><span className={t.transaction_type === "BUY" ? "badge-buy" : "badge-sell"}>{t.transaction_type}</span></td>
                      <td className="text-right text-gray-300">{formatNumber(Number(t.quantity), 2)}</td>
                      <td className="text-right font-medium text-gray-200">{formatINR(Number(t.value))}</td>
                      <td className="text-gray-400 text-xs">{t.exchange ?? "—"}</td>
                      <td className="text-gray-400 text-xs">{t.execution_date ? formatDate(t.execution_date) : "—"}</td>
                      <td className="text-center"><DeleteButton id={t.id} endpoint="/api/delete/stocks" itemName={t.symbol} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar page={orderPage} totalPages={orderTotalPages} total={rows.length} pageSize={ORDER_PAGE_SIZE} label="orders" onPage={setOrderPage} />
          </>
        )}
      </div>
    </div>
  );
}
