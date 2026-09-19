"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { formatINR, formatDate, formatNumber } from "@/lib/utils";
import StatCard from "@/components/StatCard";
import { BarChart3, Plus, TrendingUp } from "lucide-react";
import MfAddModal from "./MfAddModal";
import MfMonthlyStats from "./MfMonthlyStats";
import ImportButton from "@/components/ImportButton";
import DeleteButton from "@/components/DeleteButton";

interface MfTx { id: string; scheme_name: string; transaction_type: string; units: number; nav: number; amount: number; transaction_date: string; }

// Reusable pagination bar component
function PaginationBar({
  page, totalPages, total, pageSize, label,
  onPage,
}: {
  page: number; totalPages: number; total: number; pageSize: number; label: string;
  onPage: (p: number) => void;
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
    <div className="px-4 py-3 md:px-6 border-t border-gray-800/60 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
      <div className="flex items-center gap-1 flex-wrap justify-center order-1 sm:order-2">
        <button onClick={() => onPage(1)} disabled={page === 1} className="px-2 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">«</button>
        <button onClick={() => onPage(page - 1)} disabled={page === 1} className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹ Prev</button>
        {pageNums.map((item, idx) =>
          item === "..." ? (
            <span key={`e${idx}`} className="hidden sm:inline px-2 py-1 text-xs text-gray-600">…</span>
          ) : (
            <button
              key={item}
              onClick={() => onPage(item as number)}
              className={`hidden sm:inline-flex px-3 py-1.5 rounded text-xs font-medium transition-colors ${page === item ? "bg-violet-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
            >
              {item}
            </button>
          )
        )}
        <span className="sm:hidden text-xs text-gray-500 px-2">{page} / {totalPages}</span>
        <button onClick={() => onPage(page + 1)} disabled={page === totalPages} className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next ›</button>
        <button onClick={() => onPage(totalPages)} disabled={page === totalPages} className="px-2 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">»</button>
      </div>
      <p className="text-xs text-gray-500 order-2 sm:order-1 text-center sm:text-left">
        Showing <span className="text-gray-300 font-medium">{from}–{to}</span> of{" "}
        <span className="text-gray-300 font-medium">{total}</span> {label}
      </p>
    </div>
  );
}

export default function MutualFundsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<MfTx[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [txPage, setTxPage] = useState(1);
  const [schemePage, setSchemePage] = useState(1);
  const TX_PAGE_SIZE = 8;
  const SCHEME_PAGE_SIZE = 8;

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "users", user.uid, "mf_transactions"), orderBy("transaction_date", "desc")));
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MfTx)));
      setTxPage(1);
      setSchemePage(1);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [user]);

  const isRedemption = (type: string) => type === "REDEMPTION" || type === "REDEEM";
  const totalPurchased = rows.filter((t) => !isRedemption(t.transaction_type)).reduce((s, t) => s + Number(t.amount), 0);
  const totalRedeemed = rows.filter((t) => isRedemption(t.transaction_type)).reduce((s, t) => s + Number(t.amount), 0);
  const netInvested = totalPurchased - totalRedeemed;

  // Scheme map
  const schemeMap = new Map<string, { units: number; invested: number; count: number }>();
  for (const t of rows) {
    const ex = schemeMap.get(t.scheme_name) ?? { units: 0, invested: 0, count: 0 };
    if (isRedemption(t.transaction_type)) { ex.units -= Number(t.units ?? 0); ex.invested -= Number(t.amount); }
    else { ex.units += Number(t.units ?? 0); ex.invested += Number(t.amount); }
    ex.count += 1;
    schemeMap.set(t.scheme_name, ex);
  }
  const schemes = Array.from(schemeMap.entries()).map(([name, d]) => ({ name, ...d }));

  // Paginated slices
  const txTotalPages = Math.max(1, Math.ceil(rows.length / TX_PAGE_SIZE));
  const paginatedRows = useMemo(() => rows.slice((txPage - 1) * TX_PAGE_SIZE, txPage * TX_PAGE_SIZE), [rows, txPage]);

  const schemeTotalPages = Math.max(1, Math.ceil(schemes.length / SCHEME_PAGE_SIZE));
  const paginatedSchemes = useMemo(() => schemes.slice((schemePage - 1) * SCHEME_PAGE_SIZE, schemePage * SCHEME_PAGE_SIZE), [schemes, schemePage]);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div><h1 className="text-xl md:text-2xl font-bold text-white">Mutual Funds</h1><p className="text-gray-400 text-sm mt-1">Track your MF investments</p></div>
        <div className="page-header-actions">
          <ImportButton endpoint="/api/import/mf" accept=".xlsx,.xls" label="Import Transactions" hint="INDMoney Mutual Funds Order History XLSX" onSuccess={fetchData} />
          <ImportButton endpoint="/api/import/holdings/mf" accept=".xlsx,.xls" label="Import Holdings" hint="INDMoney Mutual Funds Holdings Statement XLSX" onSuccess={fetchData} />
          <MfAddModal onAdded={fetchData} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard title="Net Invested" value={formatINR(netInvested)} subtitle="Purchased minus redeemed" icon={BarChart3} iconColor="text-violet-400" iconBg="bg-violet-500/10" />
        <StatCard title="Total Purchased" value={formatINR(totalPurchased)} subtitle={`${rows.filter((t) => !isRedemption(t.transaction_type)).length} transactions`} icon={TrendingUp} iconColor="text-emerald-400" iconBg="bg-emerald-500/10" />
        <StatCard title="Total Redeemed" value={formatINR(totalRedeemed)} subtitle={`${rows.filter((t) => isRedemption(t.transaction_type)).length} redemptions`} icon={BarChart3} iconColor="text-red-400" iconBg="bg-red-500/10" />
      </div>

      {/* Monthly stats: bar chart + month-wise accordion */}
      {rows.length > 0 && <MfMonthlyStats transactions={rows} onDeleted={fetchData} />}

      {/* Scheme Holdings — paginated at 8 per page */}
      {schemes.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-800/60"><h2 className="text-base font-semibold text-white">Scheme Holdings</h2></div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Scheme Name</th><th className="text-right">Units</th><th className="text-right">Invested</th><th className="text-right">Transactions</th></tr></thead>
              <tbody>
                {paginatedSchemes.map((s) => (
                  <tr key={s.name}>
                    <td className="font-medium text-gray-200 max-w-xs truncate">{s.name}</td>
                    <td className="text-right text-gray-300">{formatNumber(s.units, 4)}</td>
                    <td className="text-right text-gray-300 font-medium">{formatINR(s.invested)}</td>
                    <td className="text-right text-gray-400">{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar page={schemePage} totalPages={schemeTotalPages} total={schemes.length} pageSize={SCHEME_PAGE_SIZE} label="schemes" onPage={setSchemePage} />
        </div>
      )}

      {/* Transaction History — paginated at 20 per page */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-800/60"><h2 className="text-base font-semibold text-white">Transaction History</h2></div>
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center mx-auto mb-3"><Plus className="w-6 h-6 text-violet-400" /></div>
            <p className="text-gray-400 text-sm font-medium">No MF transactions yet</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Scheme Name</th><th>Type</th><th className="text-right">Units</th><th className="text-right">NAV</th><th className="text-right">Amount</th><th>Date</th><th className="text-center">Action</th></tr></thead>
                <tbody>
                  {paginatedRows.map((t) => (
                    <tr key={t.id}>
                      <td className="max-w-xs truncate font-medium text-gray-200">{t.scheme_name}</td>
                      <td><span className={isRedemption(t.transaction_type) ? "badge-sell" : "badge-purchase"}>{t.transaction_type}</span></td>
                      <td className="text-right text-gray-300">{t.units ? formatNumber(Number(t.units), 4) : "—"}</td>
                      <td className="text-right text-gray-300">{t.nav ? formatINR(Number(t.nav)) : "—"}</td>
                      <td className="text-right font-medium text-gray-200">{formatINR(Number(t.amount))}</td>
                      <td className="text-gray-400 text-xs">{formatDate(t.transaction_date)}</td>
                      <td className="text-center"><DeleteButton id={t.id} endpoint="/api/delete/mf" itemName={t.scheme_name} onDeleted={fetchData} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar page={txPage} totalPages={txTotalPages} total={rows.length} pageSize={TX_PAGE_SIZE} label="transactions" onPage={setTxPage} />
          </>
        )}
      </div>
    </div>
  );
}
