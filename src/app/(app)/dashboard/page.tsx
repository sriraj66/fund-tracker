"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import StatCard from "@/components/StatCard";
import {
  BarChart3, TrendingUp, Globe, Bitcoin, Gem, Wallet, Receipt,
  TrendingDown, ArrowUpRight, ArrowDownRight, Target, PiggyBank,
  Lightbulb, Award, AlertTriangle, CheckCircle2, Zap, Activity,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line, ComposedChart, Area,
} from "recharts";
import { formatINR, formatUSD } from "@/lib/utils";
import Link from "next/link";
import ExpenseAddModal from "@/app/(app)/expenses/ExpenseAddModal";

const CHART_COLORS = ["#8b5cf6","#10b981","#3b82f6","#f97316","#eab308","#f43f5e","#06b6d4","#a855f7"];

// ─── Tooltip helpers ──────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; name: string; fill?: string; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      {label && <p className="text-white font-semibold mb-1">{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.fill ?? p.color }} className="font-medium">{p.name}</span>
          <span className="text-gray-200">{formatINR(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Insight card ─────────────────────────────────────────────────────────────
function InsightCard({ icon: Icon, iconColor, iconBg, title, body, accent }: {
  icon: React.ElementType; iconColor: string; iconBg: string;
  title: string; body: string; accent?: string;
}) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${accent ?? "border-gray-800/60 bg-gray-800/30"}`}>
      <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
        <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-white">{title}</p>
        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface MfRow       { amount: number; transaction_type: string; transaction_date?: string }
interface StockRow    { invested: number; current_value: number; pnl: number; pnl_pct: number; month: string }
interface UsRow       { amount: number; side: string; transaction_date?: string }
interface CryptoRow   { total_inr: number; trade_type: string; transaction_date?: string }
interface GoldRow     { amount: number; purchase_date?: string }
interface GoldHolding { invested_amount: number }
interface ExpenseRow  { amount: number; date: string; category_id: string; category_name: string; category_color: string }
interface SavingsRow  { amount: number; date: string; type: string; description: string }

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading]   = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const refetch = () => setRefreshKey((k) => k + 1);

  // Raw data state
  const [mfData,            setMfData]           = useState<MfRow[]>([]);
  const [stockData,         setStockData]         = useState<StockRow[]>([]);
  const [usData,            setUsData]            = useState<UsRow[]>([]);
  const [cryptoData,        setCryptoData]        = useState<CryptoRow[]>([]);
  const [goldData,          setGoldData]          = useState<GoldRow[]>([]);
  const [goldHoldingsData,  setGoldHoldingsData]  = useState<GoldHolding[]>([]);
  const [allExpenses,       setAllExpenses]       = useState<ExpenseRow[]>([]);
  const [allSavings,        setAllSavings]        = useState<SavingsRow[]>([]);
  const [usdToInr,          setUsdToInr]          = useState(83.5);
  const [prevMonthExpense,  setPrevMonthExpense]  = useState(0);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const base = (col: string) => collection(db, "users", uid, col);

    async function fetchAll() {
      setLoading(true);
      try {
        const [
          mfSnap, stockSnap, usSnap, cryptoSnap, goldSnap,
          goldHoldSnap, settingsSnap, expSnap, savSnap,
        ] = await Promise.all([
          getDocs(base("mf_transactions")),
          getDocs(base("stock_monthly_entries")),
          getDocs(base("us_stock_transactions")),
          getDocs(query(base("crypto_transactions"), orderBy("transaction_date", "desc"))),
          getDocs(base("gold_transactions")),
          getDocs(base("gold_holdings")),
          getDocs(collection(db, "users", uid, "settings")),
          getDocs(query(base("expenses"), orderBy("date", "desc"))).catch(() => null),
          getDocs(query(base("savings"),  orderBy("date", "desc"))).catch(() => null),
        ]);

        const now = new Date();
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;

        const settingsDoc = settingsSnap.docs.find((d) => d.id === "data");
        setUsdToInr(settingsDoc?.data()?.usd_to_inr_rate ?? 83.5);

        setMfData(mfSnap.docs.map((d) => d.data() as MfRow));
        setStockData(stockSnap.docs.map((d) => d.data() as StockRow));
        setUsData(usSnap.docs.map((d) => d.data() as UsRow));
        setCryptoData(cryptoSnap.docs.map((d) => d.data() as CryptoRow));
        setGoldData(goldSnap.docs.map((d) => d.data() as GoldRow));
        setGoldHoldingsData(goldHoldSnap.docs.map((d) => d.data() as GoldHolding));

        if (expSnap) {
          const exps = expSnap.docs.map((d) => d.data() as ExpenseRow);
          setAllExpenses(exps);
          setPrevMonthExpense(
            exps.filter((e) => e.date?.slice(0, 7) === prevKey)
                .reduce((s, e) => s + Number(e.amount), 0)
          );
        }
        if (savSnap) {
          setAllSavings(savSnap.docs.map((d) => d.data() as SavingsRow));
        }
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, refreshKey]);

  // ── Time helpers ──────────────────────────────────────────────────────────
  const now          = useMemo(() => new Date(), []);
  const monthKey     = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const dayOfMonth   = now.getDate();
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthName    = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  // ── Portfolio totals ──────────────────────────────────────────────────────
  const netMf = useMemo(() =>
    mfData.filter(t => t.transaction_type !== "REDEMPTION").reduce((s, t) => s + Number(t.amount), 0) -
    mfData.filter(t => t.transaction_type === "REDEMPTION").reduce((s, t) => s + Number(t.amount), 0),
  [mfData]);

  const latestStock = useMemo(() =>
    stockData.slice().sort((a, b) => (b.month ?? "").localeCompare(a.month ?? ""))[0],
  [stockData]);
  const netStocks = latestStock ? Number(latestStock.invested ?? 0) : 0;

  const netUsUSD = useMemo(() =>
    usData.filter(t => t.side === "buy").reduce((s, t) => s + Math.abs(Number(t.amount ?? 0)), 0) -
    usData.filter(t => t.side === "sell").reduce((s, t) => s + Math.abs(Number(t.amount ?? 0)), 0),
  [usData]);
  const netUsINR = netUsUSD * usdToInr;

  const cryptoTotal = useMemo(() =>
    cryptoData.filter(t => t.trade_type === "BUY").reduce((s, t) => s + Number(t.total_inr ?? 0), 0),
  [cryptoData]);

  const goldTotal = useMemo(() =>
    goldData.reduce((s, t) => s + Number(t.amount), 0) +
    goldHoldingsData.reduce((s, h) => s + Number(h.invested_amount), 0),
  [goldData, goldHoldingsData]);

  const totalPortfolio = netMf + netStocks + netUsINR + cryptoTotal + goldTotal;

  // ── Expense computations ──────────────────────────────────────────────────
  const thisMonthExpenses = useMemo(() =>
    allExpenses.filter(e => e.date?.slice(0, 7) === monthKey),
  [allExpenses, monthKey]);

  const expenseThisMonth = thisMonthExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const expenseCount     = thisMonthExpenses.length;
  const dailyAvg         = dayOfMonth > 0 ? expenseThisMonth / dayOfMonth : 0;
  const projectedExpense = Math.round(dailyAvg * daysInMonth);
  const remainingDays    = daysInMonth - dayOfMonth;
  const expMoMPct        = prevMonthExpense > 0
    ? ((expenseThisMonth - prevMonthExpense) / prevMonthExpense) * 100 : 0;

  // ── Savings / Investment computations (from savings collection) ───────────
  const allInvestments     = useMemo(() => allSavings.filter(s => s.type === "Investment"), [allSavings]);
  const thisMonthInvSavings = useMemo(() =>
    allInvestments.filter(s => s.date?.slice(0, 7) === monthKey),
  [allInvestments, monthKey]);
  const thisMonthInvSavingsTotal = thisMonthInvSavings.reduce((s, r) => s + Number(r.amount), 0);

  // ── This-month invested from asset collections ─────────────────────────────
  const thisMonthAssetInvested = useMemo(() => [
    {
      label: "MF",
      value: mfData
        .filter(t => t.transaction_type !== "REDEMPTION" && t.transaction_date?.slice(0, 7) === monthKey)
        .reduce((s, t) => s + Number(t.amount), 0),
      color: "#8b5cf6",
    },
    {
      label: "Stocks",
      value: stockData.filter(t => t.month === monthKey).reduce((s, t) => s + Number(t.invested ?? 0), 0),
      color: "#10b981",
    },
    {
      label: "Crypto",
      value: cryptoData
        .filter(t => t.trade_type === "BUY" && t.transaction_date?.slice(0, 7) === monthKey)
        .reduce((s, t) => s + Number(t.total_inr ?? 0), 0),
      color: "#f97316",
    },
    {
      label: "Gold",
      value: goldData
        .filter(t => t.purchase_date?.slice(0, 7) === monthKey)
        .reduce((s, t) => s + Number(t.amount), 0),
      color: "#eab308",
    },
    {
      label: "Savings Inv",
      value: thisMonthInvSavingsTotal,
      color: "#38bdf8",
    },
  ].filter(d => d.value > 0), [mfData, stockData, cryptoData, goldData, thisMonthInvSavingsTotal, monthKey]);

  const totalThisMonthInvested = thisMonthAssetInvested.reduce((s, d) => s + d.value, 0);

  // Savings rate = invested / (invested + spent)
  const grandOutflow  = totalThisMonthInvested + expenseThisMonth;
  const savingsRate   = grandOutflow > 0 ? (totalThisMonthInvested / grandOutflow) * 100 : 0;

  // ── Top categories this month ─────────────────────────────────────────────
  const topCats = useMemo(() => {
    const map = new Map<string, { name: string; total: number; color: string }>();
    for (const e of thisMonthExpenses) {
      const ex = map.get(e.category_id) ?? { name: e.category_name, total: 0, color: e.category_color };
      ex.total += Number(e.amount);
      map.set(e.category_id, ex);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [thisMonthExpenses]);

  // ── 6-month expense trend ─────────────────────────────────────────────────
  const sixMonthTrend = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d   = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const lbl = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    const spent    = allExpenses.filter(e => e.date?.slice(0, 7) === key).reduce((s, e) => s + Number(e.amount), 0);
    const invested = allInvestments.filter(s => s.date?.slice(0, 7) === key).reduce((s, r) => s + Number(r.amount), 0);
    return { month: lbl, Spent: Math.round(spent), Invested: Math.round(invested) };
  }), [allExpenses, allInvestments, now]);

  // ── Portfolio allocation pie ───────────────────────────────────────────────
  const allocData = useMemo(() => [
    { name: "MF",       value: Math.round(netMf),       color: "#8b5cf6" },
    { name: "Stocks",   value: Math.round(netStocks),   color: "#10b981" },
    { name: "US Stocks",value: Math.round(netUsINR),    color: "#3b82f6" },
    { name: "Crypto",   value: Math.round(cryptoTotal), color: "#f97316" },
    { name: "Gold",     value: Math.round(goldTotal),   color: "#eab308" },
  ].filter(d => d.value > 0), [netMf, netStocks, netUsINR, cryptoTotal, goldTotal]);

  // ── Smart insights ─────────────────────────────────────────────────────────
  const insights = useMemo(() => {
    const list: { icon: React.ElementType; iconColor: string; iconBg: string; title: string; body: string; accent?: string }[] = [];

    if (savingsRate >= 30) {
      list.push({ icon: Award, iconColor: "text-emerald-400", iconBg: "bg-emerald-500/10",
        title: "Great savings rate!", accent: "border-emerald-500/20 bg-emerald-500/5",
        body: `You're investing ${savingsRate.toFixed(0)}% of total outflow this month. Compounding will reward you!` });
    } else if (savingsRate > 0 && savingsRate < 20) {
      list.push({ icon: Target, iconColor: "text-amber-400", iconBg: "bg-amber-500/10",
        title: "Boost your savings rate",
        body: `Currently at ${savingsRate.toFixed(0)}% investment ratio. Try to reach 20-30% for faster wealth growth.` });
    }
    if (projectedExpense > prevMonthExpense && prevMonthExpense > 0) {
      list.push({ icon: AlertTriangle, iconColor: "text-red-400", iconBg: "bg-red-500/10",
        accent: "border-red-500/20 bg-red-500/5", title: "Spending trending higher",
        body: `Projected ${formatINR(projectedExpense)} this month — ${formatINR(projectedExpense - prevMonthExpense)} more than last month.` });
    } else if (projectedExpense < prevMonthExpense && prevMonthExpense > 0) {
      list.push({ icon: CheckCircle2, iconColor: "text-emerald-400", iconBg: "bg-emerald-500/10",
        accent: "border-emerald-500/20 bg-emerald-500/5", title: "Spending under control",
        body: `On track for ${formatINR(projectedExpense)} — ${formatINR(prevMonthExpense - projectedExpense)} less than last month!` });
    }
    if (totalThisMonthInvested === 0) {
      list.push({ icon: Zap, iconColor: "text-sky-400", iconBg: "bg-sky-500/10",
        title: "No investments this month", body: "Log your investments to track your savings rate and build a complete financial picture." });
    }
    if (totalPortfolio > 0 && netStocks / totalPortfolio > 0.6) {
      list.push({ icon: AlertTriangle, iconColor: "text-amber-400", iconBg: "bg-amber-500/10",
        title: "Portfolio heavily in Stocks", body: `${((netStocks / totalPortfolio) * 100).toFixed(0)}% of your portfolio is in Indian Stocks. Consider diversifying.` });
    }
    return list.slice(0, 4);
  }, [savingsRate, projectedExpense, prevMonthExpense, totalThisMonthInvested, totalPortfolio, netStocks]);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5 md:space-y-7 pb-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Financial Dashboard</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Welcome back, <span className="text-white font-medium">{user?.displayName || user?.email?.split("@")[0]}</span>
          </p>
          <p className="text-gray-500 text-xs mt-0.5">{monthName}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/expenses/dashboard" className="btn-secondary text-xs py-1.5 px-3">
            Expense Analytics ↗
          </Link>
          <Link href="/portfolio-tracker" className="btn-secondary text-xs py-1.5 px-3">
            Portfolio ↗
          </Link>
        </div>
      </div>

      {/* ── Row 1: Portfolio stat cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard
          title="Total Portfolio" value={formatINR(totalPortfolio)}
          subtitle="Net invested across all assets"
          icon={Wallet} iconColor="text-sky-400" iconBg="bg-sky-500/10"
          className="col-span-2 sm:col-span-1"
        />
        <StatCard
          title="Mutual Funds" value={formatINR(netMf)}
          subtitle={`${mfData.length} transactions`}
          icon={BarChart3} iconColor="text-violet-400" iconBg="bg-violet-500/10"
        />
        <StatCard
          title="Indian Stocks" value={formatINR(netStocks)}
          subtitle={`${stockData.length} month${stockData.length !== 1 ? "s" : ""} tracked`}
          icon={TrendingUp} iconColor="text-emerald-400" iconBg="bg-emerald-500/10"
        />
        <StatCard
          title="US Stocks" value={formatUSD(netUsUSD)}
          subtitle={`≈ ${formatINR(netUsINR)}`}
          icon={Globe} iconColor="text-blue-400" iconBg="bg-blue-500/10"
        />
        <StatCard
          title="Crypto" value={formatINR(cryptoTotal)}
          subtitle={`${cryptoData.length} trades`}
          icon={Bitcoin} iconColor="text-orange-400" iconBg="bg-orange-500/10"
        />
        <StatCard
          title="Gold" value={formatINR(goldTotal)}
          subtitle={`${goldData.length + goldHoldingsData.length} records`}
          icon={Gem} iconColor="text-yellow-400" iconBg="bg-yellow-500/10"
        />
        <StatCard
          title="Spent This Month" value={formatINR(expenseThisMonth)}
          subtitle={`${expenseCount} expenses · ${remainingDays}d left`}
          icon={Receipt} iconColor="text-rose-400" iconBg="bg-rose-500/10"
        />
        <StatCard
          title="Savings Rate" value={`${savingsRate.toFixed(1)}%`}
          subtitle={`Invested ${formatINR(totalThisMonthInvested)} of ${formatINR(grandOutflow)}`}
          icon={PiggyBank} iconColor="text-sky-400" iconBg="bg-sky-500/10"
        />
      </div>

      {/* ── Row 2: Portfolio alloc + 6-month trend ─────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">

        {/* Portfolio allocation donut */}
        <div className="glass-card p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Portfolio Allocation</h2>
            <Link href="/portfolio-tracker" className="text-xs text-sky-400 hover:text-sky-300 transition-colors">View →</Link>
          </div>
          {allocData.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-10">No investments yet.</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="h-44 w-full sm:flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={allocData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {allocData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatINR(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 sm:shrink-0 sm:min-w-[110px] w-full sm:w-auto">
                {allocData.map((d) => {
                  const pct = totalPortfolio > 0 ? (d.value / totalPortfolio) * 100 : 0;
                  return (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-gray-400 flex-1">{d.name}</span>
                      <span className="text-gray-200 font-medium">{formatINR(d.value)}</span>
                      <span className="text-gray-600 w-8 text-right">{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
                <div className="pt-2 border-t border-gray-800/60 flex justify-between text-xs">
                  <span className="text-gray-500">Total</span>
                  <span className="text-white font-semibold">{formatINR(totalPortfolio)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 6-month Spent vs Invested trend */}
        <div className="glass-card p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">6-Month Trend</h2>
            <Link href="/expenses/dashboard" className="text-xs text-rose-400 hover:text-rose-300 transition-colors">Details →</Link>
          </div>
          {sixMonthTrend.every(d => d.Spent === 0 && d.Invested === 0) ? (
            <p className="text-gray-500 text-sm text-center py-10">No data yet.</p>
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sixMonthTrend} barGap={3} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} width={42} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Legend formatter={(v) => <span className="text-xs text-gray-400">{v}</span>} iconType="circle" iconSize={7} />
                  <Bar dataKey="Spent"    fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="Invested" fill="#38bdf8" radius={[3, 3, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Invested this month + Expense forecast ──────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">

        {/* Invested this month */}
        <div className="glass-card p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Invested This Month</h2>
            <span className="text-xs text-gray-500">{monthName}</span>
          </div>
          {totalThisMonthInvested === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">No investments this month.</p>
              <p className="text-gray-600 text-xs mt-1">
                Add entries under Savings with type <span className="text-sky-400">Investment</span>,
                or log transactions in MF / Stocks / Crypto / Gold.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {thisMonthAssetInvested.map((d) => {
                const pct = totalThisMonthInvested > 0 ? (d.value / totalThisMonthInvested) * 100 : 0;
                return (
                  <div key={d.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-400">{d.label}</span>
                      <span className="font-medium" style={{ color: d.color }}>{formatINR(d.value)}</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: d.color }} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-gray-800/60">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total invested</span>
                  <span className="text-white font-bold">{formatINR(totalThisMonthInvested)}</span>
                </div>
                {/* Savings rate pill */}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-gray-500">Savings rate</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    savingsRate >= 20 ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
                  }`}>{savingsRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Expense forecast */}
        <div className="glass-card p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Expense Forecast</h2>
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              expMoMPct > 0 ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"
            }`}>
              {expMoMPct > 0
                ? <ArrowUpRight className="w-3 h-3" />
                : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(expMoMPct).toFixed(1)}% vs last month
            </span>
          </div>
          {expenseThisMonth === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No expenses this month yet.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Spent", value: formatINR(expenseThisMonth), color: "text-rose-400" },
                  { label: "Daily avg", value: formatINR(dailyAvg), color: "text-orange-400" },
                  { label: "Projected", value: formatINR(projectedExpense), color: "text-amber-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-gray-800/50 rounded-xl p-2.5 text-center">
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <p className={`text-xs font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Day {dayOfMonth} of {daysInMonth}</span>
                  <span>{remainingDays} days left</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div className="h-2 rounded-full bg-rose-500 transition-all" style={{ width: `${(dayOfMonth / daysInMonth) * 100}%` }} />
                </div>
              </div>
              {prevMonthExpense > 0 && (
                <p className="text-xs text-gray-400">
                  Last month: <span className="text-white font-medium">{formatINR(prevMonthExpense)}</span>.{" "}
                  On track to spend{" "}
                  <span className={`font-medium ${projectedExpense > prevMonthExpense ? "text-red-400" : "text-emerald-400"}`}>
                    {projectedExpense > prevMonthExpense ? "more" : "less"}
                  </span>.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 4: Invest vs Spend + Top categories ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">

        {/* Invest vs Spend */}
        <div className="glass-card p-4 md:p-5">
          <h2 className="text-sm font-semibold text-white mb-4">
            Invest vs Spend — <span className="text-gray-400 font-normal">{monthName}</span>
          </h2>
          {totalThisMonthInvested === 0 && expenseThisMonth === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No activity this month.</p>
          ) : (
            <div className="space-y-4">
              {[
                {
                  label: "Invested", amount: totalThisMonthInvested,
                  pct: grandOutflow > 0 ? (totalThisMonthInvested / grandOutflow) * 100 : 0,
                  barColor: "bg-sky-500", textColor: "text-sky-400",
                },
                {
                  label: "Spent", amount: expenseThisMonth,
                  pct: grandOutflow > 0 ? (expenseThisMonth / grandOutflow) * 100 : 0,
                  barColor: "bg-rose-500", textColor: "text-rose-400",
                },
              ].map(({ label, amount, pct, barColor, textColor }) => (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className={`${textColor} font-medium`}>{label}</span>
                    <span className={`${textColor}`}>{formatINR(amount)} <span className="text-gray-600 text-xs">({pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2.5">
                    <div className={`h-2.5 rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-800/60 flex justify-between text-sm">
                <span className="text-gray-500">Total outflow</span>
                <span className="text-white font-semibold">{formatINR(grandOutflow)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Top spend categories */}
        <div className="glass-card p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Top Spend Categories</h2>
            <Link href="/expenses" className="text-xs text-rose-400 hover:text-rose-300 transition-colors">View all →</Link>
          </div>
          {topCats.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No expenses this month.</p>
          ) : (
            <div className="space-y-3">
              {topCats.map((cat, idx) => {
                const pct = expenseThisMonth > 0 ? (cat.total / expenseThisMonth) * 100 : 0;
                return (
                  <div key={cat.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300 font-medium truncate flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                        {cat.name}
                      </span>
                      <span className="text-gray-400 shrink-0 ml-2">{formatINR(cat.total)}</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-gray-800/60 flex justify-between text-xs">
                <span className="text-gray-500">Total spent</span>
                <span className="text-rose-400 font-medium">{formatINR(expenseThisMonth)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 5: Savings entries this month + Smart Insights ─────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">

        {/* Investment entries from savings */}
        <div className="glass-card p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Investment Entries — {monthName}</h2>
            <Link href="/expenses" className="text-xs text-sky-400 hover:text-sky-300 transition-colors">Add →</Link>
          </div>
          {thisMonthInvSavings.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-500 text-sm">No investment entries this month.</p>
              <p className="text-gray-600 text-xs mt-1">Go to Expenses → Savings and add with type <span className="text-sky-400">Investment</span>.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {thisMonthInvSavings.map((r, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-800/40">
                  <div className="min-w-0 mr-3">
                    <p className="text-sm text-gray-200 font-medium truncate">{r.description}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </p>
                  </div>
                  <span className="text-sky-400 font-semibold text-sm shrink-0">{formatINR(Number(r.amount))}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-800/60 flex justify-between text-sm">
                <span className="text-gray-500">Total</span>
                <span className="text-sky-400 font-bold">{formatINR(thisMonthInvSavingsTotal)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Smart insights */}
        <div className="glass-card p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Smart Insights</h2>
            <Lightbulb className="w-4 h-4 text-amber-400" />
          </div>
          {insights.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">Add more data to unlock personalised insights.</p>
          ) : (
            <div className="space-y-2.5">
              {insights.map((ins, idx) => (
                <InsightCard key={idx} {...ins} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile FAB — Quick Add Expense ─────────────────────────────────── */}
      <div className="sm:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <ExpenseAddModal fab onAdded={refetch} />
      </div>
    </div>
  );
}
