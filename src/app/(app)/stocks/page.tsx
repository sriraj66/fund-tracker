import { createClient } from "@/lib/supabase/server";
import { formatINR, formatDate, formatNumber } from "@/lib/utils";
import StatCard from "@/components/StatCard";
import { TrendingUp, TrendingDown, Plus } from "lucide-react";
import StockAddModal from "./StockAddModal";
import ImportButton from "@/components/ImportButton";
import DeleteButton from "@/components/DeleteButton";

export default async function StocksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: transactions } = await supabase
    .from("stock_transactions")
    .select("*")
    .eq("user_id", user!.id)
    .order("execution_date", { ascending: false });

  const rows = transactions ?? [];

  const totalBought = rows
    .filter((t) => t.transaction_type === "BUY")
    .reduce((s, t) => s + Number(t.value), 0);

  const totalSold = rows
    .filter((t) => t.transaction_type === "SELL")
    .reduce((s, t) => s + Number(t.value), 0);

  const netInvested = totalBought - totalSold;

  // Group by symbol for holdings
  const holdingsMap = new Map<string, {
    name: string;
    symbol: string;
    qty: number;
    invested: number;
    avgPrice: number;
  }>();

  for (const t of rows) {
    const existing = holdingsMap.get(t.symbol) ?? {
      name: t.stock_name,
      symbol: t.symbol,
      qty: 0,
      invested: 0,
      avgPrice: 0,
    };
    if (t.transaction_type === "BUY") {
      existing.qty += Number(t.quantity);
      existing.invested += Number(t.value);
    } else {
      existing.qty -= Number(t.quantity);
      existing.invested -= Number(t.value);
    }
    existing.avgPrice = existing.qty > 0 ? existing.invested / existing.qty : 0;
    holdingsMap.set(t.symbol, existing);
  }

  const holdings = Array.from(holdingsMap.values()).filter((h) => h.qty > 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Indian Stocks</h1>
          <p className="text-gray-400 text-sm mt-1">NSE / BSE equity orders (INDMoney Grow)</p>
        </div>
        <div className="flex items-center gap-2">
          <ImportButton
            endpoint="/api/import/stocks"
            accept=".xlsx,.xls"
            label="Import Transactions"
            hint="INDMoney / Grow Stocks Order History XLSX"
          />
          <ImportButton
            endpoint="/api/import/holdings/stocks"
            accept=".xlsx,.xls"
            label="Import Holdings"
            hint="INDMoney Stocks Holdings Statement XLSX"
          />
          <StockAddModal userId={user!.id} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Net Invested"
          value={formatINR(netInvested)}
          subtitle="Bought minus sold"
          icon={TrendingUp}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
        />
        <StatCard
          title="Total Bought"
          value={formatINR(totalBought)}
          subtitle={`${rows.filter((t) => t.transaction_type === "BUY").length} buy orders`}
          icon={TrendingUp}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10"
        />
        <StatCard
          title="Total Sold"
          value={formatINR(totalSold)}
          subtitle={`${rows.filter((t) => t.transaction_type === "SELL").length} sell orders`}
          icon={TrendingDown}
          iconColor="text-red-400"
          iconBg="bg-red-500/10"
        />
      </div>

      {/* Holdings */}
      {holdings.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800/60">
            <h2 className="text-base font-semibold text-white">Current Holdings</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Stock</th>
                  <th>Symbol</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Avg Price</th>
                  <th className="text-right">Invested</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => (
                  <tr key={h.symbol}>
                    <td className="font-medium text-gray-200">{h.name}</td>
                    <td>
                      <span className="font-mono text-xs bg-gray-800 text-sky-400 px-2 py-0.5 rounded">
                        {h.symbol}
                      </span>
                    </td>
                    <td className="text-right text-gray-300">{formatNumber(h.qty, 2)}</td>
                    <td className="text-right text-gray-300">{formatINR(h.avgPrice)}</td>
                    <td className="text-right font-medium text-gray-200">{formatINR(h.invested)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order History */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800/60">
          <h2 className="text-base font-semibold text-white">Order History</h2>
        </div>
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
              <Plus className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-gray-400 text-sm font-medium">No stock orders yet</p>
            <p className="text-gray-500 text-xs mt-1">Click &quot;Add Order&quot; to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Stock</th>
                  <th>Symbol</th>
                  <th>Type</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Value</th>
                  <th>Exchange</th>
                  <th>Date</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td className="font-medium text-gray-200 max-w-[200px] truncate">{t.stock_name}</td>
                    <td>
                      <span className="font-mono text-xs bg-gray-800 text-sky-400 px-2 py-0.5 rounded">
                        {t.symbol}
                      </span>
                    </td>
                    <td>
                      <span className={t.transaction_type === "BUY" ? "badge-buy" : "badge-sell"}>
                        {t.transaction_type}
                      </span>
                    </td>
                    <td className="text-right text-gray-300">{formatNumber(Number(t.quantity), 2)}</td>
                    <td className="text-right font-medium text-gray-200">{formatINR(Number(t.value))}</td>
                    <td className="text-gray-400 text-xs">{t.exchange ?? "—"}</td>
                    <td className="text-gray-400 text-xs">
                      {t.execution_date ? formatDate(t.execution_date) : "—"}
                    </td>
                    <td className="text-center">
                      <DeleteButton id={t.id} endpoint="/api/delete/stocks" itemName={t.symbol} />
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