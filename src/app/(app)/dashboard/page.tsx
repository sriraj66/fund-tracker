"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import StatCard from "@/components/StatCard";
import {
  BarChart3, TrendingUp, Globe, Bitcoin, Gem, Wallet, Receipt,
  TrendingDown, ArrowUpRight, ArrowDownRight, Lightbulb, Target,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { formatINR, formatUSD } from "@/lib/utils";
import Link from "next/link";

const CHART_COLORS = ["#8b5cf6","#10b981","#3b82f6","#f97316","#eab308","#f43f5e","#06b6d4","#a855f7"];

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: {value:number;name:string;fill:string}[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      {label && <p className="text-white font-semibold mb-1">{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.fill }} className="font-medium">{p.name}</span>
          <span className="text-gray-200">{formatINR(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

interface DashboardData {
  usdToInr: number;
  mfData: { amount: number; transaction_type: string; transaction_date?: string }[];
  stockData: { value: number; transaction_type: string; execution_date?: string }[];
  usData: { amount: number; side: string; transaction_date?: string }[];
  cryptoData: { total_inr: number; trade_type: string; transaction_date?: string }[];
  goldData: { amount: number; purchase_date?: string }[];
  goldHoldingsData: { invested_amount: number }[];
  allExpenses: { amount: number; date: string; category_id: string; category_name: string; category_color: string }[];
  prevMonthExpense: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [expenseThisMonth, setExpenseThisMonth] = useState<number>(0);
  const [expenseCount, setExpenseCount] = useState<number>(0);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

    async function fetchAll() {
      try {
        const base = (col: string) => collection(db, "users", uid, col);

        const [mfSnap, stockSnap, usSnap, cryptoSnap, goldSnap, goldHoldingsSnap, settingsSnap] = await Promise.all([
          getDocs(base("mf_transactions")),
          getDocs(base("stock_transactions")),
          getDocs(base("us_stock_transactions")),
          getDocs(query(base("crypto_transactions"), orderBy("transaction_date", "desc"))),
          getDocs(base("gold_transactions")),
          getDocs(base("gold_holdings")),
          getDocs(collection(db, "users", uid, "settings")),
        ]);

        // Fetch all expenses + categories
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;

        try {
          const [expSnap, catSnap] = await Promise.all([
            getDocs(query(base("expenses"), orderBy("date", "desc"))),
            getDocs(base("expense_categories")),
          ]);
          const allExp = expSnap.docs.map((d) => d.data() as { amount: number; date: string; category_id: string; category_name: string; category_color: string });
          const cats = Object.fromEntries(catSnap.docs.map(d => [d.id, d.data() as { name: string; color: string; budget_limit?: number }]));

          const thisMonthExp = allExp.filter((e) => e.date?.slice(0, 7) === monthKey);
          const prevMonthExp = allExp.filter((e) => e.date?.slice(0, 7) === prevMonthKey);

          setExpenseThisMonth(thisMonthExp.reduce((s, e) => s + Number(e.amount), 0));
          setExpenseCount(thisMonthExp.length);

          setData((prev) => ({
            ...(prev ?? {
              usdToInr: 83.5, mfData: [], stockData: [], usData: [], cryptoData: [], goldData: [], goldHoldingsData: [],
              allExpenses: [], expCategories: {}, prevMonthExpense: 0, thisMonthExp: [],
            }),
            allExpenses: allExp,
            expCategories: cats,
            prevMonthExpense: prevMonthExp.reduce((s, e) => s + Number(e.amount), 0),
            thisMonthExp,
          }));
        } catch { /* expenses may not exist */ }

        const settingsDoc = settingsSnap.docs.find((d) => d.id === "data");
        const usdToInr = settingsDoc?.data()?.usd_to_inr_rate ?? 83.50;

        setData((prev) => ({
          ...(prev ?? {}),
          usdToInr,
          mfData: mfSnap.docs.map((d) => d.data() as { amount: number; transaction_type: string; transaction_date: string }),
          stockData: stockSnap.docs.map((d) => d.data() as { value: number; transaction_type: string; execution_date?: string }),
          usData: usSnap.docs.map((d) => d.data() as { amount: number; side: string; transaction_date: string }),
          cryptoData: cryptoSnap.docs.map((d) => d.data() as { total_inr: number; trade_type: string; transaction_date: string }),
          goldData: goldSnap.docs.map((d) => d.data() as { amount: number; purchase_date: string }),
          goldHoldingsData: goldHoldingsSnap.docs.map((d) => d.data() as { invested_amount: number }),
        } as typeof data));
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [user]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!data) return null;

  const { usdToInr, mfData, stockData, usData, cryptoData, goldData, goldHoldingsData, allExpenses, prevMonthExpense } = data;

  // ── Portfolio totals ──────────────────────────────────────────────────
  const netMf      = mfData.filter(t => t.transaction_type !== "REDEMPTION").reduce((s,t) => s+Number(t.amount),0)
                   - mfData.filter(t => t.transaction_type === "REDEMPTION").reduce((s,t) => s+Number(t.amount),0);
  const netStocks  = stockData.filter(t => t.transaction_type==="BUY").reduce((s,t) => s+Number(t.value),0)
                   - stockData.filter(t => t.transaction_type==="SELL").reduce((s,t) => s+Number(t.value),0);
  const netUsUSD   = usData.filter(t => t.side==="buy").reduce((s,t) => s+Math.abs(Number(t.amount??0)),0)
                   - usData.filter(t => t.side==="sell").reduce((s,t) => s+Math.abs(Number(t.amount??0)),0);
  const netUsINR   = netUsUSD * usdToInr;
  const cryptoTotal= cryptoData.filter(t => t.trade_type==="BUY").reduce((s,t) => s+Number(t.total_inr??0),0);
  const goldTotal  = goldData.reduce((s,t) => s+Number(t.amount),0)
                   + goldHoldingsData.reduce((s,h) => s+Number(h.invested_amount),0);
  const totalINR   = netMf + netStocks + netUsINR + cryptoTotal + goldTotal;

  // ── Expense & time computations ────────────────────────────────────────
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const dailyAvg = dayOfMonth > 0 ? expenseThisMonth / dayOfMonth : 0;
  const projectedExpense = Math.round(dailyAvg * daysInMonth);
  const remainingDays = daysInMonth - dayOfMonth;

  // Month-over-month expense change
  const expMoMPct = prevMonthExpense > 0 ? ((expenseThisMonth - prevMonthExpense) / prevMonthExpense) * 100 : 0;
  const expUp = expMoMPct > 0;

  // Top expense categories this month
  const thisMoExp = allExpenses.filter(e => e.date?.slice(0,7) === monthKey);
  const catTotals = new Map<string, {name:string; total:number; color:string}>();
  for (const e of thisMoExp) {
    const ex = catTotals.get(e.category_id) ?? {name: e.category_name, total:0, color: e.category_color};
    ex.total += Number(e.amount);
    catTotals.set(e.category_id, ex);
  }
  const topCats = Array.from(catTotals.values()).sort((a,b) => b.total-a.total).slice(0,5);

  // Last 6 months expense trend
  const expTrend = Array.from({length:6}, (_,i) => {
    const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const label = d.toLocaleDateString("en-IN",{month:"short",year:"2-digit"});
    const total = allExpenses.filter(e => e.date?.slice(0,7)===k).reduce((s,e) => s+Number(e.amount),0);
    return {month: label, Spent: Math.round(total)};
  });

  // Portfolio allocation pie data
  const allocData = [
    {name:"MF", value: Math.round(netMf), color:"#8b5cf6"},
    {name:"Stocks", value: Math.round(netStocks), color:"#10b981"},
    {name:"US Stocks", value: Math.round(netUsINR), color:"#3b82f6"},
    {name:"Crypto", value: Math.round(cryptoTotal), color:"#f97316"},
    {name:"Gold", value: Math.round(goldTotal), color:"#eab308"},
  ].filter(d => d.value > 0);

  // Investment breakdown this month (all transactions with dates this month)
  const thisMonthInvested = [
    {label:"MF", value: mfData.filter(t => t.transaction_type!=="REDEMPTION" && t.transaction_date?.slice(0,7)===monthKey).reduce((s,t)=>s+Number(t.amount),0), color:"#8b5cf6"},
    {label:"Stocks", value: stockData.filter(t => t.transaction_type==="BUY" && t.execution_date?.slice(0,7)===monthKey).reduce((s,t)=>s+Number(t.value),0), color:"#10b981"},
    {label:"Crypto", value: cryptoData.filter(t => t.trade_type==="BUY" && t.transaction_date?.slice(0,7)===monthKey).reduce((s,t)=>s+Number(t.total_inr??0),0), color:"#f97316"},
    {label:"Gold", value: goldData.filter(t => t.purchase_date?.slice(0,7)===monthKey).reduce((s,t)=>s+Number(t.amount),0), color:"#eab308"},
  ].filter(d => d.value > 0);

  const totalThisMonthInvested = thisMonthInvested.reduce((s,d) => s+d.value, 0);
  const monthName = now.toLocaleDateString("en-IN", {month:"long", year:"numeric"});

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Financial Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Welcome back, {user?.displayName || user?.email?.split("@")[0]} — {monthName}</p>
        </div>
        <Link href="/expenses/dashboard" className="shrink-0 btn-secondary text-xs py-1.5 px-3">
          Expense Analytics ↗
        </Link>
      </div>

      {/* ── Row 1: Portfolio stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Total Portfolio" value={formatINR(totalINR)} subtitle="Net invested across all assets" icon={Wallet} iconColor="text-sky-400" iconBg="bg-sky-500/10" className="col-span-2 md:col-span-1" />
        <StatCard title="Mutual Funds"   value={formatINR(netMf)}      subtitle={`${mfData.length} transactions`} icon={BarChart3}   iconColor="text-violet-400"  iconBg="bg-violet-500/10" />
        <StatCard title="Indian Stocks"  value={formatINR(netStocks)}  subtitle={`${stockData.length} orders`}    icon={TrendingUp}  iconColor="text-emerald-400" iconBg="bg-emerald-500/10" />
        <StatCard title="US Stocks"      value={formatUSD(netUsUSD)}   subtitle={`≈ ${formatINR(netUsINR)}`}      icon={Globe}       iconColor="text-blue-400"    iconBg="bg-blue-500/10" />
        <StatCard title="Crypto"         value={formatINR(cryptoTotal)} subtitle={`${cryptoData.length} trades`}  icon={Bitcoin}     iconColor="text-orange-400"  iconBg="bg-orange-500/10" />
        <StatCard title="Gold"           value={formatINR(goldTotal)}  subtitle={`${goldData.length + goldHoldingsData.length} records`} icon={Gem} iconColor="text-yellow-400" iconBg="bg-yellow-500/10" />
        <StatCard title="Spent This Month" value={formatINR(expenseThisMonth)} subtitle={`${expenseCount} expenses`} icon={Receipt} iconColor="text-rose-400" iconBg="bg-rose-500/10" />
      </div>

      {/* ── Row 2: This month snapshot + Expense prediction ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Invested this month */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Invested This Month</h2>
            <span className="text-xs text-gray-500">{monthName}</span>
          </div>
          {totalThisMonthInvested === 0 ? (
            <p className="text-gray-500 text-sm">No investments recorded this month.</p>
          ) : (
            <div className="space-y-3">
              {thisMonthInvested.map((d) => {
                const pct = totalThisMonthInvested > 0 ? (d.value / totalThisMonthInvested) * 100 : 0;
                return (
                  <div key={d.label}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-400">{d.label}</span>
                      <span className="text-gray-200 font-medium">{formatINR(d.value)}</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full transition-all" style={{width:`${pct}%`, backgroundColor:d.color}} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-gray-800/60 flex justify-between text-sm">
                <span className="text-gray-500">Total invested</span>
                <span className="text-white font-semibold">{formatINR(totalThisMonthInvested)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Expense prediction */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Expense Forecast</h2>
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${expUp ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"}`}>
              {expUp ? <ArrowUpRight className="w-3 h-3"/> : <ArrowDownRight className="w-3 h-3"/>}
              {Math.abs(expMoMPct).toFixed(1)}% vs last month
            </span>
          </div>
          {expenseThisMonth === 0 ? (
            <p className="text-gray-500 text-sm">No expenses this month yet.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800/50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Spent so far</p>
                  <p className="text-sm font-bold text-rose-400">{formatINR(expenseThisMonth)}</p>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Daily avg</p>
                  <p className="text-sm font-bold text-orange-400">{formatINR(dailyAvg)}</p>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Projected</p>
                  <p className="text-sm font-bold text-amber-400">{formatINR(projectedExpense)}</p>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                  <span>Day {dayOfMonth} of {daysInMonth}</span>
                  <span>{remainingDays} days left</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div className="h-2 rounded-full bg-rose-500 transition-all" style={{width:`${(dayOfMonth/daysInMonth)*100}%`}} />
                </div>
              </div>
              {prevMonthExpense > 0 && (
                <p className="text-xs text-gray-400">
                  Last month you spent <span className="text-white font-medium">{formatINR(prevMonthExpense)}</span>.
                  You are on track to spend{" "}
                  <span className={`font-medium ${projectedExpense > prevMonthExpense ? "text-red-400" : "text-emerald-400"}`}>
                    {projectedExpense > prevMonthExpense ? "more" : "less"}
                  </span> this month.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Portfolio pie + Expense trend ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Portfolio allocation donut */}
        <div className="glass-card p-5">
          <h2 className="text-base font-semibold text-white mb-4">Portfolio Allocation</h2>
          {allocData.length === 0 ? (
            <p className="text-gray-500 text-sm">No investments yet.</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="h-44 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={allocData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {allocData.map((d,i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatINR(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 shrink-0 min-w-[90px]">
                {allocData.map((d) => {
                  const pct = totalINR > 0 ? (d.value/totalINR)*100 : 0;
                  return (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor:d.color}} />
                      <span className="text-gray-400">{d.name}</span>
                      <span className="text-gray-200 ml-auto">{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 6-month expense trend */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">6-Month Expense Trend</h2>
            <Link href="/expenses" className="text-xs text-rose-400 hover:text-rose-300 transition-colors">View all →</Link>
          </div>
          {expTrend.every(d => d.Spent === 0) ? (
            <p className="text-gray-500 text-sm text-center py-8">No expense history yet.</p>
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expTrend} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="month" tick={{fill:"#9ca3af",fontSize:10}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:"#9ca3af",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} width={40} />
                  <Tooltip content={<ChartTooltip />} cursor={{fill:"rgba(255,255,255,0.04)"}} />
                  <Bar dataKey="Spent" fill="#f43f5e" radius={[3,3,0,0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 4: Top expense categories + Investment vs Expense ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Top expense categories */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Top Spend Categories</h2>
            <span className="text-xs text-gray-500">{monthName}</span>
          </div>
          {topCats.length === 0 ? (
            <p className="text-gray-500 text-sm">No expenses this month.</p>
          ) : (
            <div className="space-y-3">
              {topCats.map((cat) => {
                const pct = expenseThisMonth > 0 ? (cat.total/expenseThisMonth)*100 : 0;
                return (
                  <div key={cat.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300 font-medium truncate">{cat.name}</span>
                      <span className="text-gray-400 shrink-0 ml-2">{formatINR(cat.total)} <span className="text-gray-600">({pct.toFixed(0)}%)</span></span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-rose-500/70 transition-all" style={{width:`${pct}%`}} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Invest vs Spend this month */}
        <div className="glass-card p-5">
          <h2 className="text-base font-semibold text-white mb-4">Invest vs Spend — {monthName}</h2>
          {totalThisMonthInvested === 0 && expenseThisMonth === 0 ? (
            <p className="text-gray-500 text-sm">No activity recorded this month.</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-emerald-400 font-medium">Invested</span>
                    <span className="text-emerald-400">{formatINR(totalThisMonthInvested)}</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2.5">
                    <div className="h-2.5 rounded-full bg-emerald-500 transition-all" style={{width:`${totalThisMonthInvested > 0 || expenseThisMonth > 0 ? (totalThisMonthInvested/(totalThisMonthInvested+expenseThisMonth))*100 : 0}%`}} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-rose-400 font-medium">Spent</span>
                    <span className="text-rose-400">{formatINR(expenseThisMonth)}</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2.5">
                    <div className="h-2.5 rounded-full bg-rose-500 transition-all" style={{width:`${totalThisMonthInvested > 0 || expenseThisMonth > 0 ? (expenseThisMonth/(totalThisMonthInvested+expenseThisMonth))*100 : 0}%`}} />
                  </div>
                </div>
              </div>
              {totalThisMonthInvested > 0 && expenseThisMonth > 0 && (
                <div className="p-3 bg-gray-800/50 rounded-xl text-sm">
                  <span className="text-gray-400">Investment ratio: </span>
                  <span className="text-white font-semibold">{((totalThisMonthInvested/(totalThisMonthInvested+expenseThisMonth))*100).toFixed(0)}%</span>
                  <span className="text-gray-400"> of total outflow</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 5: Quick navigation ── */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Access</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {[
            {href:"/mutual-funds",  label:"Mutual Funds",  color:"bg-violet-500/10 text-violet-400",  icon:"📊"},
            {href:"/stocks",        label:"Indian Stocks", color:"bg-emerald-500/10 text-emerald-400", icon:"📈"},
            {href:"/us-stocks",     label:"US Stocks",     color:"bg-blue-500/10 text-blue-400",       icon:"🌐"},
            {href:"/crypto",        label:"Crypto",        color:"bg-orange-500/10 text-orange-400",   icon:"₿"},
            {href:"/gold",          label:"Gold",          color:"bg-yellow-500/10 text-yellow-400",   icon:"🥇"},
            {href:"/expenses",      label:"Expenses",      color:"bg-rose-500/10 text-rose-400",       icon:"💳"},
          ].map(l => (
            <Link key={l.href} href={l.href} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl ${l.color} hover:opacity-80 transition-opacity text-center`}>
              <span className="text-lg">{l.icon}</span>
              <span className="text-xs font-medium">{l.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
