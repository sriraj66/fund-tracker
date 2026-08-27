"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { ChevronDown, ChevronRight, Trash2, Loader2 } from "lucide-react";
import { formatINR, formatDate, formatNumber } from "@/lib/utils";
import DeleteButton from "@/components/DeleteButton";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";

const TIME_FRAMES = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "2Y", months: 24 },
  { label: "All", months: 0 },
];

const ACCORDION_PAGE_SIZE = 6;
const TX_PER_PAGE = 5;

interface GoldTx {
  id: string;
  purchase_date: string;
  price_per_gram: number;
  grams: number;
  amount: number;
  gold_type: string;
  notes?: string;
}

interface Props {
  transactions: GoldTx[];
  onDeleted?: () => void;
}

function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; fill: string }[];
  label?: string;
}) {
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

export default function GoldMonthlyStats({ transactions, onDeleted }: Props) {
  const { user } = useAuth();
  const [timeFrame, setTimeFrame] = useState("6M");
  const [accordionPage, setAccordionPage] = useState(1);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [monthTxPage, setMonthTxPage] = useState<Record<string, number>>({});
  const [deletingMonth, setDeletingMonth] = useState<string | null>(null);

  const getTxPage = (key: string) => monthTxPage[key] ?? 1;
  const setTxPage = (key: string, p: number) =>
    setMonthTxPage((prev) => ({ ...prev, [key]: p }));

  const handleDeleteMonth = async (monthKey: string, monthLabel: string, txIds: string[]) => {
    if (!user) return;
    if (!window.confirm(`Delete all ${txIds.length} transaction${txIds.length !== 1 ? "s" : ""} from ${monthLabel}? This cannot be undone.`)) return;
    setDeletingMonth(monthKey);
    try {
      await Promise.all(
        txIds.map((id) => deleteDoc(doc(db, "users", user.uid, "gold_transactions", id)))
      );
      onDeleted?.();
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeletingMonth(null);
    }
  };

  // Group transactions by month (YYYY-MM)
  const monthGroups = useMemo(() => {
    const map = new Map<string, {
      label: string;
      invested: number;
      grams: number;
      txCount: number;
      transactions: GoldTx[];
    }>();

    for (const t of transactions) {
      const dateStr = t.purchase_date?.slice(0, 7);
      if (!dateStr) continue;
      const [year, month] = dateStr.split("-");
      const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-IN", {
        month: "short",
        year: "numeric",
      });
      const existing = map.get(dateStr) ?? { label, invested: 0, grams: 0, txCount: 0, transactions: [] };
      existing.invested += Number(t.amount);
      existing.grams += Number(t.grams);
      existing.txCount += 1;
      existing.transactions.push(t);
      map.set(dateStr, existing);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, value]) => ({ key, ...value }));
  }, [transactions]);

  const selectedTf = TIME_FRAMES.find((t) => t.label === timeFrame)!;
  const chartMonths = selectedTf.months === 0
    ? [...monthGroups].reverse()
    : [...monthGroups].slice(0, selectedTf.months).reverse();

  const chartData = chartMonths.map((m) => ({
    month: m.label,
    Invested: Math.round(m.invested),
  }));

  const accordionTotalPages = Math.max(1, Math.ceil(monthGroups.length / ACCORDION_PAGE_SIZE));
  const accordionMonths = monthGroups.slice(
    (accordionPage - 1) * ACCORDION_PAGE_SIZE,
    accordionPage * ACCORDION_PAGE_SIZE
  );

  if (monthGroups.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Bar Chart */}
      <div className="glass-card p-4 md:p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Monthly Investment Activity</h2>
          <div className="flex items-center gap-1 bg-gray-800/60 rounded-lg p-1">
            {TIME_FRAMES.map((tf) => (
              <button
                key={tf.label}
                onClick={() => setTimeFrame(tf.label)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  timeFrame === tf.label ? "bg-yellow-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="40%" barGap={3}>
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
              <Legend
                content={() => (
                  <div className="flex items-center justify-center gap-4 pt-3">
                    <span className="flex items-center gap-1.5 text-xs">
                      <span className="w-3 h-2.5 rounded-sm inline-block bg-yellow-500" />
                      <span className="text-gray-400">Invested</span>
                    </span>
                  </div>
                )}
              />
              <Bar dataKey="Invested" fill="#eab308" radius={[3, 3, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Month-wise accordion */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-800/60">
          <h2 className="text-base font-semibold text-white">Month-wise Transactions</h2>
          <p className="text-gray-500 text-xs mt-0.5">Click a month to view its transactions</p>
        </div>

        <div className="divide-y divide-gray-800/60">
          {accordionMonths.map((month) => {
            const isOpen = expandedMonth === month.key;

            return (
              <div key={month.key}>
                {/* Month header row */}
                <div className="flex items-center">
                  <button
                    onClick={() => setExpandedMonth(isOpen ? null : month.key)}
                    className="flex-1 flex items-center justify-between px-4 py-4 md:px-6 hover:bg-gray-800/30 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                          isOpen ? "text-yellow-400" : "text-gray-500 group-hover:text-gray-300"
                        }`}
                      >
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                      <div className="text-left">
                        <span className="text-sm font-semibold text-white">{month.label}</span>
                        <span className="text-xs text-gray-500 ml-3">
                          {month.txCount} transaction{month.txCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 md:gap-6 text-sm">
                      <div className="hidden sm:block text-right">
                        <div className="text-xs text-gray-500">Grams</div>
                        <div className="text-amber-400 font-medium">{formatNumber(month.grams, 4)} g</div>
                      </div>
                      <div className="text-right min-w-[110px]">
                        <div className="text-xs text-gray-500">Invested</div>
                        <div className="text-yellow-400 font-semibold">{formatINR(month.invested)}</div>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() =>
                      handleDeleteMonth(month.key, month.label, month.transactions.map((t) => t.id))
                    }
                    disabled={deletingMonth === month.key}
                    className="px-4 py-4 text-gray-600 hover:text-red-400 hover:bg-red-500/5 transition-colors disabled:opacity-50"
                    title={`Delete all ${month.txCount} transactions from ${month.label}`}
                  >
                    {deletingMonth === month.key ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Expanded transactions with pagination */}
                {isOpen && (() => {
                  const sorted = [...month.transactions].sort((a, b) =>
                    b.purchase_date.localeCompare(a.purchase_date)
                  );
                  const currentPage = getTxPage(month.key);
                  const totalPages = Math.max(1, Math.ceil(sorted.length / TX_PER_PAGE));
                  const pageRows = sorted.slice(
                    (currentPage - 1) * TX_PER_PAGE,
                    currentPage * TX_PER_PAGE
                  );
                  return (
                    <div className="bg-gray-900/40 border-t border-gray-800/40">
                      <div className="overflow-x-auto">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Type</th>
                              <th className="text-right">Grams</th>
                              <th className="text-right">Price / g</th>
                              <th className="text-right">Amount</th>
                              <th>Notes</th>
                              <th className="text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pageRows.map((t) => (
                              <tr key={t.id}>
                                <td className="text-gray-300 font-medium">{formatDate(t.purchase_date)}</td>
                                <td>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                    {t.gold_type}
                                  </span>
                                </td>
                                <td className="text-right text-gray-300">{formatNumber(Number(t.grams), 4)} g</td>
                                <td className="text-right text-gray-300">{formatINR(Number(t.price_per_gram))}</td>
                                <td className="text-right font-semibold text-yellow-400">{formatINR(Number(t.amount))}</td>
                                <td className="text-gray-500 text-xs max-w-[140px] truncate">{t.notes ?? "—"}</td>
                                <td className="text-center">
                                  <DeleteButton id={t.id} endpoint="/api/delete/gold" itemName={t.gold_type} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Per-month transaction pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-2.5 md:px-6 border-t border-gray-800/40 bg-gray-900/60">
                          <p className="text-xs text-gray-500">
                            <span className="text-gray-300 font-medium">
                              {(currentPage - 1) * TX_PER_PAGE + 1}–{Math.min(currentPage * TX_PER_PAGE, sorted.length)}
                            </span>{" "}of{" "}
                            <span className="text-gray-300 font-medium">{sorted.length}</span>
                          </p>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setTxPage(month.key, currentPage - 1)}
                              disabled={currentPage === 1}
                              className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >‹ Prev</button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                              <button
                                key={p}
                                onClick={() => setTxPage(month.key, p)}
                                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                  currentPage === p ? "bg-yellow-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
                                }`}
                              >{p}</button>
                            ))}
                            <button
                              onClick={() => setTxPage(month.key, currentPage + 1)}
                              disabled={currentPage === totalPages}
                              className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >Next ›</button>
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
            <div className="flex items-center justify-between px-4 py-3 md:px-6 border-t border-gray-800/60 bg-gray-900/30">
              <p className="text-xs text-gray-500">
                Months{" "}
                <span className="text-gray-300 font-medium">
                  {(accordionPage - 1) * ACCORDION_PAGE_SIZE + 1}–{Math.min(accordionPage * ACCORDION_PAGE_SIZE, monthGroups.length)}
                </span>{" "}of{" "}
                <span className="text-gray-300 font-medium">{monthGroups.length}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setAccordionPage((p) => Math.max(1, p - 1)); setExpandedMonth(null); }}
                  disabled={accordionPage === 1}
                  className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >‹ Prev</button>
                <span className="text-xs text-gray-500">{accordionPage} / {accordionTotalPages}</span>
                <button
                  onClick={() => { setAccordionPage((p) => Math.min(accordionTotalPages, p + 1)); setExpandedMonth(null); }}
                  disabled={accordionPage === accordionTotalPages}
                  className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >Next ›</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
