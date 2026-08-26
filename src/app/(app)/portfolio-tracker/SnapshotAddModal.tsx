"use client";

import { useState } from "react";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { Plus, X, Loader2, RefreshCw, CheckCircle } from "lucide-react";
import { formatINR } from "@/lib/utils";

interface Props { onAdded?: () => void; }

export default function SnapshotAddModal({ onAdded }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    snapshot_date: today,
    gold_invested: "", gold_value: "",
    crypto_invested: "", crypto_value: "",
    mf_invested: "", mf_value: "",
    in_stocks_invested: "", in_stocks_value: "",
    us_stocks_invested: "", us_stocks_value: "",
    total_invested: "", total_value: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const n = (v: string) => parseFloat(v) || 0;

  // Auto-compute totals from per-asset fields
  const autoTotalInvested = n(form.gold_invested) + n(form.crypto_invested) + n(form.mf_invested) + n(form.in_stocks_invested) + n(form.us_stocks_invested);
  const autoTotalValue = n(form.gold_value) + n(form.crypto_value) + n(form.mf_value) + n(form.in_stocks_value) + n(form.us_stocks_value);

  const syncInvested = async () => {
    if (!user) return;
    setSyncing(true); setSynced(false); setError("");
    try {
      const uid = user.uid;
      const base = (col: string) => collection(db, "users", uid, col);
      const [goldTx, goldH, cryptoTx, mfTx, stockTx, usTx, settingsSnap] = await Promise.all([
        getDocs(base("gold_transactions")),
        getDocs(base("gold_holdings")),
        getDocs(base("crypto_transactions")),
        getDocs(base("mf_transactions")),
        getDocs(base("stock_transactions")),
        getDocs(base("us_stock_transactions")),
        getDocs(base("settings")),
      ]);
      const settingsDoc = settingsSnap.docs.find(d => d.id === "data");
      const usdToInr = settingsDoc?.data()?.usd_to_inr_rate ?? 83.50;

      const goldInv = goldTx.docs.reduce((s, d) => s + Number(d.data().amount ?? 0), 0)
        + goldH.docs.reduce((s, d) => s + Number(d.data().invested_amount ?? 0), 0);
      const cryptoInv = cryptoTx.docs.reduce((s, d) => {
        const amt = Number(d.data().total_inr ?? 0);
        return d.data().trade_type === "BUY" ? s + amt : s - amt;
      }, 0);
      const mfInv = mfTx.docs.reduce((s, d) => {
        const amt = Number(d.data().amount ?? 0);
        const t = d.data().transaction_type;
        return (t === "REDEMPTION" || t === "REDEEM") ? s - amt : s + amt;
      }, 0);
      const stockInv = stockTx.docs.reduce((s, d) => {
        const val = Number(d.data().value ?? 0);
        return d.data().transaction_type === "BUY" ? s + val : s - val;
      }, 0);
      const usInv = usTx.docs.reduce((s, d) => {
        const amt = Math.abs(Number(d.data().amount ?? 0)) * usdToInr;
        return d.data().side === "buy" ? s + amt : s - amt;
      }, 0);

      setForm(prev => ({
        ...prev,
        gold_invested:      goldInv  > 0 ? goldInv.toFixed(2)  : "",
        crypto_invested:    cryptoInv > 0 ? cryptoInv.toFixed(2) : "",
        mf_invested:        mfInv    > 0 ? mfInv.toFixed(2)    : "",
        in_stocks_invested: stockInv > 0 ? stockInv.toFixed(2) : "",
        us_stocks_invested: usInv    > 0 ? usInv.toFixed(2)    : "",
      }));
      setSynced(true);
    } catch (err) {
      setError(`Sync failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setSyncing(false); }
  };

  const resetForm = () => {
    setForm({ snapshot_date: today, gold_invested: "", gold_value: "", crypto_invested: "", crypto_value: "", mf_invested: "", mf_value: "", in_stocks_invested: "", in_stocks_value: "", us_stocks_invested: "", us_stocks_value: "", total_invested: "", total_value: "" });
    setSynced(false);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(""); setLoading(true);
    try {
      const totalInv = autoTotalInvested;
      const totalVal = autoTotalValue;
      const returnPct = totalInv > 0 ? ((totalVal - totalInv) / totalInv) * 100 : 0;
      const profit = totalVal - totalInv;
      const ret = (inv: number, val: number) => inv > 0 ? ((val - inv) / inv) * 100 : 0;

      await addDoc(collection(db, "users", user.uid, "portfolio_snapshots"), {
        snapshot_date: form.snapshot_date,
        gold_invested: n(form.gold_invested), gold_value: n(form.gold_value), gold_return_pct: ret(n(form.gold_invested), n(form.gold_value)),
        crypto_invested: n(form.crypto_invested), crypto_value: n(form.crypto_value), crypto_return_pct: ret(n(form.crypto_invested), n(form.crypto_value)),
        mf_invested: n(form.mf_invested), mf_value: n(form.mf_value), mf_return_pct: ret(n(form.mf_invested), n(form.mf_value)),
        in_stocks_invested: n(form.in_stocks_invested), in_stocks_value: n(form.in_stocks_value), in_stocks_return_pct: ret(n(form.in_stocks_invested), n(form.in_stocks_value)),
        us_stocks_invested: n(form.us_stocks_invested), us_stocks_value: n(form.us_stocks_value), us_stocks_return_pct: ret(n(form.us_stocks_invested), n(form.us_stocks_value)),
        total_invested: totalInv, total_value: totalVal, total_return_pct: returnPct, profit,
        created_at: new Date().toISOString(),
      });
      setOpen(false);
      resetForm();
      onAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setLoading(false); }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary"><Plus className="w-4 h-4" />Add Snapshot</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setOpen(false); resetForm(); }} />
          <div className="relative glass-card w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Add Portfolio Snapshot</h2>
                <p className="text-xs text-gray-500 mt-0.5">Sync invested amounts, then enter current market values</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Date + Sync row */}
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="form-label">Snapshot Date *</label>
                  <input type="date" name="snapshot_date" className="form-input" value={form.snapshot_date} onChange={handleChange} required />
                </div>
                <button type="button" onClick={syncInvested} disabled={syncing}
                  className="btn-secondary gap-2 whitespace-nowrap h-[38px]">
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {syncing ? "Syncing…" : "Sync Invested"}
                </button>
              </div>

              {synced && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                  <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  Invested amounts synced from your transactions. Now enter the current market value for each asset.
                </div>
              )}

              {/* Per-asset rows: Invested (synced/editable) | Current Value (user enters) */}
              <div>
                <div className="grid grid-cols-3 gap-2 mb-1.5">
                  <span className="text-xs text-gray-600 uppercase tracking-wider">Asset</span>
                  <span className="text-xs text-gray-600 uppercase tracking-wider">Invested (₹) *</span>
                  <span className="text-xs text-gray-600 uppercase tracking-wider">Current Value (₹)</span>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "Gold",          inv: "gold_invested",      val: "gold_value",      color: "text-yellow-400" },
                    { label: "Crypto",         inv: "crypto_invested",    val: "crypto_value",    color: "text-orange-400" },
                    { label: "Mutual Funds",   inv: "mf_invested",        val: "mf_value",        color: "text-violet-400" },
                    { label: "Indian Stocks",  inv: "in_stocks_invested", val: "in_stocks_value", color: "text-emerald-400" },
                    { label: "US Stocks (₹)", inv: "us_stocks_invested", val: "us_stocks_value", color: "text-blue-400" },
                  ].map((asset) => (
                    <div key={asset.label} className="grid grid-cols-3 gap-2 items-center">
                      <span className={`text-sm font-medium ${asset.color}`}>{asset.label}</span>
                      <input type="number" name={asset.inv} className="form-input text-sm bg-gray-800/80" placeholder="0.00"
                        step="0.01" value={form[asset.inv as keyof typeof form]} onChange={handleChange} />
                      <input type="number" name={asset.val} className="form-input text-sm" placeholder="Enter value"
                        step="0.01" value={form[asset.val as keyof typeof form]} onChange={handleChange} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Auto-computed totals preview */}
              <div className="grid grid-cols-3 gap-3 bg-gray-800/40 rounded-lg p-3 border border-gray-700/40">
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-0.5">Total Invested</p>
                  <p className="text-sm font-bold text-white">{formatINR(autoTotalInvested)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-0.5">Total Value</p>
                  <p className="text-sm font-bold text-emerald-400">{formatINR(autoTotalValue)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-0.5">Return</p>
                  <p className={`text-sm font-bold ${autoTotalValue >= autoTotalInvested ? "text-emerald-400" : "text-red-400"}`}>
                    {autoTotalInvested > 0 ? `${(((autoTotalValue - autoTotalInvested) / autoTotalInvested) * 100).toFixed(2)}%` : "—"}
                  </p>
                </div>
              </div>

              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">{error}</div>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? "Saving…" : "Save Snapshot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
