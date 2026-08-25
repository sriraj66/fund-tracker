"use client";

import { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { Plus, X, Loader2 } from "lucide-react";

interface Props { onAdded?: () => void; }

export default function SnapshotAddModal({ onAdded }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(""); setLoading(true);
    try {
      const totalInv = n(form.total_invested) || (n(form.gold_invested) + n(form.crypto_invested) + n(form.mf_invested) + n(form.in_stocks_invested) + n(form.us_stocks_invested));
      const totalVal = n(form.total_value) || (n(form.gold_value) + n(form.crypto_value) + n(form.mf_value) + n(form.in_stocks_value) + n(form.us_stocks_value));
      const returnPct = totalInv > 0 ? ((totalVal - totalInv) / totalInv) * 100 : 0;
      const profit = totalVal - totalInv;

      await addDoc(collection(db, "users", user.uid, "portfolio_snapshots"), {
        snapshot_date: form.snapshot_date,
        gold_invested: n(form.gold_invested), gold_value: n(form.gold_value), gold_return_pct: n(form.gold_invested) > 0 ? ((n(form.gold_value) - n(form.gold_invested)) / n(form.gold_invested)) * 100 : 0,
        crypto_invested: n(form.crypto_invested), crypto_value: n(form.crypto_value), crypto_return_pct: n(form.crypto_invested) > 0 ? ((n(form.crypto_value) - n(form.crypto_invested)) / n(form.crypto_invested)) * 100 : 0,
        mf_invested: n(form.mf_invested), mf_value: n(form.mf_value), mf_return_pct: n(form.mf_invested) > 0 ? ((n(form.mf_value) - n(form.mf_invested)) / n(form.mf_invested)) * 100 : 0,
        in_stocks_invested: n(form.in_stocks_invested), in_stocks_value: n(form.in_stocks_value), in_stocks_return_pct: n(form.in_stocks_invested) > 0 ? ((n(form.in_stocks_value) - n(form.in_stocks_invested)) / n(form.in_stocks_invested)) * 100 : 0,
        us_stocks_invested: n(form.us_stocks_invested), us_stocks_value: n(form.us_stocks_value), us_stocks_return_pct: n(form.us_stocks_invested) > 0 ? ((n(form.us_stocks_value) - n(form.us_stocks_invested)) / n(form.us_stocks_invested)) * 100 : 0,
        total_invested: totalInv, total_value: totalVal, total_return_pct: returnPct, profit,
        created_at: new Date().toISOString(),
      });
      setOpen(false);
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
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative glass-card w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Add Portfolio Snapshot</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="form-label">Snapshot Date *</label><input type="date" name="snapshot_date" className="form-input" value={form.snapshot_date} onChange={handleChange} required /></div>
              <div className="space-y-3">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Asset Values (₹)</p>
                {[
                  { label: "Gold", inv: "gold_invested", val: "gold_value" },
                  { label: "Crypto", inv: "crypto_invested", val: "crypto_value" },
                  { label: "Mutual Funds", inv: "mf_invested", val: "mf_value" },
                  { label: "Indian Stocks", inv: "in_stocks_invested", val: "in_stocks_value" },
                  { label: "US Stocks", inv: "us_stocks_invested", val: "us_stocks_value" },
                ].map((asset) => (
                  <div key={asset.label} className="grid grid-cols-3 gap-2 items-center">
                    <span className="text-gray-400 text-sm">{asset.label}</span>
                    <input type="number" name={asset.inv} className="form-input text-sm" placeholder="Invested" step="0.01" value={form[asset.inv as keyof typeof form]} onChange={handleChange} />
                    <input type="number" name={asset.val} className="form-input text-sm" placeholder="Current Value" step="0.01" value={form[asset.val as keyof typeof form]} onChange={handleChange} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-gray-800/60 pt-4">
                <div><label className="form-label">Total Invested (₹)</label><input type="number" name="total_invested" className="form-input" placeholder="Auto-sum if blank" step="0.01" value={form.total_invested} onChange={handleChange} /></div>
                <div><label className="form-label">Total Value (₹)</label><input type="number" name="total_value" className="form-input" placeholder="Auto-sum if blank" step="0.01" value={form.total_value} onChange={handleChange} /></div>
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">{loading && <Loader2 className="w-4 h-4 animate-spin" />}{loading ? "Saving…" : "Save Snapshot"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
