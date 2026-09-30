"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { formatINR } from "@/lib/utils";
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, ReferenceLine,
  ComposedChart, Area,
} from "recharts";
import {
  ArrowLeft, Wallet, TrendingDown, Calendar, CreditCard,
  TrendingUp, PiggyBank, Target, Zap, Award, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Flame, ShoppingBag, CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { getCategoryColor, getCategoryIcon } from "../CategoryManageModal";
import FullscreenChartCard from "@/components/FullscreenChartCard";

// ─── Types ──────────────────────────────────────────────────────────────────
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
}

interface SavingsRow {
  id: string;
  amount: number;
  description: string;
  date: string;
  type: string;
}

interface CategoryDoc {
  id: string;
  name: string;
  icon: string;
  color: string;
  budget_limit?: number | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────
const PIE_COLORS = [
  "#f43f5e", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#14b8a6", "#a855f7", "#64748b", "#ef4444",
];

const INV_COLORS: Record<string, string> = {
  Stocks: "#10b981",
  MF: "#8b5cf6",
  Gold: "#eab308",
  Groww: "#06b6d4",
  Crypto: "#f97316",
  Other: "#64748b",
};

// ─── Tooltip helpers ─────────────────────────────────────────────────────────
function PieTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 shadow-xl text-sm">
      <p className="text-white font-semibold">{payload[0].name}</p>
      <p className="text-gray-300 mt-0.5">{formatINR(payload[0].value)}</p>
    </div>
  );
}

function BarTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; fill: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 shadow-xl text-sm space-y-1">
      <p className="text-white font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-6">
          <span style={{ color: p.fill }}>{p.name}</span>
          <span className="text-gray-200">{formatINR(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function LineTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 shadow-xl text-sm space-y-1">
      <p className="text-white font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-6">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="text-gray-200">{formatINR(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Mini stat card ──────────────────────────────────────────────────────────
function MiniCard({
  label, value, sub, icon: Icon, iconColor, iconBg, trend,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; iconColor: string; iconBg: string;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="glass-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
          <p className="text-xl md:text-2xl font-bold text-white truncate">{value}</p>
          {sub && (
            <p className={`text-xs mt-1 truncate ${
              trend === "up" ? "text-red-400" : trend === "down" ? "text-emerald-400" : "text-gray-500"
            }`}>{sub}</p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

// ─── Insight card ─────────────────────────────────────────────────────────────
function InsightCard({ icon: Icon, iconColor, iconBg, title, body, accent }: {
  icon: React.ElementType; iconColor: string; iconBg: string;
  title: string; body: string; accent?: string;
}) {
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${accent ?? "border-gray-800/60 bg-gray-800/30"}`}>
      <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Month key helper ─────────────────────────────────────────────────────────
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ExpenseDashboardPage() {
  const { user } = useAuth();
  const [expenses, setExpenses]   = useState<ExpenseRow[]>([]);
  const [savings, setSavings]     = useState<SavingsRow[]>([]);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [loading, setLoading]     = useState(true);
  const [hiddenCats, setHiddenCats] = useState<Set<string>>(new Set());

  const toggleCat = (name: string) =>
    setHiddenCats((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [expSnap, catSnap, savSnap] = await Promise.all([
          getDocs(query(collection(db, "users", user.uid, "expenses"), orderBy("date", "desc"))),
          getDocs(query(collection(db, "users", user.uid, "expense_categories"), orderBy("created_at", "asc"))),
          getDocs(query(collection(db, "users", user.uid, "savings"), orderBy("date", "desc"))),
        ]);
        setExpenses(expSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ExpenseRow)));
        setCategories(catSnap.docs.map((d) => ({ id: d.id, ...d.data() } as CategoryDoc)));
        setSavings(savSnap.docs.map((d) => ({ id: d.id, ...d.data() } as SavingsRow)));
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [user]);

  const now            = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevMonthDate  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey   = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const dayOfMonth     = now.getDate();
  const daysInMonth    = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  // ── This month & prev month expenses ──────────────────────────────────────
  const thisMonth     = useMemo(() => expenses.filter((e) => e.date?.slice(0, 7) === currentMonthKey), [expenses, currentMonthKey]);
  const prevMonth     = useMemo(() => expenses.filter((e) => e.date?.slice(0, 7) === prevMonthKey),    [expenses, prevMonthKey]);
  const thisMonthTotal = thisMonth.reduce((s, e) => s + Number(e.amount), 0);
  const prevMonthTotal = prevMonth.reduce((s, e) => s + Number(e.amount), 0);

  // ── Investment (savings type = Investment) ─────────────────────────────────
  const investments       = useMemo(() => savings.filter((s) => s.type === "Investment"), [savings]);
  const thisMonthInv      = useMemo(() => investments.filter((s) => s.date?.slice(0, 7) === currentMonthKey), [investments, currentMonthKey]);
  const prevMonthInv      = useMemo(() => investments.filter((s) => s.date?.slice(0, 7) === prevMonthKey),    [investments, prevMonthKey]);
  const thisMonthInvTotal  = thisMonthInv.reduce((s, r) => s + Number(r.amount), 0);
  const prevMonthInvTotal  = prevMonthInv.reduce((s, r) => s + Number(r.amount), 0);
  const allTimeInvTotal    = investments.reduce((s, r) => s + Number(r.amount), 0);

  // ── Non-investment savings ─────────────────────────────────────────────────
  const thisMonthSavings = useMemo(
    () => savings.filter((s) => s.date?.slice(0, 7) === currentMonthKey && s.type !== "Investment"),
    [savings, currentMonthKey]
  );
  const thisMonthSavingsTotal = thisMonthSavings.reduce((s, r) => s + Number(r.amount), 0);

  // ── Category totals (this month) ──────────────────────────────────────────
  const catTotals = useMemo(() => {
    const map = new Map<string, { name: string; total: number; icon: string; color: string }>();
    for (const e of thisMonth) {
      const ex = map.get(e.category_id) ?? { name: e.category_name, icon: e.category_icon, color: e.category_color, total: 0 };
      ex.total += Number(e.amount);
      map.set(e.category_id, ex);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [thisMonth]);

  // ── Daily spending bar ─────────────────────────────────────────────────────
  const dailyData = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of thisMonth) {
      const day = e.date?.slice(8, 10);
      if (!day) continue;
      map.set(day, (map.get(day) ?? 0) + Number(e.amount));
    }
    // Running cumulative
    let cum = 0;
    return Array.from({ length: dayOfMonth }, (_, i) => {
      const d   = String(i + 1).padStart(2, "0");
      const val = map.get(d) ?? 0;
      cum += val;
      return { day: d, Spent: Math.round(val), Cumulative: Math.round(cum) };
    });
  }, [thisMonth, dayOfMonth]);

  // ── 6-month Spent vs Invested trend ───────────────────────────────────────
  const sixMonthTrend = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d   = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = monthLabel(key);
      const spent   = expenses.filter((e) => e.date?.slice(0, 7) === key).reduce((s, e) => s + Number(e.amount), 0);
      const invested = investments.filter((s) => s.date?.slice(0, 7) === key).reduce((s, r) => s + Number(r.amount), 0);
      return { month: label, Spent: Math.round(spent), Invested: Math.round(invested) };
    });
  }, [expenses, investments]);

  // ── Payment method breakdown ───────────────────────────────────────────────
  const paymentData = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of thisMonth) {
      map.set(e.payment_method, (map.get(e.payment_method) ?? 0) + Number(e.amount));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [thisMonth]);

  // ── Budget tracker ─────────────────────────────────────────────────────────
  const budgetCats = useMemo(() => {
    const catSpend = new Map<string, number>();
    for (const e of thisMonth) {
      catSpend.set(e.category_id, (catSpend.get(e.category_id) ?? 0) + Number(e.amount));
    }
    return categories
      .filter((c) => c.budget_limit && c.budget_limit > 0)
      .map((c) => ({
        ...c,
        spent : catSpend.get(c.id) ?? 0,
        pct   : Math.min(((catSpend.get(c.id) ?? 0) / (c.budget_limit!)) * 100, 100),
        over  : (catSpend.get(c.id) ?? 0) > (c.budget_limit ?? 0),
        remaining: Math.max((c.budget_limit ?? 0) - (catSpend.get(c.id) ?? 0), 0),
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [categories, thisMonth]);

  // ── Investment breakdown by description keyword ────────────────────────────
  const invBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of thisMonthInv) {
      const desc  = (r.description ?? "").toLowerCase();
      let bucket  = "Other";
      if (desc.includes("stock") || desc.includes("zerodha") || desc.includes("nse") || desc.includes("bse")) bucket = "Stocks";
      else if (desc.includes("mf") || desc.includes("mutual") || desc.includes("sip")) bucket = "MF";
      else if (desc.includes("gold")) bucket = "Gold";
      else if (desc.includes("groww")) bucket = "Groww";
      else if (desc.includes("crypto") || desc.includes("coin") || desc.includes("btc") || desc.includes("eth")) bucket = "Crypto";
      map.set(bucket, (map.get(bucket) ?? 0) + Number(r.amount));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value), color: INV_COLORS[name] ?? INV_COLORS.Other }))
      .sort((a, b) => b.value - a.value);
  }, [thisMonthInv]);

  // ── Month-over-month comparison table (last 6 months) ─────────────────────
  const momTable = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d      = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key    = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label  = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      const spent  = expenses.filter((e) => e.date?.slice(0, 7) === key).reduce((s, e) => s + Number(e.amount), 0);
      const inv    = investments.filter((s) => s.date?.slice(0, 7) === key).reduce((s, r) => s + Number(r.amount), 0);
      const total  = spent + inv;
      const savRate = total > 0 ? ((inv / total) * 100) : 0;
      return { key, label, spent, inv, total, savRate };
    }).reverse(); // newest first
  }, [expenses, investments]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const allTimeTotal  = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const avgPerDay     = dayOfMonth > 0 ? thisMonthTotal / dayOfMonth : 0;
  const projected     = Math.round(avgPerDay * daysInMonth);
  const grandTotal    = thisMonthTotal + thisMonthInvTotal;
  const savingsRate   = grandTotal > 0 ? (thisMonthInvTotal / grandTotal) * 100 : 0;
  const expMoM        = prevMonthTotal > 0 ? ((thisMonthTotal - prevMonthTotal) / prevMonthTotal) * 100 : 0;
  const invMoM        = prevMonthInvTotal > 0 ? ((thisMonthInvTotal - prevMonthInvTotal) / prevMonthInvTotal) * 100 : 0;
  const topCat        = catTotals[0];
  const overBudgetCount = budgetCats.filter((c) => c.over).length;

  // Spending streak — consecutive days with ≥1 expense
  const spendingStreak = useMemo(() => {
    let streak = 0;
    const d = new Date(now);
    while (true) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const hasExpense = expenses.some((e) => e.date?.slice(0, 10) === key);
      if (!hasExpense) break;
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }, [expenses]);

  // ── Smart insights ─────────────────────────────────────────────────────────
  const insights = useMemo(() => {
    const list: { icon: React.ElementType; iconColor: string; iconBg: string; title: string; body: string; accent?: string }[] = [];

    if (savingsRate >= 30) {
      list.push({ icon: Award, iconColor: "text-emerald-400", iconBg: "bg-emerald-500/10", title: "Great savings rate!", body: `You're investing ${savingsRate.toFixed(0)}% of your total outflow this month. Keep it up!`, accent: "border-emerald-500/20 bg-emerald-500/5" });
    } else if (savingsRate > 0 && savingsRate < 20) {
      list.push({ icon: Target, iconColor: "text-amber-400", iconBg: "bg-amber-500/10", title: "Boost your savings rate", body: `You're currently investing ${savingsRate.toFixed(0)}% of total outflow. Aim for at least 20-30% to build wealth faster.` });
    }

    if (projected > prevMonthTotal && prevMonthTotal > 0) {
      list.push({ icon: AlertTriangle, iconColor: "text-red-400", iconBg: "bg-red-500/10", title: "Spending trending higher", body: `At your current pace you'll spend ${formatINR(projected)} this month — ${formatINR(projected - prevMonthTotal)} more than last month.`, accent: "border-red-500/20 bg-red-500/5" });
    } else if (projected < prevMonthTotal && prevMonthTotal > 0) {
      list.push({ icon: CheckCircle2, iconColor: "text-emerald-400", iconBg: "bg-emerald-500/10", title: "Spending under control", body: `Projected spend of ${formatINR(projected)} is ${formatINR(prevMonthTotal - projected)} less than last month. Great discipline!`, accent: "border-emerald-500/20 bg-emerald-500/5" });
    }

    if (overBudgetCount > 0) {
      list.push({ icon: AlertTriangle, iconColor: "text-red-400", iconBg: "bg-red-500/10", title: `${overBudgetCount} budget${overBudgetCount > 1 ? "s" : ""} exceeded`, body: `You've gone over budget in ${budgetCats.filter((c) => c.over).map((c) => c.name).join(", ")}. Review your spending in these categories.`, accent: "border-red-500/20 bg-red-500/5" });
    }

    if (topCat && thisMonthTotal > 0) {
      const pct = (topCat.total / thisMonthTotal) * 100;
      if (pct > 40) {
        list.push({ icon: ShoppingBag, iconColor: "text-violet-400", iconBg: "bg-violet-500/10", title: `${topCat.name} dominates spending`, body: `${pct.toFixed(0)}% of your expenses (${formatINR(topCat.total)}) went to ${topCat.name} this month. Consider reviewing if it aligns with your goals.` });
      }
    }

    if (thisMonthInvTotal === 0) {
      list.push({ icon: Zap, iconColor: "text-sky-400", iconBg: "bg-sky-500/10", title: "No investments this month yet", body: "You haven't logged any investments for this month. Add an investment entry to keep your financial picture complete." });
    }

    if (invMoM > 0 && prevMonthInvTotal > 0) {
      list.push({ icon: TrendingUp, iconColor: "text-sky-400", iconBg: "bg-sky-500/10", title: "Investment up this month", body: `You invested ${formatINR(thisMonthInvTotal)} this month — ${invMoM.toFixed(0)}% more than last month (${formatINR(prevMonthInvTotal)}). Compounding will thank you!`, accent: "border-sky-500/20 bg-sky-500/5" });
    }

    return list.slice(0, 5);
  }, [savingsRate, projected, prevMonthTotal, overBudgetCount, topCat, thisMonthTotal, thisMonthInvTotal, invMoM, prevMonthInvTotal, budgetCats]);

  const monthName = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 pb-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <Link href="/expenses" className="p-2 rounded-xl bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-all shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Expense Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">{monthName} · Full financial picture</p>
        </div>
      </div>

      {/* ── Row 0: 8 stat cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
        <MiniCard
          label="Month Spent"
          value={formatINR(thisMonthTotal)}
          sub={expMoM !== 0 ? `${expMoM > 0 ? "▲" : "▼"} ${Math.abs(expMoM).toFixed(1)}% vs last month` : `${thisMonth.length} expenses`}
          trend={expMoM > 0 ? "up" : "down"}
          icon={Wallet} iconColor="text-rose-400" iconBg="bg-rose-500/10"
        />
        <MiniCard
          label="Month Invested"
          value={formatINR(thisMonthInvTotal)}
          sub={invMoM !== 0 ? `${invMoM > 0 ? "▲" : "▼"} ${Math.abs(invMoM).toFixed(1)}% vs last month` : `${thisMonthInv.length} entries`}
          trend={invMoM > 0 ? "down" : "up"}
          icon={TrendingUp} iconColor="text-sky-400" iconBg="bg-sky-500/10"
        />
        <MiniCard
          label="Savings Rate"
          value={`${savingsRate.toFixed(1)}%`}
          sub={`${formatINR(thisMonthInvTotal)} of ${formatINR(grandTotal)} outflow`}
          trend={savingsRate >= 20 ? "down" : "up"}
          icon={PiggyBank} iconColor="text-emerald-400" iconBg="bg-emerald-500/10"
        />
        <MiniCard
          label="Avg / Day"
          value={formatINR(avgPerDay)}
          sub={`Projected ${formatINR(projected)} this month`}
          icon={TrendingDown} iconColor="text-orange-400" iconBg="bg-orange-500/10"
        />
        <MiniCard
          label="Top Category"
          value={topCat?.name ?? "—"}
          sub={topCat ? `${formatINR(topCat.total)} · ${thisMonthTotal > 0 ? ((topCat.total / thisMonthTotal) * 100).toFixed(0) : 0}% of spend` : "No expenses yet"}
          icon={ShoppingBag} iconColor="text-violet-400" iconBg="bg-violet-500/10"
        />
        <MiniCard
          label="Spend Streak"
          value={`${spendingStreak} day${spendingStreak !== 1 ? "s" : ""}`}
          sub="Consecutive days with expenses"
          icon={Flame} iconColor="text-red-400" iconBg="bg-red-500/10"
        />
        <MiniCard
          label="All-Time Spent"
          value={formatINR(allTimeTotal)}
          sub={`${expenses.length} total · ${formatINR(allTimeInvTotal)} invested`}
          icon={CreditCard} iconColor="text-gray-400" iconBg="bg-gray-700/50"
        />
      </div>

      {expenses.length === 0 && savings.length === 0 ? (
        <div className="glass-card p-6 md:p-12 text-center">
          <p className="text-gray-400 text-sm">No data yet.</p>
          <Link href="/expenses" className="inline-flex items-center gap-2 mt-3 text-sm text-rose-400 hover:text-rose-300 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Go add your first entry
          </Link>
        </div>
      ) : (
        <>

          {/* ── Row 1: Category donut + Daily bar ────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">

            {/* Category donut */}
            <div className="space-y-4 md:space-y-6 min-w-0">
              {catTotals.length === 0 ? (
                <div className="glass-card p-4 md:p-6">
                  <SectionHeader title={`Spending by Category — ${monthName}`} />
                  <p className="text-gray-500 text-sm text-center py-10">No expenses this month.</p>
                </div>
              ) : (
                <>
                  <FullscreenChartCard title={`Spending by Category — ${monthName}`} heightClass="h-64 sm:h-72">
                    {(big) => (
                      <PieChart>
                        <Pie data={catTotals.filter((c) => !hiddenCats.has(c.name))} dataKey="total" nameKey="name" cx="50%" cy="45%" innerRadius={big ? "45%" : "50%"} outerRadius={big ? "70%" : "72%"} paddingAngle={2}>
                          {catTotals.map((c, idx) => hiddenCats.has(c.name) ? null : <Cell key={c.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          payload={catTotals.map((c, idx) => ({
                            value: c.name,
                            type: "circle" as const,
                            color: hiddenCats.has(c.name) ? "#4b5563" : PIE_COLORS[idx % PIE_COLORS.length],
                          }))}
                          onClick={(e) => toggleCat(String(e.value))}
                          formatter={(v) => (
                            <span className={`text-xs cursor-pointer select-none ${hiddenCats.has(String(v)) ? "text-gray-600 line-through" : "text-gray-400 hover:text-gray-200"}`}>{v}</span>
                          )}
                          wrapperStyle={{ maxHeight: big ? 120 : 64, overflowY: "auto", cursor: "pointer" }}
                        />
                      </PieChart>
                    )}
                  </FullscreenChartCard>
                  {/* Category table */}
                  <div className="glass-card p-4 md:p-6 space-y-2">
                    {catTotals.slice(0, 5).map((c, idx) => {
                      const pct = thisMonthTotal > 0 ? (c.total / thisMonthTotal) * 100 : 0;
                      const CatIcon = getCategoryIcon(c.icon);
                      const color   = getCategoryColor(c.color);
                      return (
                        <div key={c.name} className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${color.bg}`}>
                            <CatIcon className={`w-3 h-3 ${color.text}`} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between text-xs mb-0.5">
                              <span className="text-gray-300 truncate">{c.name}</span>
                              <span className="text-gray-400 ml-2 shrink-0">{formatINR(c.total)}</span>
                            </div>
                            <div className="w-full bg-gray-800 rounded-full h-1">
                              <div className="h-1 rounded-full" style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                            </div>
                          </div>
                          <span className="text-xs text-gray-600 w-8 text-right shrink-0">{pct.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Daily spending bar with cumulative line */}
            {dailyData.every((d) => d.Spent === 0) ? (
              <div className="glass-card p-4 md:p-6">
                <SectionHeader title={`Daily Spending — ${monthName}`} sub="Bars = daily spend · Line = cumulative" />
                <p className="text-gray-500 text-sm text-center py-10">No expenses this month.</p>
              </div>
            ) : (
              <FullscreenChartCard title={`Daily Spending — ${monthName}`} subtitle="Bars = daily spend · Line = cumulative" heightClass="h-64" fill>
                {(big) => (
                  <ComposedChart data={dailyData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "#9ca3af", fontSize: big ? 12 : 10 }} axisLine={false} tickLine={false} interval={big ? 1 : "preserveStartEnd"} minTickGap={big ? 8 : 16} />
                    <YAxis yAxisId="left"  tick={{ fill: "#9ca3af", fontSize: big ? 12 : 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} width={big ? 52 : 38} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: "#9ca3af", fontSize: big ? 12 : 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} width={big ? 52 : 38} />
                    <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                    <Bar    yAxisId="left"  dataKey="Spent"      fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={big ? 28 : 18} />
                    <Line  yAxisId="right" dataKey="Cumulative" stroke="#fb923c" strokeWidth={1.5} dot={false} type="monotone" />
                  </ComposedChart>
                )}
              </FullscreenChartCard>
            )}
          </div>

          {/* ── Row 2: 6-month trend + Payment methods ───────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">

            {/* Spent vs Invested 6-month trend */}
            {sixMonthTrend.every((d) => d.Spent === 0 && d.Invested === 0) ? (
              <div className="glass-card p-4 md:p-6">
                <SectionHeader title="6-Month Spent vs Invested" sub="Compare your spending and investment patterns" />
                <p className="text-gray-500 text-sm text-center py-10">Not enough data.</p>
              </div>
            ) : (
              <FullscreenChartCard title="6-Month Spent vs Invested" subtitle="Compare your spending and investment patterns" heightClass="h-56 sm:h-64">
                {(big) => (
                  <LineChart data={sixMonthTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: big ? 12 : 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#9ca3af", fontSize: big ? 12 : 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} width={big ? 52 : 40} />
                    <Tooltip content={<LineTooltip />} />
                    <Legend formatter={(v) => <span className="text-xs text-gray-400">{v}</span>} iconType="circle" iconSize={8} />
                    <Line type="monotone" dataKey="Spent"    stroke="#f43f5e" strokeWidth={2} dot={{ fill: "#f43f5e", r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="Invested" stroke="#38bdf8" strokeWidth={2} dot={{ fill: "#38bdf8", r: 3 }} activeDot={{ r: 5 }} strokeDasharray="5 3" />
                  </LineChart>
                )}
              </FullscreenChartCard>
            )}

            {/* Payment methods */}
            <div className="glass-card p-4 md:p-6 min-w-0">
              <SectionHeader title={`Payment Methods — ${monthName}`} />
              {paymentData.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-10">No expenses this month.</p>
              ) : (
                <div className="space-y-3 pt-1">
                  {paymentData.map((p, idx) => {
                    const pct   = thisMonthTotal > 0 ? (p.value / thisMonthTotal) * 100 : 0;
                    const color = PIE_COLORS[idx % PIE_COLORS.length];
                    return (
                      <div key={p.name}>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-gray-300 font-medium">{p.name}</span>
                          </div>
                          <span className="text-gray-400 text-xs">{formatINR(p.value)} <span className="text-gray-600">({pct.toFixed(1)}%)</span></span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  })}
                  {/* Total row */}
                  <div className="pt-3 border-t border-gray-800/60 flex justify-between text-sm">
                    <span className="text-gray-500">Total spent</span>
                    <span className="text-white font-semibold">{formatINR(thisMonthTotal)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Row 3: Investment breakdown ──────────────────────────────────── */}
          <div className={`grid grid-cols-1 gap-4 md:gap-6 ${thisMonthInvTotal > 0 && invBreakdown.length > 1 ? "md:grid-cols-2" : ""}`}>

            {thisMonthInvTotal > 0 && invBreakdown.length > 1 && (
              <FullscreenChartCard title={`Investment Split — ${monthName}`} subtitle="Where your investment money went" heightClass="h-56 sm:h-64">
                {(big) => (
                  <PieChart>
                    <Pie data={invBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={big ? "45%" : "50%"} outerRadius={big ? "75%" : "80%"} paddingAngle={2}>
                      {invBreakdown.map((d, idx) => <Cell key={idx} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                )}
              </FullscreenChartCard>
            )}

            {/* Investment breakdown */}
            <div className="glass-card p-4 md:p-6 min-w-0">
              <SectionHeader title={`Investments — ${monthName}`} sub="Where your investment money went" />
              {thisMonthInvTotal === 0 ? (
                <p className="text-gray-500 text-sm text-center py-10">No investments logged this month.</p>
              ) : (
                <>
                  {/* Rows */}
                  <div className="space-y-3">
                    {invBreakdown.map((d) => {
                      const pct = thisMonthInvTotal > 0 ? (d.value / thisMonthInvTotal) * 100 : 0;
                      return (
                        <div key={d.name}>
                          <div className="flex justify-between text-sm mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                              <span className="text-gray-300">{d.name}</span>
                            </div>
                            <span className="text-gray-300 font-medium">{formatINR(d.value)}</span>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: d.color }} />
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-3 border-t border-gray-800/60 flex justify-between text-sm">
                      <span className="text-gray-500">Total invested</span>
                      <span className="text-sky-400 font-semibold">{formatINR(thisMonthInvTotal)}</span>
                    </div>
                  </div>
                  {/* Entries list */}
                  <div className="mt-4 space-y-1.5">
                    {thisMonthInv.map((r) => (
                      <div key={r.id} className="flex justify-between items-center px-3 py-2 rounded-lg bg-gray-800/40 text-xs">
                        <span className="text-gray-300 truncate mr-2">{r.description}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sky-400 font-medium">{formatINR(Number(r.amount))}</span>
                          <span className="text-gray-600">{new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Row 4: Month-over-month comparison table ─────────────────────── */}
          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-800/60">
              <SectionHeader title="Month-over-Month Comparison" sub="Last 6 months — Spent, Invested, and Savings Rate" />
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="text-right">Spent</th>
                    <th className="text-right">Invested</th>
                    <th className="text-right">Total Outflow</th>
                    <th className="text-right">Savings Rate</th>
                    <th className="text-right">Δ Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {momTable.map((row, idx) => {
                    const prevRow  = momTable[idx + 1];
                    const deltaSpent = prevRow ? row.spent - prevRow.spent : null;
                    const isCurrent  = row.key === currentMonthKey;
                    return (
                      <tr key={row.key} className={isCurrent ? "bg-rose-500/5" : ""}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-200 font-medium">{row.label}</span>
                            {isCurrent && <span className="text-xs px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400">Now</span>}
                          </div>
                        </td>
                        <td className="text-right text-rose-400 font-medium">{row.spent > 0 ? formatINR(row.spent) : "—"}</td>
                        <td className="text-right text-sky-400 font-medium">{row.inv > 0 ? formatINR(row.inv) : "—"}</td>
                        <td className="text-right text-gray-200">{row.total > 0 ? formatINR(row.total) : "—"}</td>
                        <td className="text-right">
                          {row.total > 0 ? (
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${row.savRate >= 20 ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
                              {row.savRate.toFixed(1)}%
                            </span>
                          ) : "—"}
                        </td>
                        <td className="text-right text-xs">
                          {deltaSpent === null ? (
                            <span className="text-gray-600">—</span>
                          ) : deltaSpent > 0 ? (
                            <span className="inline-flex items-center gap-0.5 text-red-400">
                              <ArrowUpRight className="w-3 h-3" /> {formatINR(deltaSpent)}
                            </span>
                          ) : deltaSpent < 0 ? (
                            <span className="inline-flex items-center gap-0.5 text-emerald-400">
                              <ArrowDownRight className="w-3 h-3" /> {formatINR(Math.abs(deltaSpent))}
                            </span>
                          ) : (
                            <span className="text-gray-600">No change</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Row 5: Spent vs Invested stacked bar + smart insights ─────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">

            {/* Spent vs Invested bar chart */}
            <FullscreenChartCard title="Spent vs Invested" subtitle="Monthly comparison — last 6 months" heightClass="h-56 sm:h-64">
              {(big) => (
                <BarChart data={sixMonthTrend} barGap={4} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: big ? 12 : 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: "#9ca3af", fontSize: big ? 12 : 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} width={big ? 52 : 40} />
                  <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Legend formatter={(v) => <span className="text-xs text-gray-400">{v}</span>} iconType="circle" iconSize={8} />
                  <Bar dataKey="Spent"    fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={big ? 40 : 20} />
                  <Bar dataKey="Invested" fill="#38bdf8" radius={[3, 3, 0, 0]} maxBarSize={big ? 40 : 20} />
                </BarChart>
              )}
            </FullscreenChartCard>

            {/* Smart Insights */}
            <div className="glass-card p-4 md:p-6 min-w-0">
              <SectionHeader title="Smart Insights" sub="Personalised observations from your data" />
              {insights.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-10">Add more data to get personalised insights.</p>
              ) : (
                <div className="space-y-3">
                  {insights.map((ins, idx) => (
                    <InsightCard key={idx} {...ins} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Row 6: Top expenses table ─────────────────────────────────────── */}
          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-800/60 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Top Expenses — {monthName}</h2>
                <p className="text-xs text-gray-500 mt-0.5">Highest single-item expenses this month</p>
              </div>
              <span className="text-xs text-gray-500">{thisMonth.length} total</span>
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
                      <th>#</th>
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
                      .map((e, idx) => {
                        const CatIcon = getCategoryIcon(e.category_icon);
                        const color   = getCategoryColor(e.category_color);
                        return (
                          <tr key={e.id}>
                            <td className="text-gray-600 text-xs w-8">{idx + 1}</td>
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

          {/* ── Row 7: Savings breakdown ──────────────────────────────────────── */}
          {thisMonthSavings.length > 0 && (
            <div className="glass-card overflow-hidden">
              <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-800/60">
                <h2 className="text-base font-semibold text-white">Other Savings — {monthName}</h2>
                <p className="text-xs text-gray-500 mt-0.5">FD, savings account, emergency fund, etc.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Type</th>
                      <th className="text-right">Amount</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {thisMonthSavings.map((r) => (
                      <tr key={r.id}>
                        <td className="font-medium text-gray-200">{r.description}</td>
                        <td>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs">{r.type}</span>
                        </td>
                        <td className="text-right font-semibold text-emerald-400">{formatINR(Number(r.amount))}</td>
                        <td className="text-gray-400 text-xs">
                          {new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-800/60">
                      <td colSpan={2} className="text-gray-400 text-sm font-medium">Total Savings</td>
                      <td className="text-right text-emerald-400 font-bold">{formatINR(thisMonthSavingsTotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

        </>
      )}
    </div>
  );
}
