import { createClient } from "@/lib/supabase/server";
import { formatINR, formatDate, formatNumber } from "@/lib/utils";
import StatCard from "@/components/StatCard";
import { BarChart3, Plus, TrendingUp } from "lucide-react";
import MfAddModal from "./MfAddModal";
import ImportButton from "@/components/ImportButton";
import DeleteButton from "@/components/DeleteButton";

export default async function MutualFundsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: transactions } = await supabase
    .from("mf_transactions")
    .select("*")
    .eq("user_id", user!.id)
    .order("transaction_date", { ascending: false });

  const rows = transactions ?? [];

  const totalPurchased = rows
    .filter((t) => t.transaction_type !== "REDEMPTION")
    .reduce((s, t) => s + Number(t.amount), 0);

  const totalRedeemed = rows
    .filter((t) => t.transaction_type === "REDEMPTION")
    .reduce((s, t) => s + Number(t.amount), 0);

  const netInvested = totalPurchased - totalRedeemed;

  // Group by scheme
  const schemeMap = new Map<string, { units: number; invested: number; count: number }>();
  for (const t of rows) {
    const existing = schemeMap.get(t.scheme_name) ?? { units: 0, invested: 0, count: 0 };
    if (t.transaction_type === "REDEMPTION") {
      existing.units -= Number(t.units ?? 0);
      existing.invested -= Number(t.amount);
    } else {
      existing.units += Number(t.units ?? 0);
      existing.invested += Number(t.amount);
    }
    existing.count += 1;
    schemeMap.set(t.scheme_name, existing);
  }

  const schemes = Array.from(schemeMap.entries()).map(([name, data]) => ({
    name,
    ...data,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Mutual Funds</h1>
          <p className="text-gray-400 text-sm mt-1">Track your MF investments</p>
        </div>
        <div className="flex items-center gap-2">
          <ImportButton
            endpoint="/api/import/mf"
            accept=".xlsx,.xls"
            label="Import Transactions"
            hint="INDMoney Mutual Funds Order History XLSX"
          />
          <ImportButton
            endpoint="/api/import/holdings/mf"
            accept=".xlsx,.xls"
            label="Import Holdings"
            hint="INDMoney Mutual Funds Holdings Statement XLSX"
          />
          <MfAddModal userId={user!.id} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Net Invested"
          value={formatINR(netInvested)}
          subtitle="Purchased minus redeemed"
          icon={BarChart3}
          iconColor="text-violet-400"
          iconBg="bg-violet-500/10"
        />
        <StatCard
          title="Total Purchased"
          value={formatINR(totalPurchased)}
          subtitle={`${rows.filter((t) => t.transaction_type !== "REDEMPTION").length} transactions`}
          icon={TrendingUp}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
        />
        <StatCard
          title="Total Redeemed"
          value={formatINR(totalRedeemed)}
          subtitle={`${rows.filter((t) => t.transaction_type === "REDEMPTION").length} redemptions`}
          icon={BarChart3}
          iconColor="text-red-400"
          iconBg="bg-red-500/10"
        />
      </div>

      {/* Scheme Summary */}
      {schemes.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800/60">
            <h2 className="text-base font-semibold text-white">Scheme Holdings</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Scheme Name</th>
                  <th className="text-right">Units</th>
                  <th className="text-right">Invested</th>
                  <th className="text-right">Transactions</th>
                </tr>
              </thead>
              <tbody>
                {schemes.map((s) => (
                  <tr key={s.name}>
                    <td className="font-medium text-gray-200 max-w-xs truncate">{s.name}</td>
                    <td className="text-right text-gray-300">{formatNumber(s.units, 4)}</td>
                    <td className="text-right text-gray-300 font-medium">{formatINR(s.invested)}</td>
                    <td className="text-right text-gray-400">{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800/60">
          <h2 className="text-base font-semibold text-white">Transaction History</h2>
        </div>
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center mx-auto mb-3">
              <Plus className="w-6 h-6 text-violet-400" />
            </div>
            <p className="text-gray-400 text-sm font-medium">No MF transactions yet</p>
            <p className="text-gray-500 text-xs mt-1">Click &quot;Add Transaction&quot; to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Scheme Name</th>
                  <th>Type</th>
                  <th className="text-right">Units</th>
                  <th className="text-right">NAV</th>
                  <th className="text-right">Amount</th>
                  <th>Date</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td className="max-w-xs truncate font-medium text-gray-200">{t.scheme_name}</td>
                    <td>
                      <span className={t.transaction_type === "REDEMPTION" ? "badge-sell" : "badge-purchase"}>
                        {t.transaction_type}
                      </span>
                    </td>
                    <td className="text-right text-gray-300">{t.units ? formatNumber(Number(t.units), 4) : "—"}</td>
                    <td className="text-right text-gray-300">{t.nav ? formatINR(Number(t.nav)) : "—"}</td>
                    <td className="text-right font-medium text-gray-200">{formatINR(Number(t.amount))}</td>
                    <td className="text-gray-400 text-xs">{formatDate(t.transaction_date)}</td>
                    <td className="text-center">
                      <DeleteButton id={t.id} endpoint="/api/delete/mf" itemName={t.scheme_name} />
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