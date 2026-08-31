"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { formatINR, formatDate } from "@/lib/utils";
import StatCard from "@/components/StatCard";
import { Wallet, TrendingDown, Receipt, BarChart2, Plus, ExternalLink, PiggyBank } from "lucide-react";
import Link from "next/link";
import ExpenseAddModal from "./ExpenseAddModal";
import CategoryManageModal from "./CategoryManageModal";
import TagManageModal from "./TagManageModal";
import ExpenseMonthlyStats from "./ExpenseMonthlyStats";
import { getCategoryColor, getCategoryIcon } from "./CategoryManageModal";
import { getTagColor } from "./TagManageModal";
import SavingsAddModal, { type SavingsRow } from "./SavingsAddModal";

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
  tags?: string[];
  notes?: string | null;
  created_at: string;
}

// tagColorMap: loaded once per session from Firestore to display tag colors
// We use a simple in-memory map: tagName → colorKey
// It's populated from available tags in page state
type TagColorMap = Record<string, string>;

// ─── Pagination bar (same pattern as MutualFunds) ──────────────────────────
function PaginationBar({
  page, totalPages, total, pageSize, label, onPage,
}: {
  page: number; totalPages: number; total: number; pageSize: number;
  label: string; onPage: (p: number) => void;
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
    <div className="px-4 py-3 md:px-6 border-t border-gray-800/60 flex flex-col sm:flex-row items-center gap-2 sm:justify-between">
      <p className="text-xs text-gray-500 order-2 sm:order-1">
        Showing <span className="text-gray-300 font-medium">{from}–{to}</span> of{" "}
        <span className="text-gray-300 font-medium">{total}</span> {label}
      </p>
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
              className={`hidden sm:inline-flex px-3 py-1.5 rounded text-xs font-medium transition-colors ${page === item ? "bg-rose-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
            >
              {item}
            </button>
          )
        )}
        <span className="sm:hidden text-xs text-gray-500 px-2">{page} / {totalPages}</span>
        <button onClick={() => onPage(page + 1)} disabled={page === totalPages} className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next ›</button>
        <button onClick={() => onPage(totalPages)} disabled={page === totalPages} className="px-2 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">»</button>
      </div>
    </div>
  );
}

// ─── Inline delete button (Firebase direct) ────────────────────────────────
function ExpenseDeleteButton({ id, onDeleted }: { id: string; onDeleted?: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!user) return;
    if (!window.confirm("Delete this expense? This cannot be undone.")) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, "users", user.uid, "expenses", id));
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
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      )}
    </button>
  );
}

const PAGE_SIZE = 10;

export default function ExpensesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [savings, setSavings] = useState<SavingsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [txPage, setTxPage] = useState(1);
  const [savPage, setSavPage] = useState(1);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [tagColorMap, setTagColorMap] = useState<TagColorMap>({});

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [expSnap, tagSnap, savSnap] = await Promise.all([
        getDocs(query(collection(db, "users", user.uid, "expenses"), orderBy("date", "desc"))),
        getDocs(query(collection(db, "users", user.uid, "expense_tags"), orderBy("created_at", "asc"))),
        getDocs(query(collection(db, "users", user.uid, "savings"), orderBy("date", "desc"))),
      ]);
      setRows(expSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ExpenseRow)));
      setSavings(savSnap.docs.map((d) => ({ id: d.id, ...d.data() } as SavingsRow)));
      // Build tag color map
      const map: TagColorMap = {};
      tagSnap.docs.forEach((d) => {
        const data = d.data() as { name: string; color: string };
        map[data.name] = data.color;
      });
      setTagColorMap(map);
      setTxPage(1);
      setSavPage(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  // Current month stats
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisMonthRows = rows.filter((r) => r.date?.slice(0, 7) === currentMonthKey);
  const thisMonthTotal = thisMonthRows.reduce((s, r) => s + Number(r.amount), 0);

  // All-time total
  const allTimeTotal = rows.reduce((s, r) => s + Number(r.amount), 0);

  // Top category this month
  const catMap = new Map<string, { name: string; icon: string; color: string; total: number }>();
  for (const r of thisMonthRows) {
    const ex = catMap.get(r.category_id) ?? { name: r.category_name, icon: r.category_icon, color: r.category_color, total: 0 };
    ex.total += Number(r.amount);
    catMap.set(r.category_id, ex);
  }
  const topCat = Array.from(catMap.values()).sort((a, b) => b.total - a.total)[0];

  // Avg per day this month
  const daysInMonth = now.getDate();
  const avgPerDay = daysInMonth > 0 ? thisMonthTotal / daysInMonth : 0;

  // Unique categories for filter
  const uniqueCategories = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; icon: string; color: string }>();
    for (const r of rows) {
      if (!seen.has(r.category_id)) {
        seen.set(r.category_id, { id: r.category_id, name: r.category_name, icon: r.category_icon, color: r.category_color });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  // Unique tags across all expenses for filter
  const uniqueTags = useMemo(() => {
    const seen = new Set<string>();
    rows.forEach((r) => r.tags?.forEach((t) => seen.add(t)));
    return Array.from(seen).sort();
  }, [rows]);

  // Filtered rows — apply both category and tag filter
  const filteredRows = useMemo(() => {
    let result = filterCategory === "all" ? rows : rows.filter((r) => r.category_id === filterCategory);
    if (filterTag !== "all") result = result.filter((r) => r.tags?.includes(filterTag));
    return result;
  }, [rows, filterCategory, filterTag]);

  const txTotalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const paginatedRows = useMemo(
    () => filteredRows.slice((txPage - 1) * PAGE_SIZE, txPage * PAGE_SIZE),
    [filteredRows, txPage]
  );

  // Savings pagination
  const totalSavings = savings.reduce((s, r) => s + Number(r.amount), 0);
  const savTotalPages = Math.max(1, Math.ceil(savings.length / PAGE_SIZE));
  const paginatedSavings = useMemo(
    () => savings.slice((savPage - 1) * PAGE_SIZE, savPage * PAGE_SIZE),
    [savings, savPage]
  );

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const monthName = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6 pb-6 sm:space-y-8">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Expenses</h1>
          <p className="text-gray-400 text-sm mt-1">Track and analyse your spending</p>
        </div>
        <div className="page-header-actions">
          <Link
            href="/expenses/dashboard"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-all border border-gray-700/60"
          >
            <BarChart2 className="w-4 h-4" />
            Dashboard
            <ExternalLink className="w-3 h-3" />
          </Link>
          <TagManageModal onChanged={fetchData} />
          <CategoryManageModal onChanged={fetchData} />
          <SavingsAddModal onAdded={fetchData} />
          <ExpenseAddModal onAdded={fetchData} />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title={`${monthName} Spent`}
          value={formatINR(thisMonthTotal)}
          subtitle={`${thisMonthRows.length} expense${thisMonthRows.length !== 1 ? "s" : ""} this month`}
          icon={Wallet}
          iconColor="text-rose-400"
          iconBg="bg-rose-500/10"
        />
        <StatCard
          title="Avg Per Day"
          value={formatINR(avgPerDay)}
          subtitle={`Based on ${daysInMonth} days so far`}
          icon={TrendingDown}
          iconColor="text-orange-400"
          iconBg="bg-orange-500/10"
        />
        <StatCard
          title="Total Savings"
          value={formatINR(totalSavings)}
          subtitle={`${savings.length} saving${savings.length !== 1 ? "s" : ""} recorded`}
          icon={PiggyBank}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
        />
        <StatCard
          title="All-Time Expenses"
          value={formatINR(allTimeTotal)}
          subtitle={`${rows.length} total expenses`}
          icon={Receipt}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10"
        />
      </div>

      {/* Monthly stats (bar chart + accordion) */}
      {rows.length > 0 && <ExpenseMonthlyStats expenses={rows} onDeleted={fetchData} />}

      {/* Category breakdown (this month) */}
      {catMap.size > 0 && (
        <div className="glass-card p-4 md:p-6">
          <h2 className="text-base font-semibold text-white mb-4">
            Category Breakdown — {monthName}
          </h2>
          <div className="space-y-3">
            {Array.from(catMap.values())
              .sort((a, b) => b.total - a.total)
              .map((cat) => {
                const CatIcon = getCategoryIcon(cat.icon);
                const color = getCategoryColor(cat.color);
                const pct = thisMonthTotal > 0 ? (cat.total / thisMonthTotal) * 100 : 0;
                return (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className={`inline-flex items-center gap-1.5 font-medium ${color.text}`}>
                        <CatIcon className="w-3.5 h-3.5" />
                        {cat.name}
                      </span>
                      <span className="text-gray-300 font-medium">
                        {formatINR(cat.total)}{" "}
                        <span className="text-gray-500 font-normal">({pct.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${color.dot}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Savings history */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Savings</h2>
          </div>
          <span className="text-xs text-gray-500">{savings.length} record{savings.length !== 1 ? "s" : ""}</span>
        </div>

        {savings.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
              <PiggyBank className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-gray-400 text-sm font-medium">No savings recorded yet</p>
            <p className="text-gray-500 text-xs mt-1">Click &ldquo;Add Saving&rdquo; to log your first saving.</p>
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-gray-800/50">
              {paginatedSavings.map((s) => (
                <div key={s.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10">
                      <PiggyBank className="w-4 h-4 text-emerald-400" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-200 leading-snug">{s.description}</p>
                        <span className="text-sm font-bold text-emerald-400 flex-shrink-0 ml-1">{formatINR(Number(s.amount))}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-1.5 mt-0.5">
                        <span className="text-xs font-medium text-emerald-500">{s.type}</span>
                        <span className="text-gray-700 text-xs">·</span>
                        <span className="text-gray-500 text-xs">{formatDate(s.date)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Description</th>
                    <th className="text-right">Amount</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSavings.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400">
                          <PiggyBank className="w-3 h-3" />
                          {s.type}
                        </span>
                      </td>
                      <td className="font-medium text-gray-200 max-w-[220px] truncate">{s.description}</td>
                      <td className="text-right font-semibold text-emerald-400">{formatINR(Number(s.amount))}</td>
                      <td className="text-gray-400 text-xs">{formatDate(s.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <PaginationBar
              page={savPage}
              totalPages={savTotalPages}
              total={savings.length}
              pageSize={PAGE_SIZE}
              label="savings"
              onPage={setSavPage}
            />
          </>
        )}
      </div>

      {/* Transaction history */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-800/60 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">All Expenses</h2>
          </div>
          {/* Category filter */}
          {uniqueCategories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              <span className="text-xs text-gray-600 whitespace-nowrap flex-shrink-0">Category:</span>
              <button
                onClick={() => { setFilterCategory("all"); setTxPage(1); }}
                className={`whitespace-nowrap flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterCategory === "all" ? "bg-rose-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
              >
                All
              </button>
              {uniqueCategories.map((cat) => {
                const CatIcon = getCategoryIcon(cat.icon);
                const color = getCategoryColor(cat.color);
                const isActive = filterCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => { setFilterCategory(cat.id); setTxPage(1); }}
                    className={`whitespace-nowrap flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive ? `${color.bg} ${color.text}` : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                    }`}
                  >
                    <CatIcon className="w-3 h-3" />
                    {cat.name}
                  </button>
                );
              })}
            </div>
          )}
          {/* Tag filter */}
          {uniqueTags.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              <span className="text-xs text-gray-600 whitespace-nowrap flex-shrink-0">Tag:</span>
              <button
                onClick={() => { setFilterTag("all"); setTxPage(1); }}
                className={`whitespace-nowrap flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterTag === "all" ? "bg-sky-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
              >
                All
              </button>
              {uniqueTags.map((tag) => {
                const tc = getTagColor(tagColorMap[tag] ?? "gray");
                const isActive = filterTag === tag;
                return (
                  <button
                    key={tag}
                    onClick={() => { setFilterTag(tag); setTxPage(1); }}
                    className={`whitespace-nowrap flex-shrink-0 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isActive ? `${tc.bg} ${tc.text} ring-1 ring-current/40` : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-3">
              <Plus className="w-6 h-6 text-rose-400" />
            </div>
            <p className="text-gray-400 text-sm font-medium">No expenses yet</p>
            <p className="text-gray-500 text-xs mt-1">Click &ldquo;Add Expense&rdquo; to record your first expense.</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-gray-500 text-sm">No expenses in this category.</p>
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-gray-800/50">
              {paginatedRows.map((e) => {
                const CatIcon = getCategoryIcon(e.category_icon);
                const color = getCategoryColor(e.category_color);
                return (
                  <div key={e.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${color.bg}`}>
                        <CatIcon className={`w-4 h-4 ${color.text}`} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-gray-200 leading-snug">{e.description}</p>
                          <span className="text-sm font-bold text-rose-400 flex-shrink-0 ml-1">{formatINR(Number(e.amount))}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-1.5 mt-0.5">
                          <span className={`text-xs font-medium ${color.text}`}>{e.category_name}</span>
                          <span className="text-gray-700 text-xs">·</span>
                          <span className="text-gray-500 text-xs">{e.payment_method}</span>
                          <span className="text-gray-700 text-xs">·</span>
                          <span className="text-gray-500 text-xs">{formatDate(e.date)}</span>
                        </div>
                        {e.tags && e.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {e.tags.map((tag) => {
                              const tc = getTagColor(tagColorMap[tag] ?? "gray");
                              return (
                                <span key={tag} className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${tc.bg} ${tc.text}`}>
                                  {tag}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <ExpenseDeleteButton id={e.id} onDeleted={fetchData} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Tags</th>
                    <th>Payment</th>
                    <th className="text-right">Amount</th>
                    <th>Date</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((e) => {
                    const CatIcon = getCategoryIcon(e.category_icon);
                    const color = getCategoryColor(e.category_color);
                    return (
                      <tr key={e.id}>
                        <td>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${color.bg} ${color.text}`}>
                            <CatIcon className="w-3 h-3" />
                            {e.category_name}
                          </span>
                        </td>
                        <td className="font-medium text-gray-200 max-w-[180px] truncate">{e.description}</td>
                        <td>
                          {e.tags && e.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {e.tags.map((tag) => {
                                const tc = getTagColor(tagColorMap[tag] ?? "gray");
                                return (
                                  <span
                                    key={tag}
                                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium ${tc.bg} ${tc.text}`}
                                  >
                                    {tag}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-gray-700 text-xs">—</span>
                          )}
                        </td>
                        <td className="text-gray-400 text-xs">{e.payment_method}</td>
                        <td className="text-right font-semibold text-rose-400">{formatINR(Number(e.amount))}</td>
                        <td className="text-gray-400 text-xs">{formatDate(e.date)}</td>
                        <td className="text-center">
                          <ExpenseDeleteButton id={e.id} onDeleted={fetchData} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <PaginationBar
              page={txPage}
              totalPages={txTotalPages}
              total={filteredRows.length}
              pageSize={PAGE_SIZE}
              label="expenses"
              onPage={setTxPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
