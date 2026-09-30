"use client";

import { useMemo } from "react";
import { Lightbulb } from "lucide-react";
import { type Currency, type UsAnalysis, type UsPoint, moneyFmt } from "@/lib/trackerAnalytics";

interface Props {
  label: string;   // e.g. "US stocks"
  series: UsPoint[];
  analysis: UsAnalysis;
  currency: Currency;
}

const pct = (n: number | null) => (n === null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`);

export default function TrackerInsights({ label, series, analysis: a, currency }: Props) {
  const insights = useMemo(() => {
    const fmt = moneyFmt(currency);
    const out: string[] = [];
    const last = series[series.length - 1];
    if (!last) return out;

    out.push(
      last.pnl >= 0
        ? `${label} are up ${fmt(last.pnl)} (${pct(last.ret)}) on ${fmt(last.invested)} invested.`
        : `${label} are down ${fmt(Math.abs(last.pnl))} (${pct(last.ret)}) on ${fmt(last.invested)} invested.`,
    );
    if (a.shareFrom !== null && a.shareTo !== null && series.length > 1) {
      const d = a.shareTo - a.shareFrom;
      out.push(`Share of your total portfolio ${Math.abs(d) < 0.1 ? "held steady" : d > 0 ? "grew" : "shrank"} from ${a.shareFrom.toFixed(1)}% to ${a.shareTo.toFixed(1)}%.`);
    }
    const growth = a.totalContributed + a.marketGain;
    if (series.length > 1 && growth !== 0 && a.totalContributed !== 0) {
      const fromMoney = (a.totalContributed / growth) * 100;
      out.push(`${fromMoney.toFixed(0)}% of the change in value came from new money (${fmt(a.totalContributed)}); the rest, ${fmt(a.marketGain)}, from market moves.`);
    }
    if (a.best && a.worst && a.best.id !== a.worst.id) {
      out.push(`Best period ended ${a.best.label} (${pct(a.best.periodRet)}); weakest ended ${a.worst.label} (${pct(a.worst.periodRet)}).`);
    }
    if (a.winRate) out.push(`${a.winRate.up} of ${a.winRate.total} periods were positive (${Math.round((a.winRate.up / a.winRate.total) * 100)}%).`);
    if (a.maxDrawdown !== null && a.maxDrawdown >= 10) out.push(`Largest peak-to-trough fall in market value was ${a.maxDrawdown.toFixed(1)}%.`);
    return out;
  }, [label, series, a, currency]);

  if (insights.length === 0) return null;

  return (
    <div className="glass-card p-3 sm:p-4 md:p-6">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4 text-amber-400" />
        <h2 className="text-base font-semibold text-white">Key Insights</h2>
      </div>
      <ul className="space-y-2">
        {insights.map((t, i) => (
          <li key={i} className="flex gap-2 text-sm text-gray-300 min-w-0">
            <span className="text-sky-400 mt-0.5">•</span>
            <span className="break-words min-w-0">{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
