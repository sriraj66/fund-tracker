"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { formatINR } from "@/lib/utils";
import StatCard from "@/components/StatCard";
import {
  TrendingUp, TrendingDown, Wallet, Upload, X,
  Loader2, Calendar, ChevronLeft, ChevronRight,
} from "lucide-react";
import StockAddEntryModal from "./StockAddEntryModal";
import StockMonthlyStats from "./StockMonthlyStats";
import DeleteButton from "@/components/DeleteButton";

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface MonthlyEntry {
  id:             string;
  month:          string;       // "YYYY-MM"
  month_label:    string;       // "Sep 2026"
  invested:       number;       // total cost basis
  current_value:  number;       // closing value from the statement
  pnl:            number;       // unrealised P&L
  pnl_pct:        number;       // % return
  statement_date?: string;      // "DD-MM-YYYY" as printed on statement
  updated_at?:    string;
}

/* ─── Pagination ─────────────────────────────────────────────────────────── */
function PaginationBar({
  page, totalPages, total, pageSize, label, onPage,
}: {
  page: number; totalPages: number; total: number; pageSize: number;
  label: string; onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);
  const nums = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || (p >= page - 2 && p <= page + 2))
    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
      acc.push(p);
      return acc;
    }, []);
  return (
    <div className="px-4 py-3 md:px-6 border-t border-gray-800/60 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
      <div className="flex items-center gap-1 flex-wrap justify-center order-1 sm:order-2">
        <button onClick={() => onPage(1)} disabled={page === 1} className="px-2 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed">«</button>
        <button onClick={() => onPage(page - 1)} disabled={page === 1} className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed">‹ Prev</button>
        {nums.map((item, idx) =>
          item === "..." ? (
            <span key={`e${idx}`} className="hidden sm:inline px-2 py-1 text-xs text-gray-600">…</span>
          ) : (
            <button key={item} onClick={() => onPage(item as number)}
              className={`hidden sm:inline-flex px-3 py-1.5 rounded text-xs font-medium transition-colors ${page === item ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>
              {item}
            </button>
          )
        )}
        <span className="sm:hidden text-xs text-gray-500 px-2">{page} / {totalPages}</span>
        <button onClick={() => onPage(page + 1)} disabled={page === totalPages} className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed">Next ›</button>
        <button onClick={() => onPage(totalPages)} disabled={page === totalPages} className="px-2 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed">»</button>
      </div>
      <p className="text-xs text-gray-500 order-2 sm:order-1">
        Showing <span className="text-gray-300 font-medium">{from}–{to}</span> of{" "}
        <span className="text-gray-300 font-medium">{total}</span> {label}
      </p>
    </div>
  );
}

/* ─── Month Picker (prev / next navigator) ───────────────────────────────── */
function MonthPicker({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  const [yyyy, mm] = value.split("-").map(Number);

  const prev = () => {
    const d = new Date(yyyy, mm - 2, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const next = () => {
    const d = new Date(yyyy, mm, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const label = new Date(yyyy, mm - 1, 1).toLocaleDateString("en-IN", {
    month: "long", year: "numeric",
  });

  return (
    <div className="flex items-center gap-1">
      <button onClick={prev} className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <input
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-sm font-medium text-white text-center cursor-pointer
                   [color-scheme:dark] focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded px-1"
      />
      <span className="sr-only">{label}</span>
      <button onClick={next} className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ─── Import Result shape ────────────────────────────────────────────────── */
interface ImportResult {
  month_label:   string;
  invested:      number;
  current_value: number;
  pnl:           number;
  pnl_pct:       number;
  message:       string;
}

/* ─── Holdings Import Button ─────────────────────────────────────────────── */
function HoldingsImportButton({ onSuccess }: { onSuccess: () => void }) {
  const { user }  = useAuth();
  const inputRef  = useRef<HTMLInputElement>(null);
  const panelRef  = useRef<HTMLDivElement>(null);

  const thisMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const [showPanel,    setShowPanel]    = useState(false);
  const [importMonth,  setImportMonth]  = useState(thisMonth);
  const [loading,      setLoading]      = useState(false);
  const [result,       setResult]       = useState<ImportResult | null>(null);
  const [error,        setError]        = useState<string | null>(null);

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node))
        setShowPanel(false);
    };
    if (showPanel) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showPanel]);

  const reset = () => { setResult(null); setError(null); };

  const handleFile = async (file: File) => {
    if (!user) return;
    setLoading(true);
    reset();
    try {
      const token    = await user.getIdToken();
      const formData = new FormData();
      formData.append("file",         file);
      formData.append("import_month", importMonth);

      const res  = await fetch("/api/import/stocks", {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(data as ImportResult);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const pnlPositive = result && result.pnl >= 0;

  return (
    <div className="relative" ref={panelRef}>
      {/* Trigger */}
      <button
        onClick={() => { setShowPanel((p) => !p); reset(); }}
        className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 bg-gray-800 hover:bg-gray-700
                   text-gray-200 text-sm font-medium rounded-lg border border-gray-700 transition-colors"
      >
        <Upload className="w-4 h-4" />
        <span className="hidden sm:inline">Import Holdings</span>
        <span className="sm:hidden">Import</span>
      </button>

      {/* Panel — bottom sheet on mobile, dropdown on desktop */}
      {showPanel && (
        <div className="
                        fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl
                        sm:absolute sm:bottom-auto sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:rounded-xl sm:w-80
                        bg-gray-900 border border-gray-700
                        shadow-2xl overflow-hidden">
          {/* Mobile handle bar */}
          <div className="sm:hidden flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-700" />
          </div>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <div>
              <p className="text-sm font-semibold text-white">Import Holdings Statement</p>
              <p className="text-xs text-gray-500 mt-0.5">Month-end snapshot from your broker</p>
            </div>
            <button onClick={() => setShowPanel(false)} className="text-gray-500 hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3">

            {/* ── Idle / Month picker ── */}
            {!result && !error && (
              <>
                <div className="bg-gray-800/60 rounded-lg p-3 space-y-1.5">
                  <p className="text-xs font-medium text-gray-300">How it works</p>
                  <ul className="text-xs text-gray-400 space-y-1">
                    <li className="flex gap-2"><span className="text-emerald-400 font-bold">1.</span> Download your Holdings Statement from broker</li>
                    <li className="flex gap-2"><span className="text-emerald-400 font-bold">2.</span> Select the month this statement is for</li>
                    <li className="flex gap-2"><span className="text-emerald-400 font-bold">3.</span> Upload — Invested, Current &amp; P&amp;L are stored</li>
                    <li className="flex gap-2"><span className="text-emerald-400 font-bold">4.</span> Re-uploading the same month safely overwrites it</li>
                  </ul>
                </div>

                {/* Month selector */}
                <div>
                  <p className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Which month does this statement represent?
                  </p>
                  <div className="bg-gray-800/60 rounded-lg px-3 py-2">
                    <MonthPicker value={importMonth} onChange={setImportMonth} />
                  </div>
                </div>

                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5
                             bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60
                             disabled:cursor-not-allowed text-white text-sm font-medium
                             rounded-lg transition-colors"
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Parsing…</>
                    : <><Upload className="w-4 h-4" /> Choose Holdings XLSX</>
                  }
                </button>

                {loading && (
                  <p className="text-xs text-gray-400 text-center animate-pulse">
                    Reading invested &amp; closing values…
                  </p>
                )}
              </>
            )}

            {/* ── Success ── */}
            {result && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-400">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <span className="text-xs">✓</span>
                  </div>
                  <p className="text-xs font-semibold">{result.month_label} imported</p>
                </div>

                <div className="bg-gray-800/60 rounded-lg overflow-hidden divide-y divide-gray-700/50">
                  <div className="flex justify-between items-center px-3 py-2">
                    <span className="text-xs text-gray-400">Invested</span>
                    <span className="text-xs font-semibold text-white">
                      ₹{result.invested.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2">
                    <span className="text-xs text-gray-400">Current Value</span>
                    <span className="text-xs font-semibold text-blue-400">
                      ₹{result.current_value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2">
                    <span className="text-xs text-gray-400">P&amp;L</span>
                    <span className={`text-xs font-semibold ${pnlPositive ? "text-emerald-400" : "text-red-400"}`}>
                      {pnlPositive ? "+" : ""}₹{result.pnl.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      {" "}({pnlPositive ? "+" : ""}{result.pnl_pct.toFixed(2)}%)
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { reset(); }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2
                               bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium
                               rounded-lg border border-gray-700 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" /> Import another
                  </button>
                  <button
                    onClick={() => setShowPanel(false)}
                    className="flex-1 inline-flex items-center justify-center px-3 py-2
                               bg-emerald-600 hover:bg-emerald-500 text-white text-xs
                               font-medium rounded-lg transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {/* ── Error ── */}
            {error && (
              <div className="space-y-2">
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <p className="text-xs text-red-400 font-medium">Import failed</p>
                  <p className="text-xs text-red-400/80 mt-1">{error}</p>
                </div>
                <button
                  onClick={() => { reset(); inputRef.current?.click(); }}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2
                             bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium
                             rounded-lg border border-gray-700 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" /> Try again
                </button>
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      )}
    </div>
  );
}

/* ─── P&L chip ───────────────────────────────────────────────────────────── */
function PnlBadge({ pnl, pct }: { pnl: number; pct: number }) {
  const pos = pnl >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full
                      ${pos ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
      {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {pos ? "+" : ""}{formatINR(Math.abs(pnl))}
      <span className="opacity-70">({pos ? "+" : ""}{pct.toFixed(2)}%)</span>
    </span>
  );
}

/* ─── Delta chip (month-over-month change) ───────────────────────────────── */
function DeltaBadge({ delta, isFirst }: { delta: number; isFirst: boolean }) {
  if (isFirst) return <span className="text-xs text-gray-600 italic">—</span>;
  const pos = delta >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium
                      ${pos ? "text-emerald-400" : "text-red-400"}`}>
      {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {pos ? "+" : ""}{formatINR(Math.abs(delta))}
    </span>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function StocksPage() {
  const { user } = useAuth();
  const [entries,  setEntries]  = useState<MonthlyEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [snapPage, setSnapPage] = useState(1);
  const [histPage, setHistPage] = useState(1);
  const SNAP_SIZE = 12;
  const HIST_SIZE = 10;

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "users", user.uid, "stock_monthly_entries"),
          orderBy("month", "desc"),
        )
      );
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MonthlyEntry)));
      setSnapPage(1);
      setHistPage(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  /* ── Aggregates ── */
  const latest = entries[0];

  const totalInvested     = latest ? Number(latest.invested)      : 0;
  const totalCurrentValue = latest ? Number(latest.current_value) : 0;
  const totalPnl          = latest ? Number(latest.pnl)           : 0;
  const totalPnlPct       = latest ? Number(latest.pnl_pct)       : 0;

  /* ── Month-over-month investment delta rows ──
     entries are desc by month → index 0 = newest
     delta = current.invested - prev.invested                        */
  const momRows = useMemo(() => {
    // asc copy so we can look at [i-1]
    const asc = [...entries].reverse();
    return asc.map((e, i) => ({
      ...e,
      investedDelta:      i === 0 ? 0 : Number(e.invested)      - Number(asc[i - 1].invested),
      currentValueDelta:  i === 0 ? 0 : Number(e.current_value) - Number(asc[i - 1].current_value),
      pnlDelta:           i === 0 ? 0 : Number(e.pnl)           - Number(asc[i - 1].pnl),
      isFirst:            i === 0,
    })).reverse(); // back to desc for display
  }, [entries]);

  /* ── Snapshot pagination ── */
  const snapTotalPages = Math.max(1, Math.ceil(entries.length / SNAP_SIZE));
  const paginatedSnap  = useMemo(
    () => entries.slice((snapPage - 1) * SNAP_SIZE, snapPage * SNAP_SIZE),
    [entries, snapPage],
  );

  /* ── History (MoM) pagination ── */
  const histTotalPages = Math.max(1, Math.ceil(momRows.length / HIST_SIZE));
  const paginatedHist  = useMemo(
    () => momRows.slice((histPage - 1) * HIST_SIZE, histPage * HIST_SIZE),
    [momRows, histPage],
  );

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Indian Stocks</h1>
          <p className="text-gray-400 text-sm mt-1">
            Month-end holdings snapshot — NSE &amp; BSE
          </p>
        </div>
        <div className="page-header-actions flex-wrap gap-2">
          <HoldingsImportButton onSuccess={fetchData} />
          <StockAddEntryModal onAdded={fetchData} />
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Invested"
          value={formatINR(totalInvested)}
          subtitle={latest ? `As of ${latest.month_label}` : "No data yet"}
          icon={Wallet}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
        />
        <StatCard
          title="Current Value"
          value={formatINR(totalCurrentValue)}
          subtitle={latest ? `${latest.month_label} closing` : "No data yet"}
          icon={TrendingUp}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10"
        />
        <StatCard
          title="Unrealised P&L"
          value={`${totalPnl >= 0 ? "+" : ""}${formatINR(totalPnl)}`}
          subtitle={`${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(2)}% return`}
          icon={totalPnl >= 0 ? TrendingUp : TrendingDown}
          iconColor={totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}
          iconBg={totalPnl >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}
        />
      </div>

      {/* ── Chart ── */}
      {entries.length > 0 && (
        <StockMonthlyStats entries={entries} onDeleted={fetchData} />
      )}

      {/* ══════════════════════════════════════════════════════
          Monthly Snapshots table (with pagination)
      ══════════════════════════════════════════════════════ */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-800/60
                        flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Monthly Snapshots</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              One row per month — imported from your Holdings Statement
            </p>
          </div>
          <span className="text-xs text-gray-500">
            {entries.length} snapshot{entries.length !== 1 ? "s" : ""}
          </span>
        </div>

        {entries.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-gray-400 text-sm font-medium">No snapshots yet</p>
            <p className="text-gray-500 text-xs mt-1">
              Import a Holdings Statement or click{" "}
              <span className="text-emerald-400">Add Entry</span> to get started.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="text-right">Invested (₹)</th>
                    <th className="text-right">Current Value (₹)</th>
                    <th className="text-right">P&amp;L</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSnap.map((e) => (
                    <tr key={e.id}>
                      <td className="font-medium text-gray-200">
                        {e.month_label}
                        {e.statement_date && (
                          <span className="block text-xs text-gray-500 font-normal">
                            Statement: {e.statement_date}
                          </span>
                        )}
                      </td>
                      <td className="text-right text-gray-300 font-medium">
                        {formatINR(Number(e.invested))}
                      </td>
                      <td className="text-right text-blue-400 font-medium">
                        {formatINR(Number(e.current_value))}
                      </td>
                      <td className="text-right">
                        <PnlBadge pnl={Number(e.pnl)} pct={Number(e.pnl_pct)} />
                      </td>
                      <td className="text-center">
                        <DeleteButton
                          id={e.id}
                          endpoint="/api/delete/stocks"
                          itemName={e.month_label}
                          onDeleted={fetchData}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="sm:hidden divide-y divide-gray-800/60">
              {paginatedSnap.map((e) => (
                <div key={e.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{e.month_label}</p>
                    {e.statement_date && (
                      <p className="text-xs text-gray-500">{e.statement_date}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span className="text-gray-400">
                        Inv: <span className="text-gray-200 font-medium">{formatINR(Number(e.invested))}</span>
                      </span>
                      <span className="text-gray-400">
                        Cur: <span className="text-blue-400 font-medium">{formatINR(Number(e.current_value))}</span>
                      </span>
                    </div>
                    <div className="mt-1">
                      <PnlBadge pnl={Number(e.pnl)} pct={Number(e.pnl_pct)} />
                    </div>
                  </div>
                  <DeleteButton
                    id={e.id}
                    endpoint="/api/delete/stocks"
                    itemName={e.month_label}
                    onDeleted={fetchData}
                  />
                </div>
              ))}
            </div>

            <PaginationBar
              page={snapPage} totalPages={snapTotalPages} total={entries.length}
              pageSize={SNAP_SIZE} label="snapshots" onPage={setSnapPage}
            />
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          Month-over-Month Investment Change table
      ══════════════════════════════════════════════════════ */}
      {entries.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-800/60">
            <div>
              <h2 className="text-base font-semibold text-white">Monthly Investment Change</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                How much you added to stocks each month — current month minus previous month
              </p>
            </div>
          </div>

          {/* Desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="data-table min-w-[700px]">
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="text-right">Invested (₹)</th>
                  <th className="text-right">Δ Invested</th>
                  <th className="text-right">Current (₹)</th>
                  <th className="text-right">Δ Value</th>
                  <th className="text-right">P&amp;L</th>
                  <th className="text-right">Δ P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHist.map((e) => (
                  <tr key={e.id}>
                    <td className="font-medium text-gray-200">
                      {e.month_label}
                      {e.statement_date && (
                        <span className="block text-xs text-gray-500 font-normal">
                          {e.statement_date}
                        </span>
                      )}
                    </td>
                    {/* Invested */}
                    <td className="text-right text-gray-300 font-medium">
                      {formatINR(Number(e.invested))}
                    </td>
                    <td className="text-right">
                      <DeltaBadge delta={e.investedDelta} isFirst={e.isFirst} />
                    </td>
                    {/* Current value */}
                    <td className="text-right text-blue-400 font-medium">
                      {formatINR(Number(e.current_value))}
                    </td>
                    <td className="text-right">
                      <DeltaBadge delta={e.currentValueDelta} isFirst={e.isFirst} />
                    </td>
                    {/* P&L */}
                    <td className="text-right">
                      <PnlBadge pnl={Number(e.pnl)} pct={Number(e.pnl_pct)} />
                    </td>
                    <td className="text-right">
                      <DeltaBadge delta={e.pnlDelta} isFirst={e.isFirst} />
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Totals footer — only when >1 page or >1 entry */}
              {entries.length > 1 && (
                <tfoot className="border-t border-gray-700/60">
                  <tr className="bg-gray-800/30">
                    <td className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Net Change (all time)
                    </td>
                    <td />
                    <td className="text-right px-4 py-3">
                      <DeltaBadge
                        delta={Number(entries[0].invested) - Number(entries[entries.length - 1].invested)}
                        isFirst={false}
                      />
                    </td>
                    <td />
                    <td className="text-right px-4 py-3">
                      <DeltaBadge
                        delta={Number(entries[0].current_value) - Number(entries[entries.length - 1].current_value)}
                        isFirst={false}
                      />
                    </td>
                    <td />
                    <td className="text-right px-4 py-3">
                      <DeltaBadge
                        delta={Number(entries[0].pnl) - Number(entries[entries.length - 1].pnl)}
                        isFirst={false}
                      />
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Mobile */}
          <div className="sm:hidden divide-y divide-gray-800/60">
            {paginatedHist.map((e) => (
              <div key={e.id} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">{e.month_label}</p>
                  {e.statement_date && (
                    <p className="text-xs text-gray-500">{e.statement_date}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div>
                    <p className="text-gray-500 mb-0.5">Invested</p>
                    <p className="text-gray-200 font-medium">{formatINR(Number(e.invested))}</p>
                    <DeltaBadge delta={e.investedDelta} isFirst={e.isFirst} />
                  </div>
                  <div>
                    <p className="text-gray-500 mb-0.5">Current Value</p>
                    <p className="text-blue-400 font-medium">{formatINR(Number(e.current_value))}</p>
                    <DeltaBadge delta={e.currentValueDelta} isFirst={e.isFirst} />
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500 mb-0.5">P&amp;L</p>
                    <div className="flex items-center gap-3">
                      <PnlBadge pnl={Number(e.pnl)} pct={Number(e.pnl_pct)} />
                      <DeltaBadge delta={e.pnlDelta} isFirst={e.isFirst} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <PaginationBar
            page={histPage} totalPages={histTotalPages} total={momRows.length}
            pageSize={HIST_SIZE} label="months" onPage={setHistPage}
          />
        </div>
      )}

    </div>
  );
}
