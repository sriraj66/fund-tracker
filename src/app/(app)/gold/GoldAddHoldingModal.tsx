"use client";

import { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { Plus, X, Loader2 } from "lucide-react";

interface Props { onAdded?: () => void; }

export default function GoldAddHoldingModal({ onAdded }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    gold_purity: "22K",
    grams: "",
    invested_amount: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(""); setLoading(true);
    try {
      await addDoc(collection(db, "users", user.uid, "gold_holdings"), {
        gold_purity: form.gold_purity,
        grams: parseFloat(form.grams),
        invested_amount: parseFloat(form.invested_amount),
        created_at: new Date().toISOString(),
      });
      setOpen(false);
      setForm({ gold_purity: "22K", grams: "", invested_amount: "" });
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
          <div className="relative glass-card w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Add Gold Holding</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="form-label">Gold Purity *</label>
                <select name="gold_purity" className="form-input" value={form.gold_purity} onChange={handleChange}>
                  <option value="22K">22K</option>
                  <option value="24K">24K</option>
                </select>
              </div>
              <div>
                <label className="form-label">Grams *</label>
                <input
                  type="number" name="grams" className="form-input"
                  placeholder="e.g. 10.5000" step="0.0001" min="0"
                  value={form.grams} onChange={handleChange} required
                />
              </div>
              <div>
                <label className="form-label">Invested Amount (₹) *</label>
                <input
                  type="number" name="invested_amount" className="form-input"
                  placeholder="e.g. 75000.00" step="0.01" min="0"
                  value={form.invested_amount} onChange={handleChange} required
                />
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