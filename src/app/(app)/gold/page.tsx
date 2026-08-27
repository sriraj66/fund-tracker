"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { formatINR, formatDate, formatNumber } from "@/lib/utils";
import StatCard from "@/components/StatCard";
import { Gem, Scale, Plus, Trash2, Loader2 } from "lucide-react";
import GoldAddModal from "./GoldAddModal";
import GoldAddHoldingModal from "./GoldAddHoldingModal";
import GoldMonthlyStats from "./GoldMonthlyStats";
import DeleteButton from "@/components/DeleteButton";

interface GoldTx { id: string; purchase_date: string; price_per_gram: number; grams: number; amount: number; gold_type: string; notes?: string; }
interface GoldHolding { id: string; gold_purity: string; grams: number; invested_amount: number; created_at: string; }

// Reusable pagination bar
function PaginationBar({
  page, totalPages, total, pageSize, label, onPage,
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
    <div className="flex items-center justify-between px-4 py-3 md:px-6 border-t border-gray-800/60">
      <p className="text-xs text-gray-500">
        Showing <span className="text-gray-300 font-medium">{from}–{to}</span> of{" "}
        <span className="text-gray-300 font-medium">{total}</span> {label}
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(1)} disabled={page === 1} className="px-2 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">«</button>
        <button onClick={() => onPage(page - 1)} disabled={page === 1} className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹ Prev</button>
        {pageNums.map((item, idx) =>
          item === "..." ? (
            <span key={`e${idx}`} className="px-2 py-1 text-xs text-gray-600">…</span>
          ) : (
            <button key={item} onClick={() => onPage(item as number)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${page === item ? "bg-yellow-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>
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

export default function GoldPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<GoldTx[]>([]);
  const [holdings, setHoldings] = useState<GoldHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingHolding, setDeletingHolding] = useState<string | null>(null);

  // Pagination state
  const [txPage, setTxPage] = useState(1);
  const TX_PAGE_SIZE = 8;

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [txSnap, holdingsSnap] = await Promise.all([
        getDocs(query(collection(db, "users", user.uid, "gold_transactions"), orderBy("purchase_date", "desc"))),
        getDocs(query(collection(db, "users", user.uid, "gold_holdings"), orderBy("created_at", "desc"))),
      ]);
      setRows(txSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GoldTx)));
      setHoldings(holdingsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GoldHolding)));
      setTxPage(1);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleDeleteHolding = async (id: string) => {
    if (!user) return;
    if (!window.confirm("Delete this holding entry? This cannot be undone.")) return;
    setDeletingHolding(id);
    try {
      await deleteDoc(doc(db, "users", user.uid, "gold_holdings", id));
      setHoldings((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setDeletingHolding(null); }
  };

  const txAmount = rows.reduce((s, t) => s + Number(t.amount), 0);
  const txGrams  = rows.reduce((s, t) => s + Number(t.grams), 0);
  const holdingsAmount = holdings.reduce((s, h) => s + Number(h.invested_amount), 0);
  const holdingsGrams  = holdings.reduce((s, h) => s + Number(h.grams), 0);

  const totalAmount = txAmount + holdingsAmount;
  const totalGrams  = txGrams + holdingsGrams;
  const avgPrice = totalGrams > 0 ? totalAmount / totalGrams : 0;

  const typeMap = new Map<string, { grams: number; amount: number; count: number }>();
  for (const t of rows) {
    const ex = typeMap.get(t.gold_type) ?? { grams: 0, amount: 0, count: 0 };
    ex.grams += Number(t.grams); ex.amount += Number(t.amount); ex.count += 1;
    typeMap.set(t.gold_type, ex);
  }
  const byType = Array.from(typeMap.entries()).map(([type, d]) => ({ type, ...d }));

  // Holdings totals by purity
  const holdingsByPurity = useMemo(() => {
    const map = new Map<string, { grams: number; invested: number; count: number }>();
    for (const h of holdings) {
      const ex = map.get(h.gold_purity) ?? { grams: 0, invested: 0, count: 0 };
      ex.grams += Number(h.grams);
      ex.invested += Number(h.invested_amount);
      ex.count += 1;
      map.set(h.gold_purity, ex);
    }
    return Array.from(map.entries()).map(([purity, d]) => ({ purity, ...d }));
  }, [holdings]);

  // Paginated transactions
  const txTotalPages = Math.max(1, Math.ceil(rows.length / TX_PAGE_SIZE));
  const paginatedRows = useMemo(() => rows.slice((txPage - 1) * TX_PAGE_SIZE, txPage * TX_PAGE_SIZE), [rows, txPage]);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div><h1 className="text-xl md:text-2xl font-bold text-white">Gold</h1><p className="text-gray-400 text-sm mt-1">Track physical, digital &amp; sovereign gold</p></div>
        <div className="page-header-actions">
          <GoldAddHoldingModal onAdded={fetchData} />
          <GoldAddModal onAdded={fetchData} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard title="Total Invested" value={formatINR(totalAmount)} subtitle={`${rows.length} purchase${rows.length !== 1 ? "s" : ""}${holdings.length > 0 ? ` + ${holdings.length} holding${holdings.length !== 1 ? "s" : ""}` : ""}`} icon={Gem} iconColor="text-yellow-400" iconBg="bg-yellow-500/10" />
        <StatCard title="Total Weight" value={`${formatNumber(totalGrams, 4)} g`} subtitle={`${formatNumber(txGrams, 4)} g tx + ${formatNumber(holdingsGrams, 4)} g holdings`} icon={Scale} iconColor="text-amber-400" iconBg="bg-amber-500/10" />
        <StatCard title="Avg Buy Price" value={formatINR(avgPrice)} subtitle="Per gram (weighted avg)" icon={Gem} iconColor="text-orange-400" iconBg="bg-orange-500/10" />
      </div>

      {/* Gold Holdings (manual entries) */}
      {holdings.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-800/60 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Gold Holdings</h2>
              <p className="text-gray-500 text-xs mt-0.5">Manually tracked physical gold holdings</p>
            </div>
            {holdingsByPurity.length > 0 && (
              <div className="flex items-center gap-4 text-sm">
                {holdingsByPurity.map((h) => (
                  <div key={h.purity} className="text-right">
                    <div className="text-xs text-gray-500">{h.purity}</div>
                    <div className="text-amber-400 font-semibold">{formatNumber(h.grams, 4)} g</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Purity</th>
                  <th className="text-right">Grams</th>
                  <th className="text-right">Invested Amount</th>
                  <th className="text-right">Avg Price / g</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-300 border border-yellow-500/20">
                        {h.gold_purity}
                      </span>
                    </td>
                    <td className="text-right text-gray-300">{formatNumber(Number(h.grams), 4)} g</td>
                    <td className="text-right font-semibold text-yellow-400">{formatINR(Number(h.invested_amount))}</td>
                    <td className="text-right text-gray-300">{h.grams > 0 ? formatINR(Number(h.invested_amount) / Number(h.grams)) : "—"}</td>
                    <td className="text-center">
                      <button
                        onClick={() => handleDeleteHolding(h.id)}
                        disabled={deletingHolding === h.id}
                        className="inline-flex items-center justify-center w-7 h-7 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        title="Delete holding"
                      >
                        {deletingHolding === h.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Holdings by transaction type */}
      {byType.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-800/60"><h2 className="text-base font-semibold text-white">Purchases by Type</h2></div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Gold Type</th><th className="text-right">Total Grams</th><th className="text-right">Total Invested</th><th className="text-right">Avg Price/gram</th><th className="text-right">Purchases</th></tr></thead>
              <tbody>{byType.map((b) => (
                <tr key={b.type}>
                  <td><span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400" /><span className="font-medium text-gray-200">{b.type}</span></span></td>
                  <td className="text-right text-gray-300">{formatNumber(b.grams, 4)} g</td>
                  <td className="text-right font-medium text-gray-200">{formatINR(b.amount)}</td>
                  <td className="text-right text-gray-300">{b.grams > 0 ? formatINR(b.amount / b.grams) : "—"}</td>
                  <td className="text-right text-gray-400">{b.count}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly stats: bar chart + month-wise accordion */}
      {rows.length > 0 && <GoldMonthlyStats transactions={rows} onDeleted={fetchData} />}

      {/* Purchase History — paginated */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-800/60"><h2 className="text-base font-semibold text-white">Purchase History</h2></div>
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-3"><Plus className="w-6 h-6 text-yellow-400" /></div>
            <p className="text-gray-400 text-sm font-medium">No gold purchases yet</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Date</th><th>Type</th><th className="text-right">Grams</th><th className="text-right">Price / gram</th><th className="text-right">Total Amount</th><th>Notes</th><th className="text-center">Action</th></tr></thead>
                <tbody>
                  {paginatedRows.map((t) => (
                    <tr key={t.id}>
                      <td className="text-gray-300 font-medium">{formatDate(t.purchase_date)}</td>
                      <td><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">{t.gold_type}</span></td>
                      <td className="text-right text-gray-300">{formatNumber(Number(t.grams), 4)} g</td>
                      <td className="text-right text-gray-300">{formatINR(Number(t.price_per_gram))}</td>
                      <td className="text-right font-semibold text-yellow-400">{formatINR(Number(t.amount))}</td>
                      <td className="text-gray-500 text-xs max-w-[160px] truncate">{t.notes ?? "—"}</td>
                      <td className="text-center"><DeleteButton id={t.id} endpoint="/api/delete/gold" itemName={t.gold_type} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar page={txPage} totalPages={txTotalPages} total={rows.length} pageSize={TX_PAGE_SIZE} label="purchases" onPage={setTxPage} />
          </>
        )}
      </div>
    </div>
  );
}
