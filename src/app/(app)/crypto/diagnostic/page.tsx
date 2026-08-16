import { createClient } from "@/lib/supabase/server";
import { formatINR, formatDate } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

export default async function CryptoDiagnosticPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: transactions } = await supabase
    .from("crypto_transactions")
    .select("*")
    .eq("user_id", user!.id)
    .order("transaction_date", { ascending: true });

  const rows = transactions ?? [];

  // Calculate by coin
  const coinStats = new Map<string, {
    buyQty: number;
    sellQty: number;
    buyValue: number;
    sellValue: number;
    netQty: number;
    netInvested: number;
    transactions: typeof rows;
  }>();

  rows.forEach(tx => {
    const stats = coinStats.get(tx.coin) || {
      buyQty: 0,
      sellQty: 0,
      buyValue: 0,
      sellValue: 0,
      netQty: 0,
      netInvested: 0,
      transactions: []
    };

    if (tx.trade_type === "BUY") {
      stats.buyQty += Number(tx.volume ?? 0);
      stats.buyValue += Number(tx.total_inr ?? 0);
    } else {
      stats.sellQty += Number(tx.volume ?? 0);
      stats.sellValue += Number(tx.total_inr ?? 0);
    }

    stats.netQty = stats.buyQty - stats.sellQty;
    stats.netInvested = stats.buyValue - stats.sellValue;
    stats.transactions.push(tx);

    coinStats.set(tx.coin, stats);
  });

  const totalBuyValue = Array.from(coinStats.values()).reduce((sum, s) => sum + s.buyValue, 0);
  const totalSellValue = Array.from(coinStats.values()).reduce((sum, s) => sum + s.sellValue, 0);
  const totalNetInvested = totalBuyValue - totalSellValue;

  const coinsWithHoldings = Array.from(coinStats.entries())
    .filter(([_, stats]) => stats.netQty > 0.000001);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Crypto Diagnostic</h1>
          <p className="text-gray-400 text-sm mt-1">Database transaction analysis</p>
        </div>
        <Link href="/crypto" className="btn-secondary">
          ← Back to Crypto
        </Link>
      </div>

      {/* Summary */}
      <div className="glass-card p-6 border-l-4 border-orange-500">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-orange-400 flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">Database Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Total Transactions</p>
                <p className="text-xl font-bold text-white">{rows.length}</p>
              </div>
              <div>
                <p className="text-gray-400">Total Bought</p>
                <p className="text-xl font-bold text-emerald-400">{formatINR(totalBuyValue)}</p>
              </div>
              <div>
                <p className="text-gray-400">Total Sold</p>
                <p className="text-xl font-bold text-red-400">{formatINR(totalSellValue)}</p>
              </div>
              <div>
                <p className="text-gray-400">Net Invested</p>
                <p className="text-xl font-bold text-white">{formatINR(totalNetInvested)}</p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
              <p className="text-yellow-400 font-semibold text-sm">Expected: ₹3,177.29 invested (BTC, ETH, DOGE, XRP)</p>
              <p className="text-yellow-400 text-sm">Actual in DB: {formatINR(totalNetInvested)}</p>
              {Math.abs(totalNetInvested - 3177.29) > 1 && (
                <p className="text-red-400 text-sm font-semibold mt-1">
                  ⚠ Difference: {formatINR(Math.abs(totalNetInvested - 3177.29))}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Holdings by Coin */}
      <div className="glass-card">
        <div className="p-6 border-b border-gray-800/60">
          <h2 className="text-lg font-semibold text-white">Current Holdings by Coin</h2>
          <p className="text-sm text-gray-400">Only coins with positive balance</p>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Coin</th>
                <th className="text-right">Quantity</th>
                <th className="text-right">Buy Value</th>
                <th className="text-right">Sell Value</th>
                <th className="text-right">Net Invested</th>
                <th className="text-right">Transactions</th>
              </tr>
            </thead>
            <tbody>
              {coinsWithHoldings.map(([coin, stats]) => (
                <tr key={coin}>
                  <td className="font-semibold text-orange-400">{coin}</td>
                  <td className="text-right text-gray-300">{stats.netQty.toFixed(8)}</td>
                  <td className="text-right text-emerald-400">{formatINR(stats.buyValue)}</td>
                  <td className="text-right text-red-400">{formatINR(stats.sellValue)}</td>
                  <td className="text-right font-semibold text-white">{formatINR(stats.netInvested)}</td>
                  <td className="text-right text-gray-400">{stats.transactions.length}</td>
                </tr>
              ))}
              {coinsWithHoldings.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-500 py-8">
                    No holdings found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* All Transactions */}
      <div className="glass-card">
        <div className="p-6 border-b border-gray-800/60">
          <h2 className="text-lg font-semibold text-white">All Transactions</h2>
          <p className="text-sm text-gray-400">Complete transaction history</p>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Coin</th>
                <th>Type</th>
                <th className="text-right">Volume</th>
                <th className="text-right">Price</th>
                <th className="text-right">Total INR</th>
                <th className="text-right">Fees</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((tx) => (
                <tr key={tx.id}>
                  <td className="text-gray-300">{formatDate(tx.transaction_date)}</td>
                  <td className="font-semibold text-orange-400">{tx.coin}</td>
                  <td>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      tx.trade_type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {tx.trade_type}
                    </span>
                  </td>
                  <td className="text-right text-gray-300">{Number(tx.volume ?? 0).toFixed(8)}</td>
                  <td className="text-right text-gray-300">{formatINR(tx.price ?? 0)}</td>
                  <td className="text-right font-semibold text-white">{formatINR(tx.total_inr ?? 0)}</td>
                  <td className="text-right text-gray-400">{formatINR(tx.fee_amount ?? 0)}</td>
                  <td className="text-xs text-gray-500 max-w-xs truncate">{tx.notes || tx.transaction_ref || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action */}
      <div className="glass-card p-6 bg-red-500/5 border border-red-500/20">
        <h3 className="text-lg font-semibold text-white mb-3">Fix Issues</h3>
        <p className="text-gray-400 text-sm mb-4">
          If the data is incorrect, you can clear all crypto transactions and re-import:
        </p>
        <Link href="/settings" className="btn-primary inline-block">
          Go to Settings → Clear Crypto Data
        </Link>
      </div>
    </div>
  );
}
