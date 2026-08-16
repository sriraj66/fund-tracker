import { createClient } from "@/lib/supabase/server";
import { formatINR, formatDate, formatNumber } from "@/lib/utils";
import StatCard from "@/components/StatCard";
import { Bitcoin, TrendingUp, TrendingDown, Plus, AlertCircle } from "lucide-react";
import CryptoAddModal from "./CryptoAddModal";
import ImportButton from "@/components/ImportButton";
import DeleteButton from "@/components/DeleteButton";
import Link from "next/link";

export default async function CryptoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: transactions } = await supabase
    .from("crypto_transactions")
    .select("*")
    .eq("user_id", user!.id)
    .order("transaction_date", { ascending: false });

  const rows = transactions ?? [];

  const totalBought = rows
    .filter((t) => t.trade_type === "BUY")
    .reduce((s, t) => s + Number(t.total_inr ?? 0), 0);

  const totalSold = rows
    .filter((t) => t.trade_type === "SELL")
    .reduce((s, t) => s + Number(t.total_inr ?? 0), 0);

  const netInvested = totalBought - totalSold;

  const totalTds = rows.reduce((s, t) => s + Number(t.tds_amount ?? 0), 0);
  const totalFees = rows.reduce((s, t) => s + Number(t.fee_amount ?? 0), 0);

  // Group by coin
  const coinMap = new Map<string, { qty: number; invested: number; count: number }>();
  for (const t of rows) {
    const existing = coinMap.get(t.coin) ?? { qty: 0, invested: 0, count: 0 };
    if (t.trade_type === "BUY") {
      existing.qty += Number(t.volume ?? 0);
      existing.invested += Number(t.total_inr ?? 0);
    } else {
      existing.qty -= Number(t.volume ?? 0);
      existing.invested -= Number(t.total_inr ?? 0);
    }
    existing.count += 1;
    coinMap.set(t.coin, existing);
  }

  const holdings = Array.from(coinMap.entries())
    .map(([coin, data]) => ({ coin, ...data }))
    .filter((h) => h.qty > 0.000001);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Crypto</h1>
          <p className="text-gray-400 text-sm mt-1">CoinSwitch spot trades (INR)</p>
        </div>
        <div className="flex items-center gap-2">
          <ImportButton
            endpoint="/api/import/crypto"
            accept=".xlsx,.xls"
            label="Import Transactions"
            hint="CoinSwitch Transaction Statement XLSX"
          />
          <ImportButton
            endpoint="/api/import/holdings/crypto"
            accept=".xlsx,.xls"
            label="Import Holdings"
            hint="CoinSwitch Trade Report (Balances VDA)"
          />
          <CryptoAddModal userId={user!.id} />
        </div>
      </div>

      {/* Data Issue Warning */}
      {(Math.abs(netInvested - 3177.29) > 10 || holdings.length !== 4) && (
        <div className="glass-card p-4 bg-yellow-500/5 border border-yellow-500/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-yellow-400 font-semibold text-sm">Data may be incorrect</p>
              <p className="text-gray-400 text-sm mt-1">
                Expected: ₹3,177.29 (BTC, ETH, DOGE, XRP) • Found: {formatINR(netInvested)} ({holdings.length} coins)
              </p>
              <Link href="/crypto/diagnostic" className="text-sky-400 hover:text-sky-300 text-sm font-medium mt-2 inline-block">
                View Diagnostic Report →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Net Invested"
          value={formatINR(netInvested)}
          subtitle="Bought minus sold"
          icon={Bitcoin}
          iconColor="text-orange-400"
          iconBg="bg-orange-500/10"
        />
        <StatCard
          title="Total Bought"
          value={formatINR(totalBought)}
          subtitle={`${rows.filter((t) => t.trade_type === "BUY").length} buys`}
          icon={TrendingUp}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
        />
        <StatCard
          title="Total Sold"
          value={formatINR(totalSold)}
          subtitle={`${rows.filter((t) => t.trade_type === "SELL").length} sells`}
          icon={TrendingDown}
          iconColor="text-red-400"
          iconBg="bg-red-500/10"
        />
        <StatCard
          title="TDS Paid"
          value={formatINR(totalTds)}
          subtitle={`Fees: ${formatINR(totalFees)}`}
          icon={Bitcoin}
          iconColor="text-yellow-400"
          iconBg="bg-yellow-500/10"
        />
      </div>

      {/* Holdings */}
      {holdings.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800/60">
            <h2 className="text-base font-semibold text-white">Coin Holdings</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Coin</th>
                  <th className="text-right">Balance</th>
                  <th className="text-right">Net Invested (INR)</th>
                  <th className="text-right">Avg Buy Price</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => (
                  <tr key={h.coin}>
                    <td>
                      <span className="font-mono font-semibold text-orange-400">{h.coin}</span>
                    </td>
                    <td className="text-right text-gray-300">{formatNumber(h.qty, 8)}</td>
                    <td className="text-right font-medium text-gray-200">{formatINR(h.invested)}</td>
                    <td className="text-right text-gray-300">
                      {h.qty > 0 ? formatINR(h.invested / h.qty) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trade History */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800/60">
          <h2 className="text-base font-semibold text-white">Trade History</h2>
        </div>
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-3">
              <Plus className="w-6 h-6 text-orange-400" />
            </div>
            <p className="text-gray-400 text-sm font-medium">No crypto trades yet</p>
            <p className="text-gray-500 text-xs mt-1">Click &quot;Add Trade&quot; to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Coin / Market</th>
                  <th>Type</th>
                  <th className="text-right">Volume</th>
                  <th className="text-right">Price (INR)</th>
                  <th className="text-right">Total (INR)</th>
                  <th className="text-right">TDS</th>
                  <th>Date</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div className="font-mono font-semibold text-orange-400">{t.coin}</div>
                      <div className="text-xs text-gray-500">{t.market}</div>
                    </td>
                    <td>
                      <span className={t.trade_type === "BUY" ? "badge-buy" : "badge-sell"}>
                        {t.trade_type}
                      </span>
                    </td>
                    <td className="text-right text-gray-300">{formatNumber(Number(t.volume ?? 0), 8)}</td>
                    <td className="text-right text-gray-300">
                      {t.price ? formatINR(Number(t.price)) : "—"}
                    </td>
                    <td className="text-right font-medium text-gray-200">
                      {t.total_inr ? formatINR(Number(t.total_inr)) : "—"}
                    </td>
                    <td className="text-right text-yellow-400 text-xs">
                      {t.tds_amount ? formatINR(Number(t.tds_amount)) : "₹0"}
                    </td>
                    <td className="text-gray-400 text-xs">{formatDate(t.transaction_date)}</td>
                    <td className="text-center">
                      <DeleteButton id={t.id} endpoint="/api/delete/crypto" itemName={t.coin} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}