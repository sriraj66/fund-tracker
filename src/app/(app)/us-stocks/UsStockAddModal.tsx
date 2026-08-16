"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, X, Loader2 } from "lucide-react";

interface Props {
  userId: string;
}

export default function UsStockAddModal({ userId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    symbol: "",
    description: "",
    side: "buy",
    quantity: "",
    price: "",
    amount: "",
    transaction_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === "quantity" || name === "price") {
        const q = parseFloat(name === "quantity" ? value : prev.quantity);
        const p = parseFloat(name === "price" ? value : prev.price);
        if (!isNaN(q) && !isNaN(p)) {
          updated.amount = (q * p).toFixed(4);
        }
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.from("us_stock_transactions").insert({
      user_id: userId,
      symbol: form.symbol.trim().toUpperCase(),
      description: form.description || null,
      side: form.side,
      quantity: parseFloat(form.quantity),
      price: form.price ? parseFloat(form.price) : null,
      amount: form.amount ? parseFloat(form.amount) : null,
      transaction_date: form.transaction_date,
      notes: form.notes || null,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setOpen(false);
      setForm({
        symbol: "",
        description: "",
        side: "buy",
        quantity: "",
        price: "",
        amount: "",
        transaction_date: new Date().toISOString().split("T")[0],
        notes: "",
      });
      router.refresh();
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="w-4 h-4" />
        Add Trade
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative glass-card w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Add US Stock Trade</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Symbol *</label>
                  <input
                    name="symbol"
                    className="form-input uppercase"
                    placeholder="AAPL"
                    value={form.symbol}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Side *</label>
                  <select name="side" className="form-input" value={form.side} onChange={handleChange}>
                    <option value="buy">BUY</option>
                    <option value="sell">SELL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Description</label>
                <input
                  name="description"
                  className="form-input"
                  placeholder="APPLE INC COM"
                  value={form.description}
                  onChange={handleChange}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Shares *</label>
                  <input
                    type="number"
                    name="quantity"
                    className="form-input"
                    placeholder="0.025"
                    step="0.00000001"
                    min="0"
                    value={form.quantity}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Price (USD)</label>
                  <input
                    type="number"
                    name="price"
                    className="form-input"
                    placeholder="189.50"
                    step="0.0001"
                    min="0"
                    value={form.price}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="form-label">Amount (USD)</label>
                  <input
                    type="number"
                    name="amount"
                    className="form-input"
                    placeholder="9.97"
                    step="0.0001"
                    value={form.amount}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Date *</label>
                <input
                  type="date"
                  name="transaction_date"
                  className="form-input"
                  value={form.transaction_date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div>
                <label className="form-label">Notes</label>
                <textarea
                  name="notes"
                  className="form-input resize-none"
                  rows={2}
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
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1 justify-center">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? "Saving…" : "Save Trade"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}