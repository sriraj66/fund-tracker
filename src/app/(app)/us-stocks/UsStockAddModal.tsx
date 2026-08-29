"use client";

import { useState } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { Plus, X, Loader2 } from "lucide-react";

interface Props { onAdded?: () => void; }

export default function UsStockAddModal({ onAdded }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useScrollLock(open);

  const [form, setForm] = useState({
    symbol: "",
    description: "",
    side: "buy",
    quantity: "",
    price: "",
    amount: "",
    transaction_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(""); setLoading(true);
    try {
      const qty = parseFloat(form.quantity);
      const price = form.price ? parseFloat(form.price) : null;
      const amount = form.amount ? parseFloat(form.amount) : (price && qty ? price * qty : null);
      await addDoc(collection(db, "users", user.uid, "us_stock_transactions"), {
        symbol: form.symbol.trim().toUpperCase(),
        description: form.description.trim() || null,
        side: form.side,
        quantity: qty,
        price,
        amount,
        transaction_date: form.transaction_date,
        notes: form.notes || null,
        created_at: new Date().toISOString(),
      });
      setOpen(false);
      setForm({ symbol: "", description: "", side: "buy", quantity: "", price: "", amount: "", transaction_date: new Date().toISOString().slice(0, 10), notes: "" });
      onAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setLoading(false); }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary"><Plus className="w-4 h-4" />Add Trade</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full sm:max-w-lg bg-gray-900/95 backdrop-blur-sm border border-gray-800/60 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto overscroll-contain">
            <div className="sm:hidden flex justify-center mb-3 -mt-1">
              <div className="w-10 h-1 rounded-full bg-gray-700" />
            </div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Add US Stock Trade</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><label className="form-label">Symbol *</label><input name="symbol" className="form-input" placeholder="AAPL" value={form.symbol} onChange={handleChange} required /></div>
                <div><label className="form-label">Side *</label><select name="side" className="form-input" value={form.side} onChange={handleChange}><option value="buy">BUY</option><option value="sell">SELL</option></select></div>
              </div>
              <div><label className="form-label">Description</label><input name="description" className="form-input" placeholder="Apple Inc." value={form.description} onChange={handleChange} /></div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><label className="form-label">Shares *</label><input type="number" inputMode="decimal" name="quantity" className="form-input" placeholder="1.0" step="0.000001" min="0" value={form.quantity} onChange={handleChange} required /></div>
                <div><label className="form-label">Price (USD)</label><input type="number" inputMode="decimal" name="price" className="form-input" placeholder="185.00" step="0.01" value={form.price} onChange={handleChange} /></div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><label className="form-label">Amount (USD)</label><input type="number" inputMode="decimal" name="amount" className="form-input" placeholder="185.00" step="0.01" value={form.amount} onChange={handleChange} /></div>
                <div><label className="form-label">Date *</label><input type="date" name="transaction_date" className="form-input min-w-0" value={form.transaction_date} onChange={handleChange} required /></div>
              </div>
              <div><label className="form-label">Notes</label><textarea name="notes" className="form-input resize-none" rows={2} value={form.notes} onChange={handleChange} /></div>
              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">{error}</div>}
              <div className="flex gap-3 pt-2 pb-4">
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
