"use client";

import { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { Plus, X, Loader2 } from "lucide-react";

interface Props { onAdded?: () => void; }

export default function CryptoAddModal({ onAdded }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    market: "",
    trade_type: "BUY",
    price: "",
    volume: "",
    total_inr: "",
    tds_amount: "0",
    fee_amount: "0",
    transaction_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const extractCoin = (market: string) => {
    const m = market.toUpperCase().replace(/INR$/, "").replace(/USDT$/, "").replace(/BTC$/, "");
    return m || market.toUpperCase();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(""); setLoading(true);
    try {
      await addDoc(collection(db, "users", user.uid, "crypto_transactions"), {
        market: form.market.trim().toUpperCase(),
        coin: extractCoin(form.market.trim()),
        trade_type: form.trade_type,
        price: form.price ? parseFloat(form.price) : null,
        volume: form.volume ? parseFloat(form.volume) : null,
        total_inr: form.total_inr ? parseFloat(form.total_inr) : null,
        tds_amount: parseFloat(form.tds_amount) || 0,
        fee_amount: parseFloat(form.fee_amount) || 0,
        transaction_date: form.transaction_date,
        notes: form.notes || null,
        created_at: new Date().toISOString(),
      });
      setOpen(false);
      setForm({ market: "", trade_type: "BUY", price: "", volume: "", total_inr: "", tds_amount: "0", fee_amount: "0", transaction_date: new Date().toISOString().slice(0, 10), notes: "" });
      onAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setLoading(false); }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary"><Plus className="w-4 h-4" />Add Trade</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative glass-card w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Add Crypto Trade</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="form-label">Market * (e.g. BTCINR)</label><input name="market" className="form-input" placeholder="BTCINR" value={form.market} onChange={handleChange} required /></div>
                <div><label className="form-label">Trade Type *</label><select name="trade_type" className="form-input" value={form.trade_type} onChange={handleChange}><option value="BUY">BUY</option><option value="SELL">SELL</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="form-label">Price (INR)</label><input type="number" name="price" className="form-input" placeholder="6410689.81" step="0.01" value={form.price} onChange={handleChange} /></div>
                <div><label className="form-label">Volume (coins)</label><input type="number" name="volume" className="form-input" placeholder="0.00002" step="any" value={form.volume} onChange={handleChange} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="form-label">Total (INR) *</label><input type="number" name="total_inr" className="form-input" placeholder="140.33" step="0.01" value={form.total_inr} onChange={handleChange} required /></div>
                <div><label className="form-label">Date *</label><input type="date" name="transaction_date" className="form-input" value={form.transaction_date} onChange={handleChange} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="form-label">TDS Amount (INR)</label><input type="number" name="tds_amount" className="form-input" placeholder="0" step="0.01" value={form.tds_amount} onChange={handleChange} /></div>
                <div><label className="form-label">Fee Amount (INR)</label><input type="number" name="fee_amount" className="form-input" placeholder="0" step="0.01" value={form.fee_amount} onChange={handleChange} /></div>
              </div>
              <div><label className="form-label">Notes</label><textarea name="notes" className="form-input resize-none" rows={2} value={form.notes} onChange={handleChange} /></div>
              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">{loading && <Loader2 className="w-4 h-4 animate-spin" />}{loading ? "Saving…" : "Save Trade"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}