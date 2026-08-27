"use client";

import { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { Plus, X, Loader2 } from "lucide-react";

interface Props { onAdded?: () => void; }

export default function CryptoAddHoldingModal({ onAdded }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    coin_name: "",
    invested_amount: "",
    avg_buy_price: "",
    quantity: "",
    record_date: new Date().toISOString().slice(0, 10),
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };
      // Auto-compute invested_amount = avg_buy_price × quantity
      if (name === "avg_buy_price" || name === "quantity") {
        const price = parseFloat(name === "avg_buy_price" ? value : prev.avg_buy_price);
        const qty = parseFloat(name === "quantity" ? value : prev.quantity);
        if (!isNaN(price) && !isNaN(qty)) updated.invested_amount = (price * qty).toFixed(2);
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(""); setLoading(true);
    try {
      await addDoc(collection(db, "users", user.uid, "crypto_holdings"), {
        coin_name: form.coin_name.trim().toUpperCase(),
        invested_amount: parseFloat(form.invested_amount),
        avg_buy_price: parseFloat(form.avg_buy_price),
        quantity: parseFloat(form.quantity),
        record_date: form.record_date,
        created_at: new Date().toISOString(),
      });
      setOpen(false);
      setForm({ coin_name: "", invested_amount: "", avg_buy_price: "", quantity: "", record_date: new Date().toISOString().slice(0, 10) });
      onAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setLoading(false); }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary">
        <Plus className="w-4 h-4" />Add Holding
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative glass-card w-full max-w-md p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-white">Add Crypto Holding</h2>
                <p className="text-xs text-gray-500 mt-0.5">Manually record a coin holding</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="form-label">Coin / Asset Name *</label>
                <input name="coin_name" className="form-input font-mono uppercase" placeholder="BTC, ETH, SOL…"
                  value={form.coin_name} onChange={handleChange} required />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="form-label">Avg Buy Price (₹) *</label>
                  <input type="number" name="avg_buy_price" className="form-input" placeholder="e.g. 4500000"
                    step="0.01" min="0" value={form.avg_buy_price} onChange={handleChange} required />
                </div>
                <div>
                  <label className="form-label">Quantity *</label>
                  <input type="number" name="quantity" className="form-input" placeholder="e.g. 0.00500000"
                    step="0.00000001" min="0" value={form.quantity} onChange={handleChange} required />
                </div>
              </div>
              <div>
                <label className="form-label">Invested Amount (₹) *</label>
                <input type="number" name="invested_amount" className="form-input" placeholder="Auto-calculated"
                  step="0.01" min="0" value={form.invested_amount} onChange={handleChange} required />
                <p className="text-xs text-gray-600 mt-1">Auto-filled from Avg Price × Quantity — editable</p>
              </div>
              <div>
                <label className="form-label">Record Date *</label>
                <input type="date" name="record_date" className="form-input"
                  value={form.record_date} onChange={handleChange} required />
              </div>
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">{error}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? "Saving…" : "Save Holding"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}