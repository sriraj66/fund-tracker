"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { formatINR, formatDate, formatNumber } from "@/lib/utils";
import StatCard from "@/components/StatCard";
import { Bitcoin, TrendingUp, TrendingDown, Plus } from "lucide-react";
import CryptoAddModal from "./CryptoAddModal";
import CryptoMonthlyStats from "./CryptoMonthlyStats";
import ImportButton from "@/components/ImportButton";
import DeleteButton from "@/components/DeleteButton";

interface CryptoTx { id: string; market: string; coin: string; trade_type: string; price?: number; volume?: number; total_inr?: number; tds_amount?: number; fee_amount?: number; transaction_date: string; }

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
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${page === item ? "bg-orange-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>
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

export default function CryptoPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CryptoTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [txPage, setTxPage] = useState(1);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "users", user.uid, "crypto_transactions"), orderBy("transaction_date", "desc")));
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CryptoTx)));
      setTxPage(1);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [user]);

  const totalBought = rows.filter((t) => t.trade_type === "BUY").reduce((s, t) => s + Number(t.total_inr ?? 0), 0);
  const totalSold = rows.filter((t) => t.trade_type === "SELL").reduce((s, t) => s + Number(t.total_inr ?? 0), 0);
  const netInvested = totalBought - totalSold;
  const totalTds = rows.reduce((s, t) => s + Number(t.tds_amount ?? 0), 0);
  const totalFees = rows.reduce((s, t) => s + Number(t.fee_amount ?? 0), 0);

  const txTotalPages = Math.max(1, Math.ceil(rows.length / TX_PAGE_SIZE));
  const paginatedRows = useMemo(() => rows.slice((txPage - 1) * TX_PAGE_SIZE, txPage * TX_PAGE_SIZE), [rows, txPage]);

  const coinMap = new Map<string, { qty: number; invested: number; count: number }>();
  for (const t of rows) {
    const ex = coinMap.get(t.coin) ?? { qty: 0, invested: 0, count: 0 };
    if (t.trade_type === "BUY") { ex.qty += Number(t.volume ?? 0); ex.invested += Number(t.total_inr ?? 0); }
    else { ex.qty -= Number(t.volume ?? 0); ex.invested -= Number(t.total_inr ?? 0); }
    ex.count += 1;
    coinMap.set(t.coin, ex);
  }
  const holdings = Array.from(coinMap.entries()).map(([coin, d]) => ({ coin, ...d })).filter((h) => h.qty > 0.000001);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">Crypto</h1><p className="text-gray-400 text-sm mt-1">CoinSwitch spot trades (INR)</p></div>
        <div className="flex items-center gap-2">
          <ImportButton endpoint="/api/import/crypto" accept=".xlsx,.xls" label="Import Transactions" hint="CoinSwitch Transaction Statement XLSX" />
          <ImportButton endpoint="/api/import/holdings/crypto" accept=".xlsx,.xls" label="Import Holdings" hint="CoinSwitch Trade Report (Balances VDA)" />
          <CryptoAddModal onAdded={fetchData} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Net Invested" value={formatINR(netInvested)} subtitle="Bought minus sold" icon={Bitcoin} iconColor="text-orange-400" iconBg="bg-orange-500/10" />
        <StatCard title="Total Bought" value={formatINR(totalBought)} subtitle={`${rows.filter((t) => t.trade_type === "BUY").length} buys`} icon={TrendingUp} iconColor="text-emerald-400" iconBg="bg-emerald-500/10" />
        <StatCard title="Total Sold" value={formatINR(totalSold)} subtitle={`${rows.filter((t) => t.trade_type === "SELL").length} sells`} icon={TrendingDown} iconColor="text-red-400" iconBg="bg-red-500/10" />
        <StatCard title="TDS Paid" value={formatINR(totalTds)} subtitle={`Fees: ${formatINR(totalFees)}`} icon={Bitcoin} iconColor="text-yellow-400" iconBg="bg-yellow-500/10" />
      </div>

      {rows.length > 0 && <CryptoMonthlyStats transactions={rows} onDeleted={fetchData} />}

      {holdings.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800/60"><h2 className="text-base font-semibold text-white">Coin Holdings</h2></div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Coin</th><th className="text-right">Balance</th><th className="text-right">Net Invested (INR)</th><th className="text-right">Avg Buy Price</th></tr></thead>
              <tbody>{holdings.map((h) => (<tr key={h.coin}><td><span className="font-mono font-semibold text-orange-400">{h.coin}</span></td><td className="text-right text-gray-300">{formatNumber(h.qty, 8)}</td><td className="text-right font-medium text-gray-200">{formatINR(h.invested)}</td><td className="text-right text-gray-300">{h.qty > 0 ? formatINR(h.invested / h.qty) : "—"}</td></tr>))}</tbody>
            </table>
          </div>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800/60"><h2 className="text-base font-semibold text-white">Trade History</h2></div>
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center"><div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-3"><Plus className="w-6 h-6 text-orange-400" /></div><p className="text-gray-400 text-sm font-medium">No crypto trades yet</p></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Coin / Market</th><th>Type</th><th className="text-right">Volume</th><th className="text-right">Price (INR)</th><th className="text-right">Total (INR)</th><th className="text-right">TDS</th><th>Date</th><th className="text-center">Action</th></tr></thead>
                <tbody>
                  {paginatedRows.map((t) => (
                    <tr key={t.id}>
                      <td><div className="font-mono font-semibold text-orange-400">{t.coin}</div><div className="text-xs text-gray-500">{t.market}</div></td>
                      <td><span className={t.trade_type === "BUY" ? "badge-buy" : "badge-sell"}>{t.trade_type}</span></td>
                      <td className="text-right text-gray-300">{formatNumber(Number(t.volume ?? 0), 8)}</td>
                      <td className="text-right text-gray-300">{t.price ? formatINR(Number(t.price)) : "—"}</td>
                      <td className="text-right font-medium text-gray-200">{t.total_inr ? formatINR(Number(t.total_inr)) : "—"}</td>
                      <td className="text-right text-yellow-400 text-xs">{t.tds_amount ? formatINR(Number(t.tds_amount)) : "₹0"}</td>
                      <td className="text-gray-400 text-xs">{formatDate(t.transaction_date)}</td>
                      <td className="text-center"><DeleteButton id={t.id} endpoint="/api/delete/crypto" itemName={t.coin} /></td>
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
