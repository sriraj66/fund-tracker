"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/utils";
import StatCard from "@/components/StatCard";
import ExchangeRateSettings from "@/components/ExchangeRateSettings";
import { Wallet, TrendingUp, TrendingDown, PieChart, ExternalLink } from "lucide-react";
import TrackerAnalysis from "./TrackerAnalysis";
import TrackerInsights from "./TrackerInsights";
import MonthlyStats from "./MonthlyStats";
import { MonthlyChangeTable, monthlyFromSeries } from "./MonthlyChange";
import {
  type Currency, type PortfolioSnapshot, type TrackerAssetKey,
  analyse, buildSeries, moneyFmt, sliceByMonths,
} from "@/lib/trackerAnalytics";

const TIME_FRAMES = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "All", months: 0 },
];
const PAGE_SIZE = 10;

interface Props {
  asset: TrackerAssetKey;
  title: string;
  subtitle: string;
  label: string;            // plural noun used in insights, e.g. "US stocks"
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  usdToggle?: boolean;      // values are INR in the tracker; offer a USD view
  children?: ReactNode;     // asset-specific analysis, rendered after the trend charts
  actions?: ReactNode;      // extra header buttons, shown before the Portfolio Tracker link
  monthly?: boolean;        // show Monthly Investment chart + change table built from tracker snapshots
}

function PaginationBar({ page, totalPages, total, onPage }: {
  page: number; totalPages: number; total: number; onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const nav = "px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors";
  return (
    <div className="px-4 py-3 md:px-6 border-t border-gray-800/60 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
      <div className="flex items-center gap-1 flex-wrap justify-center order-1 sm:order-2">
        <button onClick={() => onPage(1)} disabled={page === 1} className={nav}>«</button>
        <button onClick={() => onPage(page - 1)} disabled={page === 1} className={nav}>‹ Prev</button>
        <span className="text-xs text-gray-500 px-2">{page} / {totalPages}</span>
        <button onClick={() => onPage(page + 1)} disabled={page === totalPages} className={nav}>Next ›</button>
        <button onClick={() => onPage(totalPages)} disabled={page === totalPages} className={nav}>»</button>
      </div>
      <p className="text-xs text-gray-500 order-2 sm:order-1">
        Showing <span className="text-gray-300 font-medium">{from}–{to}</span> of{" "}
        <span className="text-gray-300 font-medium">{total}</span> snapshots
      </p>
    </div>
  );
}

const signed = (n: number, f: (x: number) => string) => `${n >= 0 ? "+" : "-"}${f(Math.abs(n))}`;
const tone = (n: number) => (n >= 0 ? "text-emerald-400" : "text-red-400");

export default function TrackerSection({
  asset, title, subtitle, label, icon, iconColor, iconBg, usdToggle = false, children, actions, monthly = true,
}: Props) {
  const { user } = useAuth();
  const [snaps, setSnaps] = useState<PortfolioSnapshot[]>([]);
  const [usdToInr, setUsdToInr] = useState(83.5);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<Currency>(usdToggle ? "USD" : "INR");
  const [timeFrame, setTimeFrame] = useState("All");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const [snap, settingsSnap] = await Promise.all([
          getDocs(query(collection(db, "users", user.uid, "portfolio_snapshots"), orderBy("snapshot_date", "asc"))),
          getDocs(collection(db, "users", user.uid, "settings")),
        ]);
        setSnaps(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PortfolioSnapshot)));
        setUsdToInr(settingsSnap.docs.find((d) => d.id === "data")?.data()?.usd_to_inr_rate ?? 83.5);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const fullSeries = useMemo(() => buildSeries(snaps, asset, usdToInr, currency), [snaps, asset, usdToInr, currency]);
  const months = TIME_FRAMES.find((t) => t.label === timeFrame)!.months;
  const series = useMemo(() => sliceByMonths(fullSeries, months), [fullSeries, months]);
  const analysis = useMemo(() => analyse(series), [series]);
  const monthlyEntries = useMemo(() => monthlyFromSeries(fullSeries), [fullSeries]);

  const table = useMemo(() => [...series].reverse(), [series]);
  const totalPages = Math.max(1, Math.ceil(table.length / PAGE_SIZE));
  const paged = useMemo(() => table.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [table, page]);

  useEffect(() => { setPage(1); }, [timeFrame, currency]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const fmt = moneyFmt(currency);
  const latest = fullSeries[fullSeries.length - 1];
  const Icon = icon;

  const segBtn = (active: boolean) =>
    `flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${active ? "bg-sky-600 text-white" : "text-gray-400 hover:text-white"}`;

  return (
    <div className="space-y-6 sm:space-y-8 pb-6">
      <div className="page-header">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">{title}</h1>
          <div className="text-gray-400 text-sm mt-1 flex flex-wrap items-center gap-2">
            <span>{subtitle}</span>
            {usdToggle && (
              <>
                <span className="text-gray-600">•</span>
                <ExchangeRateSettings currentRate={usdToInr} />
              </>
            )}
          </div>
        </div>
        <div className="page-header-actions">
          {usdToggle && (
            <div className="flex items-center gap-1 bg-gray-800/60 rounded-lg p-1">
              {(["USD", "INR"] as Currency[]).map((c) => (
                <button key={c} onClick={() => setCurrency(c)} className={segBtn(currency === c)}>{c}</button>
              ))}
            </div>
          )}
          {actions}
          <Link
            href="/portfolio-tracker"
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-all border border-gray-700/60"
          >
            Portfolio Tracker
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {!latest ? (
        <>
          <div className="glass-card px-6 py-14 text-center">
            <div className={`w-12 h-12 rounded-full ${iconBg} flex items-center justify-center mx-auto mb-3`}>
              <Icon className={`w-6 h-6 ${iconColor}`} />
            </div>
            <p className="text-gray-400 text-sm font-medium">No {label} values in your Portfolio Tracker yet</p>
            <p className="text-gray-500 text-xs mt-1">
              Add a snapshot with {label} invested and current values in{" "}
              <Link href="/portfolio-tracker" className="text-sky-400 hover:underline">Portfolio Tracker</Link>.
            </p>
          </div>
          {children}
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              title="Total Invested" value={fmt(latest.invested)}
              subtitle={`As of ${formatDate(latest.date)}`}
              icon={Wallet} iconColor="text-blue-400" iconBg="bg-blue-500/10"
            />
            <StatCard
              title="Current Value" value={fmt(latest.value)}
              subtitle={`${formatDate(latest.date)} snapshot`}
              icon={icon} iconColor={iconColor} iconBg={iconBg}
            />
            <StatCard
              title="Unrealised P&L" value={signed(latest.pnl, fmt)}
              subtitle={`${latest.ret >= 0 ? "+" : ""}${latest.ret.toFixed(2)}% return`}
              icon={latest.pnl >= 0 ? TrendingUp : TrendingDown}
              iconColor={latest.pnl >= 0 ? "text-emerald-400" : "text-red-400"}
              iconBg={latest.pnl >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}
            />
            <StatCard
              title="Portfolio Share" value={latest.share === null ? "—" : `${latest.share.toFixed(1)}%`}
              subtitle="of total portfolio value"
              icon={PieChart} iconColor="text-violet-400" iconBg="bg-violet-500/10"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-white">Trend Analysis</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {currency === "USD" && usdToggle ? `Converted from INR at ₹${usdToInr}/USD` : "Synced from Portfolio Tracker snapshots"}
                {" • "}{series.length} snapshot{series.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-1 bg-gray-800/60 rounded-lg p-1 w-full sm:w-auto">
              {TIME_FRAMES.map((t) => (
                <button key={t.label} onClick={() => setTimeFrame(t.label)} className={segBtn(timeFrame === t.label)}>{t.label}</button>
              ))}
            </div>
          </div>

          <TrackerAnalysis title={title} series={series} analysis={analysis} currency={currency} />

          {children}

          {monthly && (
            <>
              <MonthlyStats entries={monthlyEntries} label={label} currency={currency} />
              <MonthlyChangeTable entries={monthlyEntries} label={label} currency={currency} />
            </>
          )}

          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-800/60">
              <h2 className="text-base font-semibold text-white">Snapshot History</h2>
              <p className="text-xs text-gray-500 mt-0.5">Values from each Portfolio Tracker snapshot</p>
            </div>

            <div className="hidden sm:block overflow-x-auto">
              <table className="data-table min-w-[760px]">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="text-right">Invested</th>
                    <th className="text-right">Current</th>
                    <th className="text-right">P&amp;L</th>
                    <th className="text-right">Return</th>
                    <th className="text-right">New Money</th>
                    <th className="text-right">Market Gain</th>
                    <th className="text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium text-gray-200">{formatDate(p.date)}</td>
                      <td className="text-right text-gray-300">{fmt(p.invested)}</td>
                      <td className="text-right text-blue-400 font-medium">{fmt(p.value)}</td>
                      <td className={`text-right font-medium ${tone(p.pnl)}`}>{signed(p.pnl, fmt)}</td>
                      <td className={`text-right ${tone(p.ret)}`}>{p.ret >= 0 ? "+" : ""}{p.ret.toFixed(2)}%</td>
                      <td className="text-right text-gray-400">{p.dInvested === 0 ? "—" : signed(p.dInvested, fmt)}</td>
                      <td className={`text-right ${p.periodRet === null ? "text-gray-600" : tone(p.marketGain)}`}>
                        {p.periodRet === null ? "—" : signed(p.marketGain, fmt)}
                      </td>
                      <td className="text-right text-gray-400">{p.share === null ? "—" : `${p.share.toFixed(1)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sm:hidden divide-y divide-gray-800/60">
              {paged.map((p) => (
                <div key={p.id} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{formatDate(p.date)}</p>
                    <p className={`text-xs font-medium ${tone(p.pnl)}`}>
                      {signed(p.pnl, fmt)} ({p.ret >= 0 ? "+" : ""}{p.ret.toFixed(2)}%)
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="text-gray-400">Inv: <span className="text-gray-200 font-medium">{fmt(p.invested)}</span></span>
                    <span className="text-gray-400">Cur: <span className="text-blue-400 font-medium">{fmt(p.value)}</span></span>
                    {p.share !== null && <span className="text-gray-400">Share: <span className="text-gray-200 font-medium">{p.share.toFixed(1)}%</span></span>}
                  </div>
                  {p.periodRet !== null && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span className="text-gray-400">New money: <span className="text-gray-200">{p.dInvested === 0 ? "—" : signed(p.dInvested, fmt)}</span></span>
                      <span className="text-gray-400">Market: <span className={tone(p.marketGain)}>{signed(p.marketGain, fmt)}</span></span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <PaginationBar page={page} totalPages={totalPages} total={table.length} onPage={setPage} />
          </div>

          <TrackerInsights label={label} series={series} analysis={analysis} currency={currency} />
        </>
      )}
    </div>
  );
}
