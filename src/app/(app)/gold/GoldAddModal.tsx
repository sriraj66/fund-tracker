"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, X, Loader2 } from "lucide-react";

interface Props {
  userId: string;
}

export default function GoldAddModal({ userId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    purchase_date: new Date().toISOString().split("T")[0],
    price_per_gram: "",
    grams: "",
    amount: "",
    gold_type: "24K",
    notes: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };

      // Auto-calc amount from grams × price_per_gram
      if (name === "grams" || name === "price_per_gram") {
        const g = parseFloat(name === "grams" ? value : prev.grams);
        const p = parseFloat(name === "price_per_gram" ? value : prev.price_per_gram);
        if (!isNaN(g) && !isNaN(p)) {
          updated.amount = (g * p).toFixed(2);
        }
      }

      // Auto-calc grams from amount ÷ price_per_gram
      if (name === "amount" && prev.price_per_gram) {
        const a = parseFloat(value);
        const p = parseFloat(prev.price_per_gram);
        if (!isNaN(a) && !isNaN(p) && p > 0) {
          updated.grams = (a / p).toFixed(4);
        }
      }

      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const grams = parseFloat(form.grams);
    const price_per_gram = parseFloat(form.price_per_gram);
    const amount = parseFloat(form.amount);

    if (isNaN(grams) || grams <= 0) {
      setError("Grams must be a positive number.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("gold_transactions").insert({
      user_id: userId,
      purchase_date: form.purchase_date,
      price_per_gram,
      grams,
      amount,
      gold_type: form.gold_type,
      notes: form.notes || null,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setOpen(false);
      setForm({
        purchase_date: new Date().toISOString().split("T")[0],
        price_per_gram: "",
        grams: "",
        amount: "",
        gold_type: "24K",
        notes: "",
      });
      router.refresh();
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="w-4 h-4" />
        Add Purchase
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative glass-card w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Add Gold Purchase</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Purchase Date *</label>
                  <input
                    type="date"
                    name="purchase_date"
                    className="form-input"
                    value={form.purchase_date}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Gold Type *</label>
                  <select
                    name="gold_type"
                    className="form-input"
                    value={form.gold_type}
                    onChange={handleChange}
                  >
                    <option value="24K">24K (Pure)</option>
                    <option value="22K">22K</option>
                    <option value="18K">18K</option>
                    <option value="Digital">Digital Gold</option>
                    <option value="SGB">Sovereign Gold Bond</option>
                    <option value="ETF">Gold ETF</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Price per Gram (₹) *</label>
                <input
                  type="number"
                  name="price_per_gram"
                  className="form-input"
                  placeholder="7500.00"
                  step="0.01"
                  min="0"
                  value={form.price_per_gram}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Grams</label>
                  <input
                    type="number"
                    name="grams"
                    className="form-input"
                    placeholder="2.0"
                    step="0.0001"
                    min="0"
                    value={form.grams}
                    onChange={handleChange}
                  />
                  <p className="text-xs text-gray-500 mt-1">Auto-calc from amount ÷ price</p>
                </div>
                <div>
                  <label className="form-label">Total Amount (₹) *</label>
                  <input
                    type="number"
                    name="amount"
                    className="form-input"
                    placeholder="15000.00"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={handleChange}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Auto-calc from grams × price</p>
                </div>
              </div>

              {/* Live preview */}
              {form.grams && form.price_per_gram && (
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-4 py-3">
                  <p className="text-xs text-gray-400">Summary</p>
                  <p className="text-sm text-yellow-300 font-medium mt-1">
                    {form.grams}g × ₹{form.price_per_gram}/g ={" "}
                    <span className="text-yellow-400 font-bold">₹{form.amount}</span>
                  </p>
                </div>
              )}

              <div>
                <label className="form-label">Notes</label>
                <textarea
                  name="notes"
                  className="form-input resize-none"
                  rows={2}
                  placeholder="e.g. Tanishq jewellery, digital gold via Paytm…"
                  value={form.notes}
                  onChange={handleChange}
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-secondary flex-1 justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex-1 justify-center"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? "Saving…" : "Save Purchase"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}