"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { type Currency, type UsPoint, currencySymbol, moneyFmt } from "@/lib/trackerAnalytics";

/* ─── Types ──────────────────────────────────────────────────────────────── */
export interface MonthlyEntry {
  id:              string;
  month:           string;   // "YYYY-MM"
  month_label:     string;   // "Sep 2026"
  invested:        number;
  current_value:   number;
  pnl:             number;
  pnl_pct:         number;
  statement_date?: string;   // "DD-MM-YYYY" as printed on statement
  updated_at?:     string;
}

/* Month-end entries from Portfolio Tracker points: last snapshot of each month, newest first. */
export function monthlyFromSeries(series: UsPoint[]): MonthlyEntry[] {
  const byMonth = new Map<string, UsPoint>();
  for (const p of series) byMonth.set(p.date.slice(0, 7), p); // series is ascending, so the last one wins
  return Array.from(byMonth.entries())
    .map(([month, p]) => ({
      id: p.id,
      month,
      month_label: new Date(`${month}-01`).toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
      invested: p.invested,
      current_value: p.value,
      pnl: p.pnl,
      pnl_pct: p.ret,
    }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

/* ─── Pagination ─────────────────────────────────────────────────────────── */
export function PaginationBar({
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


/* ─── P&L chip ───────────────────────────────────────────────────────────── */
export function PnlBadge({ pnl, pct, fmt = formatINR }: { pnl: number; pct: number; fmt?: (n: number) => string }) {
  const pos = pnl >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full
                      ${pos ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
      {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {pos ? "+" : ""}{fmt(Math.abs(pnl))}
      <span className="opacity-70">({pos ? "+" : ""}{pct.toFixed(2)}%)</span>
    </span>
  );
}

/* ─── Delta chip (month-over-month change) ───────────────────────────────── */
export function DeltaBadge({ delta, isFirst, fmt = formatINR }: { delta: number; isFirst: boolean; fmt?: (n: number) => string }) {
  if (isFirst) return <span className="text-xs text-gray-600 italic">—</span>;
  const pos = delta >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium
                      ${pos ? "text-emerald-400" : "text-red-400"}`}>
      {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {pos ? "+" : ""}{fmt(Math.abs(delta))}
    </span>
  );
}


/* ─── Month-over-Month Investment Change table ───────────────────────────── */
const HIST_SIZE = 10;

export function MonthlyChangeTable({
  entries, label, currency = "INR",
}: { entries: MonthlyEntry[]; label: string; currency?: Currency }) {
  const fmt = moneyFmt(currency);
  const sym = currencySymbol(currency);
  const [histPage, setHistPage] = useState(1);

  useEffect(() => { setHistPage(1); }, [entries]);

  /* entries are desc by month → index 0 = newest; delta = current - previous month */
  const momRows = useMemo(() => {
    const asc = [...entries].reverse();
    return asc.map((e, i) => ({
      ...e,
      investedDelta:     i === 0 ? 0 : Number(e.invested)      - Number(asc[i - 1].invested),
      currentValueDelta: i === 0 ? 0 : Number(e.current_value) - Number(asc[i - 1].current_value),
      pnlDelta:          i === 0 ? 0 : Number(e.pnl)           - Number(asc[i - 1].pnl),
      isFirst:           i === 0,
    })).reverse();
  }, [entries]);

  const histTotalPages = Math.max(1, Math.ceil(momRows.length / HIST_SIZE));
  const paginatedHist  = useMemo(
    () => momRows.slice((histPage - 1) * HIST_SIZE, histPage * HIST_SIZE),
    [momRows, histPage],
  );

  if (entries.length === 0) return null;

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-800/60">
        <div>
          <h2 className="text-base font-semibold text-white">Monthly Investment Change</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            How much you added to {label} each month — current month minus previous month
          </p>
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="data-table min-w-[700px]">
          <thead>
            <tr>
              <th>Month</th>
              <th className="text-right">Invested ({sym})</th>
              <th className="text-right">Δ Invested</th>
              <th className="text-right">Current ({sym})</th>
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
                  {fmt(Number(e.invested))}
                </td>
                <td className="text-right">
                  <DeltaBadge fmt={fmt} delta={e.investedDelta} isFirst={e.isFirst} />
                </td>
                {/* Current value */}
                <td className="text-right text-blue-400 font-medium">
                  {fmt(Number(e.current_value))}
                </td>
                <td className="text-right">
                  <DeltaBadge fmt={fmt} delta={e.currentValueDelta} isFirst={e.isFirst} />
                </td>
                {/* P&L */}
                <td className="text-right">
                  <PnlBadge pnl={Number(e.pnl)} pct={Number(e.pnl_pct)} fmt={fmt} />
                </td>
                <td className="text-right">
                  <DeltaBadge fmt={fmt} delta={e.pnlDelta} isFirst={e.isFirst} />
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
                  <DeltaBadge fmt={fmt}
                    delta={Number(entries[0].invested) - Number(entries[entries.length - 1].invested)}
                    isFirst={false}
                  />
                </td>
                <td />
                <td className="text-right px-4 py-3">
                  <DeltaBadge fmt={fmt}
                    delta={Number(entries[0].current_value) - Number(entries[entries.length - 1].current_value)}
                    isFirst={false}
                  />
                </td>
                <td />
                <td className="text-right px-4 py-3">
                  <DeltaBadge fmt={fmt}
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
                <p className="text-gray-200 font-medium">{fmt(Number(e.invested))}</p>
                <DeltaBadge fmt={fmt} delta={e.investedDelta} isFirst={e.isFirst} />
              </div>
              <div>
                <p className="text-gray-500 mb-0.5">Current Value</p>
                <p className="text-blue-400 font-medium">{fmt(Number(e.current_value))}</p>
                <DeltaBadge fmt={fmt} delta={e.currentValueDelta} isFirst={e.isFirst} />
              </div>
              <div className="col-span-2">
                <p className="text-gray-500 mb-0.5">P&amp;L</p>
                <div className="flex items-center gap-3">
                  <PnlBadge pnl={Number(e.pnl)} pct={Number(e.pnl_pct)} fmt={fmt} />
                  <DeltaBadge fmt={fmt} delta={e.pnlDelta} isFirst={e.isFirst} />
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
  );
}
