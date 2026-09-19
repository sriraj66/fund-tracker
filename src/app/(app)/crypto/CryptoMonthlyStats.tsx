"use client";

import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChevronDown, ChevronRight, Trash2, Loader2 } from "lucide-react";
import { formatINR, formatDate, formatNumber } from "@/lib/utils";
import DeleteButton from "@/components/DeleteButton";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";

const BAR_CONFIG = [
  { key: "Bought", color: "#10b981" },
  { key: "Sold",   color: "#ef4444" },
  { key: "Net",    color: "#38bdf8" },
];

const TIME_FRAMES = [
  { label: "3M",  months: 3 },
  { label: "6M",  months: 6 },
  { label: "1Y",  months: 12 },
  { label: "2Y",  months: 24 },
  { label: "All", months: 0 },
];

const ACCORDION_PAGE_SIZE = 6;
const TX_PER_PAGE = 5;

interface CryptoTx {
  id: string;
  market: string;
  coin: string;
  trade_type: string;
  price?: number;
  volume?: number;
  total_inr?: number;
  tds_amount?: number;
  fee_amount?: number;
  transaction_date: string;
}

interface Props {
  transactions: CryptoTx[];
  onDeleted?: () => void;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; fill: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 shadow-xl text-sm">
      <p className="text-white font-semibold mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-6">
          <span style={{ color: p.fill }} className="font-medium">{p.name}</span>
          <span className="text-gray-200">{formatINR(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function CryptoMonthlyStats({ transactions, onDeleted }: Props) {
  const { user } = useAuth();
  const [hiddenBars, setHiddenBars] = useState<Record<string, boolean>>({});
  const [timeFrame, setTimeFrame] = useState("6M");
  const [accordionPage, setAccordionPage] = useState(1);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [monthTxPage, setMonthTxPage] = useState<Record<string, number>>({});
  const [deletingMonth, setDeletingMonth] = useState<string | null>(null);

  const toggleBar = (key: string) => setHiddenBars(prev => ({ ...prev, [key]: !prev[key] }));
  const getTxPage = (key: string) => monthTxPage[key] ?? 1;
  const setTxPage = (key: string, p: number) => setMonthTxPage(prev => ({ ...prev, [key]: p }));

  const renderLegend = (props: { payload?: { value: string; color?: string }[] }) => (
    <div className="flex items-center justify-center gap-4 pt-3">
      {props.payload?.map((entry) => (
        <button key={entry.value} onClick={() => toggleBar(entry.value)}
          className={`flex items-center gap-1.5 text-xs transition-opacity ${hiddenBars[entry.value] ? "opacity-30" : "opacity-100"}`}>
          <span className="w-3 h-2.5 rounded-sm inline-block" style={{ backgroundColor: entry.color ?? "#888" }} />
          <span className="text-gray-400">{entry.value}</span>
        </button>
      ))}
    </div>
  );

  const handleDeleteMonth = async (monthKey: string, monthLabel: string, txIds: string[]) => {
    if (!user) return;
    if (!window.confirm(`Delete all ${txIds.length} transaction${txIds.length !== 1 ? "s" : ""} from ${monthLabel}? This cannot be undone.`)) return;
    setDeletingMonth(monthKey);
    try {
      await Promise.all(txIds.map((id) => deleteDoc(doc(db, "users", user.uid, "crypto_transactions", id))));
      onDeleted?.();
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setDeletingMonth(null); }
  };

  const monthGroups = useMemo(() => {
    const map = new Map<string, { label: string; bought: number; sold: number; txCount: number; transactions: CryptoTx[] }>();
    for (const t of transactions) {
      const dateStr = t.transaction_date?.slice(0, 7);
      if (!dateStr) continue;
      const [year, month] = dateStr.split("-");
      const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
      const existing = map.get(dateStr) ?? { label, bought: 0, sold: 0, txCount: 0, transactions: [] };
      const amt = Number(t.total_inr ?? 0);
      if (t.trade_type === "BUY") existing.bought += amt;
      else existing.sold += amt;
      existing.txCount += 1;
      existing.transactions.push(t);
      map.set(dateStr, existing);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, value]) => ({ key, ...value }));
  }, [transactions]);

  const selectedTf = TIME_FRAMES.find(t => t.label === timeFrame)!;
  const chartMonths = selectedTf.months === 0
    ? [...monthGroups].reverse()
    : [...monthGroups].slice(0, selectedTf.months).reverse();

  const chartData = chartMonths.map(m => ({
    month: m.label,
    Bought: Math.round(m.bought),
    Sold: Math.round(m.sold),
    Net: Math.round(m.bought - m.sold),
  }));

  const accordionTotalPages = Math.max(1, Math.ceil(monthGroups.length / ACCORDION_PAGE_SIZE));
  const accordionMonths = monthGroups.slice((accordionPage - 1) * ACCORDION_PAGE_SIZE, accordionPage * ACCORDION_PAGE_SIZE);

  if (monthGroups.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Bar Chart */}
      <div className="glass-card p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
          <h2 className="text-base font-semibold text-white">Monthly Trading Activity</h2>
          <div className="flex items-center gap-1 bg-gray-800/60 rounded-lg p-1 self-start sm:self-auto">
            {TIME_FRAMES.map(tf => (
              <button key={tf.label} onClick={() => setTimeFrame(tf.label)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${timeFrame === tf.label ? "bg-orange-600 text-white" : "text-gray-400 hover:text-white"}`}>
                {tf.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="30%" barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} width={52} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Legend content={renderLegend} />
              {BAR_CONFIG.map(({ key, color }) => (
                <Bar key={key} dataKey={key} fill={color} radius={[3, 3, 0, 0]} maxBarSize={32} hide={hiddenBars[key]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Month-wise accordion */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-800/60">
          <h2 className="text-base font-semibold text-white">Month-wise Transactions</h2>
          <p className="text-gray-500 text-xs mt-0.5">Click a month to view its trades</p>
        </div>
        <div className="divide-y divide-gray-800/60">
          {accordionMonths.map((month) => {
            const isOpen = expandedMonth === month.key;
            const net = month.bought - month.sold;
            return (
              <div key={month.key}>
                <div className="flex items-center">
                  <button onClick={() => setExpandedMonth(isOpen ? null : month.key)}
                    className="flex-1 flex items-center justify-between px-4 py-4 md:px-6 hover:bg-gray-800/30 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${isOpen ? "text-orange-400" : "text-gray-500 group-hover:text-gray-300"}`}>
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                      <div className="text-left">
                        <span className="text-sm font-semibold text-white">{month.label}</span>
                        <span className="text-xs text-gray-500 ml-3">{month.txCount} trade{month.txCount !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 md:gap-6 text-sm">
                      {month.bought > 0 && (<div className="hidden sm:block text-right"><div className="text-xs text-gray-500">Bought</div><div className="text-emerald-400 font-medium">{formatINR(month.bought)}</div></div>)}
                      {month.sold > 0 && (<div className="hidden sm:block text-right"><div className="text-xs text-gray-500">Sold</div><div className="text-red-400 font-medium">{formatINR(month.sold)}</div></div>)}
                      <div className="text-right min-w-[100px]">
                        <div className="text-xs text-gray-500">Net</div>
                        <div className={`font-semibold ${net >= 0 ? "text-emerald-400" : "text-red-400"}`}>{net >= 0 ? "+" : ""}{formatINR(net)}</div>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleDeleteMonth(month.key, month.label, month.transactions.map(t => t.id))}
                    disabled={deletingMonth === month.key}
                    className="px-4 py-4 text-gray-600 hover:text-red-400 hover:bg-red-500/5 transition-colors disabled:opacity-50"
                    title={`Delete all ${month.txCount} trades from ${month.label}`}>
                    {deletingMonth === month.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>

                {isOpen && (() => {
                  const sorted = [...month.transactions].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
                  const currentPage = getTxPage(month.key);
                  const totalPages = Math.max(1, Math.ceil(sorted.length / TX_PER_PAGE));
                  const pageRows = sorted.slice((currentPage - 1) * TX_PER_PAGE, currentPage * TX_PER_PAGE);
                  return (
                    <div className="bg-gray-900/40 border-t border-gray-800/40">
                      <div className="overflow-x-auto">
                        <table className="data-table">
                          <thead>
                            <tr><th>Coin / Market</th><th>Type</th><th className="text-right">Volume</th><th className="text-right">Price</th><th className="text-right">Total (INR)</th><th className="text-right">Brokerage</th><th>Date</th><th className="text-center">Action</th></tr>
                          </thead>
                          <tbody>
                            {pageRows.map((t) => (
                              <tr key={t.id}>
                                <td><div className="font-mono font-semibold text-orange-400">{t.coin}</div><div className="text-xs text-gray-500">{t.market}</div></td>
                                <td><span className={t.trade_type === "BUY" ? "badge-buy" : "badge-sell"}>{t.trade_type}</span></td>
                                <td className="text-right text-gray-300">{formatNumber(Number(t.volume ?? 0), 8)}</td>
                                <td className="text-right text-gray-300">{t.price ? formatINR(Number(t.price)) : "—"}</td>
                                <td className="text-right font-medium text-gray-200">{t.total_inr ? formatINR(Number(t.total_inr)) : "—"}</td>
                                <td className="text-right text-yellow-400 text-xs">{t.fee_amount ? formatINR(Number(t.fee_amount)) : "—"}</td>
                                <td className="text-gray-400 text-xs">{formatDate(t.transaction_date)}</td>
                                <td className="text-center"><DeleteButton id={t.id} endpoint="/api/delete/crypto" itemName={t.coin} onDeleted={onDeleted} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {totalPages > 1 && (
                        <div className="px-4 py-2.5 md:px-6 border-t border-gray-800/40 bg-gray-900/60 flex flex-col items-center gap-1.5 sm:flex-row sm:justify-between">
                          <div className="flex items-center gap-1 justify-center order-1 sm:order-2">
                            <button onClick={() => setTxPage(month.key, currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹ Prev</button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                              <button key={p} onClick={() => setTxPage(month.key, p)} className={`hidden sm:inline-flex px-3 py-1.5 rounded text-xs font-medium transition-colors ${currentPage === p ? "bg-orange-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>{p}</button>
                            ))}
                            <span className="sm:hidden text-xs text-gray-500 px-1">{currentPage} / {totalPages}</span>
                            <button onClick={() => setTxPage(month.key, currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next ›</button>
                          </div>
                          <p className="text-xs text-gray-500 order-2 sm:order-1 text-center sm:text-left">
                            <span className="text-gray-300 font-medium">{(currentPage - 1) * TX_PER_PAGE + 1}–{Math.min(currentPage * TX_PER_PAGE, sorted.length)}</span>
                            {" "}of <span className="text-gray-300 font-medium">{sorted.length}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}

          {accordionTotalPages > 1 && (
            <div className="px-4 py-3 md:px-6 border-t border-gray-800/60 bg-gray-900/30 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
              <div className="flex items-center gap-2 order-1 sm:order-2">
                <button onClick={() => { setAccordionPage(p => Math.max(1, p - 1)); setExpandedMonth(null); }} disabled={accordionPage === 1} className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹ Prev</button>
                <span className="text-xs text-gray-500">{accordionPage} / {accordionTotalPages}</span>
                <button onClick={() => { setAccordionPage(p => Math.min(accordionTotalPages, p + 1)); setExpandedMonth(null); }} disabled={accordionPage === accordionTotalPages} className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next ›</button>
              </div>
              <p className="text-xs text-gray-500 order-2 sm:order-1 text-center sm:text-left">
                Months <span className="text-gray-300 font-medium">{(accordionPage - 1) * ACCORDION_PAGE_SIZE + 1}–{Math.min(accordionPage * ACCORDION_PAGE_SIZE, monthGroups.length)}</span> of <span className="text-gray-300 font-medium">{monthGroups.length}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
