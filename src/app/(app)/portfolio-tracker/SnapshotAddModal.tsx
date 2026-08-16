"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Plus, Calendar, RefreshCw } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface SnapshotAddModalProps {
  userId: string;
}

export default function SnapshotAddModal({ userId }: SnapshotAddModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    snapshot_date: new Date().toISOString().split("T")[0],
    gold_invested: "",
    gold_value: "",
    gold_return_pct: "",
    crypto_invested: "",
    crypto_value: "",
    crypto_return_pct: "",
    mf_invested: "",
    mf_value: "",
    mf_return_pct: "",
    in_stocks_invested: "",
    in_stocks_value: "",
    in_stocks_return_pct: "",
    us_stocks_invested: "",
    us_stocks_value: "",
    us_stocks_return_pct: "",
    notes: "",
  });

  const totals = useMemo(() => {
    const goldInv = parseFloat(formData.gold_invested) || 0;
    const goldVal = parseFloat(formData.gold_value) || 0;
    const cryptoInv = parseFloat(formData.crypto_invested) || 0;
    const cryptoVal = parseFloat(formData.crypto_value) || 0;
    const mfInv = parseFloat(formData.mf_invested) || 0;
    const mfVal = parseFloat(formData.mf_value) || 0;
    const inStocksInv = parseFloat(formData.in_stocks_invested) || 0;
    const inStocksVal = parseFloat(formData.in_stocks_value) || 0;
    const usStocksInv = parseFloat(formData.us_stocks_invested) || 0;
    const usStocksVal = parseFloat(formData.us_stocks_value) || 0;

    const totalInv = goldInv + cryptoInv + mfInv + inStocksInv + usStocksInv;
    const totalVal = goldVal + cryptoVal + mfVal + inStocksVal + usStocksVal;
    const profit = totalVal - totalInv;
    const returnPct = totalInv > 0 ? ((totalVal - totalInv) / totalInv) * 100 : 0;

    return { totalInv, totalVal, profit, returnPct };
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const supabase = createClient();

      const {error: dbError} = await supabase.from("portfolio_snapshots").upsert([
        {
          user_id: userId,
          snapshot_date: formData.snapshot_date,
          gold_invested: parseFloat(formData.gold_invested) || 0,
          gold_value: parseFloat(formData.gold_value) || 0,
          gold_return_pct: parseFloat(formData.gold_return_pct) || 0,
          crypto_invested: parseFloat(formData.crypto_invested) || 0,
          crypto_value: parseFloat(formData.crypto_value) || 0,
          crypto_return_pct: parseFloat(formData.crypto_return_pct) || 0,
          mf_invested: parseFloat(formData.mf_invested) || 0,
          mf_value: parseFloat(formData.mf_value) || 0,
          mf_return_pct: parseFloat(formData.mf_return_pct) || 0,
          in_stocks_invested: parseFloat(formData.in_stocks_invested) || 0,
          in_stocks_value: parseFloat(formData.in_stocks_value) || 0,
          in_stocks_return_pct: parseFloat(formData.in_stocks_return_pct) || 0,
          us_stocks_invested: parseFloat(formData.us_stocks_invested) || 0,
          us_stocks_value: parseFloat(formData.us_stocks_value) || 0,
          us_stocks_return_pct: parseFloat(formData.us_stocks_return_pct) || 0,
          total_invested: totals.totalInv,
          total_value: totals.totalVal,
          total_return_pct: totals.returnPct,
          profit: totals.profit,
          notes: formData.notes || null,
        },
      ]);

      if (dbError) {
        setError(dbError.message);
      } else {
        router.refresh();
        setOpen(false);
        setFormData({
          snapshot_date: new Date().toISOString().split("T")[0],
          gold_invested: "",
          gold_value: "",
          gold_return_pct: "",
          crypto_invested: "",
          crypto_value: "",
          crypto_return_pct: "",
          mf_invested: "",
          mf_value: "",
          mf_return_pct: "",
          in_stocks_invested: "",
          in_stocks_value: "",
          in_stocks_return_pct: "",
          us_stocks_invested: "",
          us_stocks_value: "",
          us_stocks_return_pct: "",
          notes: "",
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const loadCurrentPortfolio = async () => {
    setIsLoading(true);
    setError("");
    
    try {
      const supabase = createClient();

      const [mfRes, stockRes, usRes, cryptoRes, goldRes, settingsRes] = await Promise.all([
        supabase.from("mf_transactions").select("amount, transaction_type").eq("user_id", userId),
        supabase.from("stock_transactions").select("value, transaction_type").eq("user_id", userId),
        supabase.from("us_stock_transactions").select("amount, side").eq("user_id", userId),
        supabase.from("crypto_transactions").select("total_inr, trade_type").eq("user_id", userId),
        supabase.from("gold_transactions").select("amount").eq("user_id", userId),
        supabase.from("user_settings").select("usd_to_inr_rate").eq("user_id", userId).single(),
      ]);

      const usdToInr = settingsRes.data?.usd_to_inr_rate || 83.50;

      const mfBought = (mfRes.data ?? [])
        .filter((t) => t.transaction_type !== "REDEMPTION")
        .reduce((s, t) => s + Number(t.amount), 0);
      const mfRedeemed = (mfRes.data ?? [])
        .filter((t) => t.transaction_type === "REDEMPTION")
        .reduce((s, t) => s + Number(t.amount), 0);
      const mfNet = mfBought - mfRedeemed;

      const stockBought = (stockRes.data ?? [])
        .filter((t) => t.transaction_type === "BUY")
        .reduce((s, t) => s + Number(t.value), 0);
      const stockSold = (stockRes.data ?? [])
        .filter((t) => t.transaction_type === "SELL")
        .reduce((s, t) => s + Number(t.value), 0);
      const stockNet = stockBought - stockSold;

      const usBought = (usRes.data ?? [])
        .filter((t) => t.side === "buy")
        .reduce((s, t) => s + Math.abs(Number(t.amount ?? 0)), 0);
      const usSold = (usRes.data ?? [])
        .filter((t) => t.side === "sell")
        .reduce((s, t) => s + Math.abs(Number(t.amount ?? 0)), 0);
      const usNetUSD = usBought - usSold;
      const usNetINR = usNetUSD * usdToInr;

      const cryptoBought = (cryptoRes.data ?? [])
        .filter((t) => t.trade_type === "BUY")
        .reduce((s, t) => s + Number(t.total_inr ?? 0), 0);
      const cryptoSold = (cryptoRes.data ?? [])
        .filter((t) => t.trade_type === "SELL")
        .reduce((s, t) => s + Number(t.total_inr ?? 0), 0);
      const cryptoNet = cryptoBought - cryptoSold;

      const goldTotal = (goldRes.data ?? []).reduce((s, t) => s + Number(t.amount), 0);

      setFormData((prev) => ({
        ...prev,
        gold_invested: goldTotal.toFixed(2),
        gold_value: goldTotal.toFixed(2),
        crypto_invested: cryptoNet.toFixed(2),
        crypto_value: cryptoNet.toFixed(2),
        mf_invested: mfNet.toFixed(2),
        mf_value: mfNet.toFixed(2),
        in_stocks_invested: stockNet.toFixed(2),
        in_stocks_value: stockNet.toFixed(2),
        us_stocks_invested: usNetINR.toFixed(2),
        us_stocks_value: usNetINR.toFixed(2),
      }));

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load portfolio data");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="w-4 h-4" />
        Add Snapshot
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => !isSubmitting && setOpen(false)}
          />
          <div className="relative bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-6xl my-8 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-800/80">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Add Portfolio Snapshot</h2>
                  <p className="text-sm text-gray-400">Manually enter monthly portfolio data</p>
                </div>
              </div>
              <button
                onClick={() => !isSubmitting && setOpen(false)}
                className="text-gray-500 hover:text-gray-300 transition-colors p-2 hover:bg-gray-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Snapshot Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.snapshot_date}
                    onChange={(e) => handleChange("snapshot_date", e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <button
                    type="button"
                    onClick={loadCurrentPortfolio}
                    disabled={isLoading || isSubmitting}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 text-sky-400 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading Portfolio...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Load Current Portfolio
                      </>
                    )}
                  </button>
                  <p className="text-xs text-gray-500 mt-1.5">
                    Auto-fill invested amounts from transactions
                  </p>
                </div>
              </div>

              <div className="flex items-end">
                <div className="glass-card p-4 w-full border border-sky-500/20">
                  <div className="text-xs text-gray-400 mb-1">Preview Totals</div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">{formatINR(totals.totalVal)}</div>
                      <div className="text-xs text-gray-500">Total Value</div>
                    </div>
                    <div className={`text-right ${totals.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      <div className="text-sm font-semibold">{formatINR(totals.profit)}</div>
                      <div className="text-xs">{totals.returnPct.toFixed(2)}%</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <AssetColumn
                  title="Gold"
                  color="yellow"
                  formData={formData}
                  handleChange={handleChange}
                  prefix="gold"
                />
                <AssetColumn
                  title="Crypto"
                  color="orange"
                  formData={formData}
                  handleChange={handleChange}
                  prefix="crypto"
                />
                <AssetColumn
                  title="Mutual Funds"
                  color="violet"
                  formData={formData}
                  handleChange={handleChange}
                  prefix="mf"
                />
                <AssetColumn
                  title="IN Stocks"
                  color="emerald"
                  formData={formData}
                  handleChange={handleChange}
                  prefix="in_stocks"
                />
                <AssetColumn
                  title="US Stocks"
                  color="blue"
                  formData={formData}
                  handleChange={handleChange}
                  prefix="us_stocks"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
                  rows={2}
                  placeholder="Any additional notes about this snapshot..."
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <span className="font-medium">Error:</span> {error}
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-800">
                <button type="submit" disabled={isSubmitting} className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving Snapshot...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Save Snapshot
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => !isSubmitting && setOpen(false)}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-lg transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

interface AssetColumnProps {
  title: string;
  color: string;
  formData: Record<string, string>;
  handleChange: (field: string, value: string) => void;
  prefix: string;
}

function AssetColumn({ title, color, formData, handleChange, prefix }: AssetColumnProps) {
  const colorMap = {
    yellow: { bg: "bg-yellow-500", border: "border-yellow-500/30", text: "text-yellow-400", ring: "focus:ring-yellow-500/50" },
    orange: { bg: "bg-orange-500", border: "border-orange-500/30", text: "text-orange-400", ring: "focus:ring-orange-500/50" },
    violet: { bg: "bg-violet-500", border: "border-violet-500/30", text: "text-violet-400", ring: "focus:ring-violet-500/50" },
    emerald: { bg: "bg-emerald-500", border: "border-emerald-500/30", text: "text-emerald-400", ring: "focus:ring-emerald-500/50" },
    blue: { bg: "bg-blue-500", border: "border-blue-500/30", text: "text-blue-400", ring: "focus:ring-blue-500/50" },
  };

  const c = colorMap[color as keyof typeof colorMap];

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 pb-2 border-b ${c.border}`}>
        <div className={`w-3 h-3 rounded-full ${c.bg}`}></div>
        <h3 className={`text-sm font-bold ${c.text} uppercase tracking-wide`}>{title}</h3>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">Invested (₹)</label>
        <input
          type="number"
          step="0.01"
          value={formData[`${prefix}_invested`]}
          onChange={(e) => handleChange(`${prefix}_invested`, e.target.value)}
          className={`w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 ${c.ring} focus:border-transparent transition-all`}
          placeholder="0.00"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">Value (₹)</label>
        <input
          type="number"
          step="0.01"
          value={formData[`${prefix}_value`]}
          onChange={(e) => handleChange(`${prefix}_value`, e.target.value)}
          className={`w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 ${c.ring} focus:border-transparent transition-all`}
          placeholder="0.00"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">Return %</label>
        <input
          type="number"
          step="0.01"
          value={formData[`${prefix}_return_pct`]}
          onChange={(e) => handleChange(`${prefix}_return_pct`, e.target.value)}
          className={`w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 ${c.ring} focus:border-transparent transition-all`}
          placeholder="0.00"
        />
      </div>
    </div>
  );
}
