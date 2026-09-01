"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { Plus, X, Loader2 } from "lucide-react";
import { useScrollLock } from "@/hooks/useScrollLock";

interface Props { onAdded?: () => void; }

export default function GoldAddModal({ onAdded }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useScrollLock(open);
  const [form, setForm] = useState({
    purchase_date: new Date().toISOString().slice(0, 10),
    gold_type: "Digital Gold",
    grams: "",
    price_per_gram: "",
    amount: "",
    notes: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === "grams" || name === "price_per_gram") {
        const g = parseFloat(name === "grams" ? value : prev.grams);
        const p = parseFloat(name === "price_per_gram" ? value : prev.price_per_gram);
        if (!isNaN(g) && !isNaN(p)) updated.amount = (g * p).toFixed(2);
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(""); setLoading(true);
    try {
      const grams = parseFloat(form.grams);
      const pricePerGram = parseFloat(form.price_per_gram);
      const amount = parseFloat(form.amount);
      await addDoc(collection(db, "users", user.uid, "gold_transactions"), {
        purchase_date: form.purchase_date,
        gold_type: form.gold_type,
        grams, price_per_gram: pricePerGram, amount,
        notes: form.notes || null,
        created_at: new Date().toISOString(),
      });
      setOpen(false);
      setForm({ purchase_date: new Date().toISOString().slice(0, 10), gold_type: "Digital Gold", grams: "", price_per_gram: "", amount: "", notes: "" });
      onAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setLoading(false); }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary"><Plus className="w-4 h-4" />Add Purchase</button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-none sm:max-w-lg bg-gray-900/95 backdrop-blur-sm border border-gray-800/60 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto overflow-x-hidden overscroll-contain">
            <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-4 sm:hidden" />
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Add Gold Purchase</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 min-w-0">
              <div>
                <label className="form-label">Purchase Date *</label>
                <input type="date" name="purchase_date" className="form-input" value={form.purchase_date} onChange={handleChange} required />
              </div>
              <div><label className="form-label">Gold Type *</label><select name="gold_type" className="form-input" value={form.gold_type} onChange={handleChange}><option>Digital Gold</option><option>Physical Gold</option><option>Sovereign Gold Bond</option><option>Gold ETF</option><option>Gold MF</option></select></div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><label className="form-label">Grams *</label><input type="number" name="grams" className="form-input" placeholder="1.0000" step="0.0001" min="0" inputMode="decimal" value={form.grams} onChange={handleChange} required /></div>
                <div><label className="form-label">Price per gram (₹) *</label><input type="number" name="price_per_gram" className="form-input" placeholder="7500.00" step="0.01" min="0" inputMode="decimal" value={form.price_per_gram} onChange={handleChange} required /></div>
              </div>
              <div><label className="form-label">Total Amount (₹) *</label><input type="number" name="amount" className="form-input" placeholder="Auto-calculated" step="0.01" min="0" inputMode="decimal" value={form.amount} onChange={handleChange} required /></div>
              <div><label className="form-label">Notes</label><textarea name="notes" className="form-input resize-none" rows={2} value={form.notes} onChange={handleChange} /></div>
              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">{error}</div>}
              <div className="flex gap-3 pt-2 pb-4">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">{loading && <Loader2 className="w-4 h-4 animate-spin" />}{loading ? "Saving…" : "Save Purchase"}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
