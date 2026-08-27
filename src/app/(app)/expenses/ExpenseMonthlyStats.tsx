"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { ChevronDown, ChevronRight, Trash2, Loader2 } from "lucide-react";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { formatINR, formatDate } from "@/lib/utils";
import { getCategoryColor, getCategoryIcon } from "./CategoryManageModal";

// Inline delete button using Firebase directly (no API route needed)
function InlineDeleteButton({ id, uid, onDeleted }: { id: string; uid: string; onDeleted?: () => void }) {
  const [loading, setLoading] = useState(false);
  const handleDelete = async () => {
    if (!window.confirm("Delete this expense?")) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, "users", uid, "expenses", id));
      onDeleted?.();
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
      title="Delete expense"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Trash2 className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

interface ExpenseRow {
  id: string;
  amount: number;
  category_id: string;
  category_name: string;
  category_icon: string;
  category_color: string;
  description: string;
  date: string;
  payment_method: string;
  notes?: string | null;
}

interface Props {
  expenses: ExpenseRow[];
  onDeleted?: () => void;
}

const TIME_FRAMES = [
  { label: "3M",  months: 3  },
  { label: "6M",  months: 6  },
  { label: "1Y",  months: 12 },
  { label: "All", months: 0  },
];

const ACCORDION_PAGE_SIZE = 6;
const TX_PER_PAGE = 5;

// Custom tooltip
function CustomTooltip({
  active,
  payload,
  label,
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

export default function ExpenseMonthlyStats({ expenses, onDeleted }: Props) {
  const { user } = useAuth();
  const [timeFrame, setTimeFrame] = useState("6M");
  const [accordionPage, setAccordionPage] = useState(1);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [monthTxPage, setMonthTxPage] = useState<Record<string, number>>({});
  const [deletingMonth, setDeletingMonth] = useState<string | null>(null);

  const getTxPage = (key: string) => monthTxPage[key] ?? 1;
  const setTxPage = (key: string, p: number) =>
    setMonthTxPage((prev) => ({ ...prev, [key]: p }));

  const handleDeleteMonth = async (monthKey: string, monthLabel: string, ids: string[]) => {
    if (!user) return;
    if (!window.confirm(`Delete all ${ids.length} expense${ids.length !== 1 ? "s" : ""} from ${monthLabel}? This cannot be undone.`)) return;
    setDeletingMonth(monthKey);
    try {
      await Promise.all(ids.map((id) => deleteDoc(doc(db, "users", user.uid, "expenses", id))));
      onDeleted?.();
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeletingMonth(null);
    }
  };

  // Group by month YYYY-MM
  const monthGroups = useMemo(() => {
    const map = new Map<
      string,
      { label: string; total: number; txCount: number; expenses: ExpenseRow[] }
    >();

    for (const e of expenses) {
      const dateStr = e.date?.slice(0, 7);
      if (!dateStr) continue;
      const [year, month] = dateStr.split("-");
      const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-IN", {
        month: "short",
        year: "numeric",
      });
      const existing = map.get(dateStr) ?? { label, total: 0, txCount: 0, expenses: [] };
      existing.total += Number(e.amount);
      existing.txCount += 1;
      existing.expenses.push(e);
      map.set(dateStr, existing);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, value]) => ({ key, ...value }));
  }, [expenses]);

  // Chart data
  const selectedTf = TIME_FRAMES.find((t) => t.label === timeFrame)!;
  const chartMonths =
    selectedTf.months === 0
      ? [...monthGroups].reverse()
      : [...monthGroups].slice(0, selectedTf.months).reverse();

  const chartData = chartMonths.map((m) => ({
    month: m.label,
    Spent: Math.round(m.total),
  }));

  // Accordion pagination
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
          <h2 className="text-base font-semibold text-white">Monthly Spending</h2>
          <div className="flex items-center gap-1 bg-gray-800/60 rounded-lg p-1">
            {TIME_FRAMES.map((tf) => (
              <button
                key={tf.label}
                onClick={() => setTimeFrame(tf.label)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  timeFrame === tf.label
                    ? "bg-rose-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="40%">
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
              <Bar dataKey="Spent" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Month-wise accordion */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-800/60">
          <h2 className="text-base font-semibold text-white">Month-wise Expenses</h2>
          <p className="text-gray-500 text-xs mt-0.5">Click a month to view its expenses</p>
        </div>

        <div className="divide-y divide-gray-800/60">
          {accordionMonths.map((month) => {
            const isOpen = expandedMonth === month.key;

            return (
              <div key={month.key}>
                {/* Month header */}
                <div className="flex items-center">
                  <button
                    onClick={() => setExpandedMonth(isOpen ? null : month.key)}
                    className="flex-1 flex items-center justify-between px-4 py-4 md:px-6 hover:bg-gray-800/30 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                          isOpen ? "text-rose-400" : "text-gray-500 group-hover:text-gray-300"
                        }`}
                      >
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </div>
                      <div className="text-left">
                        <span className="text-sm font-semibold text-white">{month.label}</span>
                        <span className="text-xs text-gray-500 ml-3">
                          {month.txCount} expense{month.txCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 md:gap-6 text-sm">
                      <div className="text-right min-w-[100px]">
                        <div className="text-xs text-gray-500">Total Spent</div>
                        <div className="font-semibold text-rose-400">{formatINR(month.total)}</div>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() =>
                      handleDeleteMonth(
                        month.key,
                        month.label,
                        month.expenses.map((e) => e.id)
                      )
                    }
                    disabled={deletingMonth === month.key}
                    className="px-4 py-4 text-gray-600 hover:text-red-400 hover:bg-red-500/5 transition-colors disabled:opacity-50"
                    title={`Delete all ${month.txCount} expenses from ${month.label}`}
                  >
                    {deletingMonth === month.key ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Expanded rows */}
                {isOpen &&
                  (() => {
                    const sorted = [...month.expenses].sort((a, b) =>
                      b.date.localeCompare(a.date)
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
                                <th>Category</th>
                                <th>Description</th>
                                <th>Payment</th>
                                <th className="text-right">Amount</th>
                                <th>Date</th>
                                <th className="text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pageRows.map((e) => {
                                const CatIcon = getCategoryIcon(e.category_icon);
                                const color = getCategoryColor(e.category_color);
                                return (
                                  <tr key={e.id}>
                                    <td>
                                      <span
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${color.bg} ${color.text}`}
                                      >
                                        <CatIcon className="w-3 h-3" />
                                        {e.category_name}
                                      </span>
                                    </td>
                                    <td className="max-w-[180px] truncate text-gray-200 font-medium">
                                      {e.description}
                                    </td>
                                    <td className="text-gray-400 text-xs">{e.payment_method}</td>
                                    <td className="text-right font-semibold text-rose-400">
                                      {formatINR(Number(e.amount))}
                                    </td>
                                    <td className="text-gray-400 text-xs">{formatDate(e.date)}</td>
                                    <td className="text-center">
                                      <InlineDeleteButton
                                        id={e.id}
                                        uid={user?.uid ?? ""}
                                        onDeleted={onDeleted}
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination within month */}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between px-4 py-2.5 md:px-6 border-t border-gray-800/40 bg-gray-900/60">
                            <p className="text-xs text-gray-500">
                              <span className="text-gray-300 font-medium">
                                {(currentPage - 1) * TX_PER_PAGE + 1}–
                                {Math.min(currentPage * TX_PER_PAGE, sorted.length)}
                              </span>{" "}
                              of{" "}
                              <span className="text-gray-300 font-medium">{sorted.length}</span>
                            </p>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setTxPage(month.key, currentPage - 1)}
                                disabled={currentPage === 1}
                                className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                ‹ Prev
                              </button>
                              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                                <button
                                  key={p}
                                  onClick={() => setTxPage(month.key, p)}
                                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                    currentPage === p
                                      ? "bg-rose-600 text-white"
                                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                                  }`}
                                >
                                  {p}
                                </button>
                              ))}
                              <button
                                onClick={() => setTxPage(month.key, currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                Next ›
                              </button>
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
                  {(accordionPage - 1) * ACCORDION_PAGE_SIZE + 1}–
                  {Math.min(accordionPage * ACCORDION_PAGE_SIZE, monthGroups.length)}
                </span>{" "}
                of{" "}
                <span className="text-gray-300 font-medium">{monthGroups.length}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setAccordionPage((p) => Math.max(1, p - 1));
                    setExpandedMonth(null);
                  }}
                  disabled={accordionPage === 1}
                  className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ‹ Prev
                </button>
                <span className="text-xs text-gray-500">
                  {accordionPage} / {accordionTotalPages}
                </span>
                <button
                  onClick={() => {
                    setAccordionPage((p) => Math.min(accordionTotalPages, p + 1));
                    setExpandedMonth(null);
                  }}
                  disabled={accordionPage === accordionTotalPages}
                  className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next ›
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
