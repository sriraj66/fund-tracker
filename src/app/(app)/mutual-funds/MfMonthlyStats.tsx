"use client";

import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChevronDown, ChevronRight, Trash2, Loader2 } from "lucide-react";

const MF_BAR_CONFIG = [
  { key: "Purchased", color: "#8b5cf6" },
  { key: "Redeemed",  color: "#ef4444" },
  { key: "Net",       color: "#38bdf8" },
];

const TIME_FRAMES = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "2Y", months: 24 },
  { label: "All", months: 0 },
];
const ACCORDION_PAGE_SIZE = 6;
import { formatINR, formatDate, formatNumber } from "@/lib/utils";
import DeleteButton from "@/components/DeleteButton";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";

interface MfTx {
  id: string;
  scheme_name: string;
  transaction_type: string;
  units: number;
  nav: number;
  amount: number;
  transaction_date: string;
}

interface Props {
  transactions: MfTx[];
  onDeleted?: () => void;
}

// Custom tooltip for the bar chart
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
      {payload.length >= 2 && (
        <div className="flex items-center justify-between gap-6 border-t border-gray-700 mt-2 pt-2">
          <span className="text-gray-400 text-xs">Net</span>
          <span className="text-white font-semibold text-xs">
            {formatINR((payload[0]?.value ?? 0) - (payload[1]?.value ?? 0))}
          </span>
        </div>
      )}
    </div>
  );
}

const TX_PER_PAGE = 5;

export default function MfMonthlyStats({ transactions, onDeleted }: Props) {
  const { user } = useAuth();
  const [hiddenBars, setHiddenBars] = useState<Record<string, boolean>>({});
  const [timeFrame, setTimeFrame] = useState("6M");
  const [accordionPage, setAccordionPage] = useState(1);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const toggleBar = (key: string) =>
    setHiddenBars((prev) => ({ ...prev, [key]: !prev[key] }));

  const renderLegend = (props: { payload?: { value: string; color?: string }[] }) => (
    <div className="flex items-center justify-center gap-4 pt-3">
      {props.payload?.map((entry) => (
        <button
          key={entry.value}
          onClick={() => toggleBar(entry.value)}
          className={`flex items-center gap-1.5 text-xs transition-opacity ${hiddenBars[entry.value] ? "opacity-30" : "opacity-100"}`}
        >
          <span className="w-3 h-2.5 rounded-sm inline-block" style={{ backgroundColor: entry.color ?? "#888" }} />
          <span className="text-gray-400">{entry.value}</span>
        </button>
      ))}
    </div>
  );
  const [monthTxPage, setMonthTxPage] = useState<Record<string, number>>({});
  const [deletingMonth, setDeletingMonth] = useState<string | null>(null);

  const handleDeleteMonth = async (monthKey: string, monthLabel: string, txIds: string[]) => {
    if (!user) return;
    if (!window.confirm(`Delete all ${txIds.length} transactions from ${monthLabel}? This cannot be undone.`)) return;
    setDeletingMonth(monthKey);
    try {
      await Promise.all(
        txIds.map((id) => deleteDoc(doc(db, "users", user.uid, "mf_transactions", id)))
      );
      onDeleted?.();
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeletingMonth(null);
    }
  };

  const getTxPage = (key: string) => monthTxPage[key] ?? 1;
  const setTxPage = (key: string, p: number) => setMonthTxPage((prev) => ({ ...prev, [key]: p }));

  // Group transactions by month (YYYY-MM)
  const monthGroups = useMemo(() => {
    const map = new Map<string, { label: string; purchases: number; redemptions: number; txCount: number; transactions: MfTx[] }>();

    for (const t of transactions) {
      const dateStr = t.transaction_date?.slice(0, 7); // "2026-07"
      if (!dateStr) continue;

      const [year, month] = dateStr.split("-");
      const label = new Date(Number(year), Number(month) - 1, 1)
        .toLocaleDateString("en-IN", { month: "short", year: "numeric" }); // "Jul 2026"

      const existing = map.get(dateStr) ?? { label, purchases: 0, redemptions: 0, txCount: 0, transactions: [] };

      if (t.transaction_type === "REDEMPTION" || t.transaction_type === "REDEEM") {
        existing.redemptions += Number(t.amount);
      } else {
        existing.purchases += Number(t.amount);
      }
      existing.txCount += 1;
      existing.transactions.push(t);
      map.set(dateStr, existing);
    }

    // Sort months descending
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, value]) => ({ key, ...value }));
  }, [transactions]);

  // Chart data filtered by time frame
  const selectedTf = TIME_FRAMES.find((t) => t.label === timeFrame)!;
  const chartMonths = selectedTf.months === 0
    ? [...monthGroups].reverse()
    : [...monthGroups].slice(0, selectedTf.months).reverse();

  const chartData = chartMonths.map((m) => ({
    month: m.label,
    Purchased: Math.round(m.purchases),
    Redeemed: Math.round(m.redemptions),
    Net: Math.round(m.purchases - m.redemptions),
  }));

  // Accordion pagination
  const accordionTotalPages = Math.max(1, Math.ceil(monthGroups.length / ACCORDION_PAGE_SIZE));
  const accordionMonths = monthGroups.slice((accordionPage - 1) * ACCORDION_PAGE_SIZE, accordionPage * ACCORDION_PAGE_SIZE);

  if (monthGroups.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Bar Chart */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Monthly Investment Activity</h2>
          <div className="flex items-center gap-1 bg-gray-800/60 rounded-lg p-1">
            {TIME_FRAMES.map((tf) => (
              <button
                key={tf.label}
                onClick={() => setTimeFrame(tf.label)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${timeFrame === tf.label ? "bg-violet-600 text-white" : "text-gray-400 hover:text-white"}`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="30%" barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                width={52}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Legend content={renderLegend} />
              {MF_BAR_CONFIG.map(({ key, color }) => (
                <Bar key={key} dataKey={key} fill={color} radius={[3, 3, 0, 0]} maxBarSize={32} hide={hiddenBars[key]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Month-wise accordion */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800/60">
          <h2 className="text-base font-semibold text-white">Month-wise Transactions</h2>
          <p className="text-gray-500 text-xs mt-0.5">Click a month to view its transactions</p>
        </div>

        <div className="divide-y divide-gray-800/60">
          {accordionMonths.map((month) => {
            const isOpen = expandedMonth === month.key;
            const net = month.purchases - month.redemptions;

            return (
              <div key={month.key}>
                {/* Month header row */}
                <div className="flex items-center">
                  <button
                    onClick={() => setExpandedMonth(isOpen ? null : month.key)}
                    className="flex-1 flex items-center justify-between px-6 py-4 hover:bg-gray-800/30 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${isOpen ? "text-violet-400" : "text-gray-500 group-hover:text-gray-300"}`}>
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                      <div className="text-left">
                        <span className="text-sm font-semibold text-white">{month.label}</span>
                        <span className="text-xs text-gray-500 ml-3">{month.txCount} transaction{month.txCount !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      {month.purchases > 0 && (<div className="text-right"><div className="text-xs text-gray-500">Purchased</div><div className="text-violet-400 font-medium">{formatINR(month.purchases)}</div></div>)}
                      {month.redemptions > 0 && (<div className="text-right"><div className="text-xs text-gray-500">Redeemed</div><div className="text-red-400 font-medium">{formatINR(month.redemptions)}</div></div>)}
                      <div className="text-right min-w-[100px]">
                        <div className="text-xs text-gray-500">Net</div>
                        <div className={`font-semibold ${net >= 0 ? "text-emerald-400" : "text-red-400"}`}>{net >= 0 ? "+" : ""}{formatINR(net)}</div>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleDeleteMonth(month.key, month.label, month.transactions.map((t) => t.id))}
                    disabled={deletingMonth === month.key}
                    className="px-4 py-4 text-gray-600 hover:text-red-400 hover:bg-red-500/5 transition-colors disabled:opacity-50"
                    title={`Delete all ${month.txCount} transactions from ${month.label}`}
                  >
                    {deletingMonth === month.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>

                {/* Expanded transactions with pagination */}
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
                            <tr>
                              <th>Scheme Name</th><th>Type</th>
                              <th className="text-right">Units</th><th className="text-right">NAV</th>
                              <th className="text-right">Amount</th><th>Date</th>
                              <th className="text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pageRows.map((t) => (
                              <tr key={t.id}>
                                <td className="max-w-xs truncate font-medium text-gray-200">{t.scheme_name}</td>
                                <td><span className={t.transaction_type === "REDEMPTION" ? "badge-sell" : "badge-purchase"}>{t.transaction_type}</span></td>
                                <td className="text-right text-gray-300">{t.units ? formatNumber(Number(t.units), 4) : "—"}</td>
                                <td className="text-right text-gray-300">{t.nav ? formatINR(Number(t.nav)) : "—"}</td>
                                <td className="text-right font-medium text-gray-200">{formatINR(Number(t.amount))}</td>
                                <td className="text-gray-400 text-xs">{formatDate(t.transaction_date)}</td>
                                <td className="text-center"><DeleteButton id={t.id} endpoint="/api/delete/mf" itemName={t.scheme_name} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination for this month's transactions */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-2.5 border-t border-gray-800/40 bg-gray-900/60">
                          <p className="text-xs text-gray-500">
                            <span className="text-gray-300 font-medium">{(currentPage - 1) * TX_PER_PAGE + 1}–{Math.min(currentPage * TX_PER_PAGE, sorted.length)}</span>
                            {" "}of <span className="text-gray-300 font-medium">{sorted.length}</span>
                          </p>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setTxPage(month.key, currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹ Prev</button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                              <button key={p} onClick={() => setTxPage(month.key, p)} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${currentPage === p ? "bg-violet-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>{p}</button>
                            ))}
                            <button onClick={() => setTxPage(month.key, currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next ›</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
          {/* Accordion pagination */}
          {accordionTotalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-800/60 bg-gray-900/30">
              <p className="text-xs text-gray-500">
                Months <span className="text-gray-300 font-medium">{(accordionPage - 1) * ACCORDION_PAGE_SIZE + 1}–{Math.min(accordionPage * ACCORDION_PAGE_SIZE, monthGroups.length)}</span> of <span className="text-gray-300 font-medium">{monthGroups.length}</span>
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => { setAccordionPage((p) => Math.max(1, p - 1)); setExpandedMonth(null); }} disabled={accordionPage === 1} className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹ Prev</button>
                <span className="text-xs text-gray-500">{accordionPage} / {accordionTotalPages}</span>
                <button onClick={() => { setAccordionPage((p) => Math.min(accordionTotalPages, p + 1)); setExpandedMonth(null); }} disabled={accordionPage === accordionTotalPages} className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next ›</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
