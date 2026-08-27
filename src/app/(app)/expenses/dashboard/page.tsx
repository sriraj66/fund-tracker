"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { formatINR } from "@/lib/utils";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from "recharts";
import { ArrowLeft, Wallet, TrendingDown, Calendar, CreditCard } from "lucide-react";
import Link from "next/link";
import { getCategoryColor, getCategoryIcon } from "../CategoryManageModal";

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
}

interface CategoryDoc {
  id: string;
  name: string;
  icon: string;
  color: string;
  budget_limit?: number | null;
}

// Colour palette for pie chart slices
const PIE_COLORS = [
  "#f43f5e", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#14b8a6", "#a855f7", "#64748b", "#ef4444",
];

function CustomPieTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 shadow-xl text-sm">
      <p className="text-white font-semibold">{payload[0].name}</p>
      <p className="text-gray-300 mt-0.5">{formatINR(payload[0].value)}</p>
    </div>
  );
}

function CustomBarTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 shadow-xl text-sm">
      <p className="text-white font-semibold mb-1">{label}</p>
      <p className="text-rose-400">{formatINR(payload[0].value)}</p>
    </div>
  );
}

function CustomLineTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 shadow-xl text-sm">
      <p className="text-white font-semibold mb-1">{label}</p>
      <p className="text-rose-400">{formatINR(payload[0].value)}</p>
    </div>
  );
}

export default function ExpenseDashboardPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [expSnap, catSnap] = await Promise.all([
          getDocs(query(collection(db, "users", user.uid, "expenses"), orderBy("date", "desc"))),
          getDocs(query(collection(db, "users", user.uid, "expense_categories"), orderBy("created_at", "asc"))),
        ]);
        setExpenses(expSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ExpenseRow)));
        setCategories(catSnap.docs.map((d) => ({ id: d.id, ...d.data() } as CategoryDoc)));
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [user]);

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // This month expenses
  const thisMonth = useMemo(
    () => expenses.filter((e) => e.date?.slice(0, 7) === currentMonthKey),
    [expenses, currentMonthKey]
  );
  const thisMonthTotal = thisMonth.reduce((s, e) => s + Number(e.amount), 0);

  // Category totals (this month) for pie chart
  const catTotals = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>();
    for (const e of thisMonth) {
      const ex = map.get(e.category_id) ?? { name: e.category_name, total: 0 };
      ex.total += Number(e.amount);
      map.set(e.category_id, ex);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [thisMonth]);

  // Daily spending for current month
  const dailyData = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of thisMonth) {
      const day = e.date?.slice(8, 10); // DD
      if (!day) continue;
      map.set(day, (map.get(day) ?? 0) + Number(e.amount));
    }
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Array.from({ length: now.getDate() }, (_, i) => {
      const d = String(i + 1).padStart(2, "0");
      return { day: d, Spent: Math.round(map.get(d) ?? 0) };
    });
  }, [thisMonth]);

  // Last 6 months trend
  const monthTrend = useMemo(() => {
    const map = new Map<string, { label: string; total: number }>();
    for (const e of expenses) {
      const key = e.date?.slice(0, 7);
      if (!key) continue;
      const [y, m] = key.split("-");
      const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-IN", {
        month: "short", year: "2-digit",
      });
      const ex = map.get(key) ?? { label, total: 0 };
      ex.total += Number(e.amount);
      map.set(key, ex);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([, v]) => ({ month: v.label, Spent: Math.round(v.total) }));
  }, [expenses]);

  // Payment method breakdown
  const paymentData = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of thisMonth) {
      map.set(e.payment_method, (map.get(e.payment_method) ?? 0) + Number(e.amount));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [thisMonth]);

  // Budget vs actual (categories with budget set)
  const budgetCats = useMemo(() => {
    const catSpend = new Map<string, number>();
    for (const e of thisMonth) {
      catSpend.set(e.category_id, (catSpend.get(e.category_id) ?? 0) + Number(e.amount));
    }
    return categories
      .filter((c) => c.budget_limit && c.budget_limit > 0)
      .map((c) => ({
        ...c,
        spent: catSpend.get(c.id) ?? 0,
        pct: Math.min(((catSpend.get(c.id) ?? 0) / (c.budget_limit!)) * 100, 100),
        over: (catSpend.get(c.id) ?? 0) > (c.budget_limit ?? 0),
      }));
  }, [categories, thisMonth]);

  const monthName = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const allTimeTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const avgPerDay = now.getDate() > 0 ? thisMonthTotal / now.getDate() : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/expenses"
          className="p-2 rounded-xl bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-all shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Expense Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Analytics for {monthName}</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 md:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">This Month</p>
              <p className="text-2xl font-bold text-white">{formatINR(thisMonthTotal)}</p>
              <p className="text-xs text-gray-500 mt-1">{thisMonth.length} expenses</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-rose-400" />
            </div>
          </div>
        </div>
        <div className="glass-card p-4 md:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Avg / Day</p>
              <p className="text-2xl font-bold text-white">{formatINR(avgPerDay)}</p>
              <p className="text-xs text-gray-500 mt-1">Based on {now.getDate()} days</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-orange-400" />
            </div>
          </div>
        </div>
        <div className="glass-card p-4 md:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Categories</p>
              <p className="text-2xl font-bold text-white">{catTotals.length}</p>
              <p className="text-xs text-gray-500 mt-1">Active this month</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-violet-400" />
            </div>
          </div>
        </div>
        <div className="glass-card p-4 md:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">All Time</p>
              <p className="text-2xl font-bold text-white">{formatINR(allTimeTotal)}</p>
              <p className="text-xs text-gray-500 mt-1">{expenses.length} total expenses</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="glass-card p-6 md:p-12 text-center">
          <p className="text-gray-400 text-sm">No expense data yet.</p>
          <Link href="/expenses" className="inline-flex items-center gap-2 mt-3 text-sm text-rose-400 hover:text-rose-300 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Go add your first expense
          </Link>
        </div>
      ) : (
        <>
          {/* Row 1: Category Pie + Daily Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category Donut */}
            <div className="glass-card p-4 md:p-6">
              <h2 className="text-base font-semibold text-white mb-4">Spending by Category — {monthName}</h2>
              {catTotals.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-10">No expenses this month.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={catTotals}
                        dataKey="total"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={2}
                      >
                        {catTotals.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                      <Legend
                        formatter={(value) => <span className="text-xs text-gray-400">{value}</span>}
                        iconType="circle"
                        iconSize={8}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Daily spending bar */}
            <div className="glass-card p-4 md:p-6">
              <h2 className="text-base font-semibold text-white mb-4">Daily Spending — {monthName}</h2>
              {dailyData.every((d) => d.Spent === 0) ? (
                <p className="text-gray-500 text-sm text-center py-10">No expenses this month.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis dataKey="day" tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
                      <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} width={48} />
                      <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                      <Bar dataKey="Spent" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: 6-month trend + Payment method */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 6-month line trend */}
            <div className="glass-card p-4 md:p-6">
              <h2 className="text-base font-semibold text-white mb-4">6-Month Trend</h2>
              {monthTrend.length < 2 ? (
                <p className="text-gray-500 text-sm text-center py-10">Need at least 2 months of data.</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} width={48} />
                      <Tooltip content={<CustomLineTooltip />} cursor={{ stroke: "#f43f5e", strokeWidth: 1, strokeDasharray: "4 2" }} />
                      <Line type="monotone" dataKey="Spent" stroke="#f43f5e" strokeWidth={2} dot={{ fill: "#f43f5e", r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Payment method breakdown */}
            <div className="glass-card p-4 md:p-6">
              <h2 className="text-base font-semibold text-white mb-4">Payment Methods — {monthName}</h2>
              {paymentData.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-10">No expenses this month.</p>
              ) : (
                <div className="space-y-3 pt-2">
                  {paymentData.map((p, idx) => {
                    const pct = thisMonthTotal > 0 ? (p.value / thisMonthTotal) * 100 : 0;
                    const color = PIE_COLORS[idx % PIE_COLORS.length];
                    return (
                      <div key={p.name}>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="text-gray-300 font-medium">{p.name}</span>
                          <span className="text-gray-400">{formatINR(p.value)} <span className="text-gray-600">({pct.toFixed(1)}%)</span></span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Row 3: Budget tracker */}
          {budgetCats.length > 0 && (
            <div className="glass-card p-4 md:p-6">
              <h2 className="text-base font-semibold text-white mb-5">Budget Tracker — {monthName}</h2>
              <div className="space-y-4">
                {budgetCats.map((cat) => {
                  const CatIcon = getCategoryIcon(cat.icon);
                  const color = getCategoryColor(cat.color);
                  return (
                    <div key={cat.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${color.text}`}>
                          <CatIcon className="w-3.5 h-3.5" />
                          {cat.name}
                        </span>
                        <div className="text-sm text-right">
                          <span className={`font-semibold ${cat.over ? "text-red-400" : "text-gray-200"}`}>
                            {formatINR(cat.spent)}
                          </span>
                          <span className="text-gray-500"> / {formatINR(cat.budget_limit ?? 0)}</span>
                          {cat.over && <span className="ml-2 text-xs font-medium text-red-400">Over budget!</span>}
                        </div>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${cat.over ? "bg-red-500" : color.dot}`}
                          style={{ width: `${cat.pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Row 4: Top expenses table */}
          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-800/60">
              <h2 className="text-base font-semibold text-white">Top Expenses — {monthName}</h2>
            </div>
            {thisMonth.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-gray-500 text-sm">No expenses this month.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Payment</th>
                      <th className="text-right">Amount</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...thisMonth]
                      .sort((a, b) => Number(b.amount) - Number(a.amount))
                      .slice(0, 10)
                      .map((e) => {
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
                            <td className="font-medium text-gray-200 max-w-[200px] truncate">{e.description}</td>
                            <td className="text-gray-400 text-xs">{e.payment_method}</td>
                            <td className="text-right font-semibold text-rose-400">{formatINR(Number(e.amount))}</td>
                            <td className="text-gray-400 text-xs">
                              {new Date(e.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
