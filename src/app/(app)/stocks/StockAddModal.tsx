"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "@/hooks/useScrollLock";
import { collection, addDoc, getDocs, query, where, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { Plus, X, Loader2 } from "lucide-react";

interface Props {
  onAdded?: () => void;
}

export default function StockAddModal({ onAdded }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useScrollLock(open);

  const [form, setForm] = useState({
    stock_name: "",
    symbol: "",
    isin: "",
    transaction_type: "BUY",
    quantity: "",
    value: "",
    exchange: "NSE",
    execution_date: new Date().toISOString().slice(0, 16),
    notes: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError("");
    setLoading(true);
    const qty = parseFloat(form.quantity);
    const val = parseFloat(form.value);
    const symbol = form.symbol.trim().toUpperCase();
    const isBuy  = form.transaction_type === "BUY";
    try {
      // ── Update stock_holdings ───────────────────────────────────────────
      const holdingsRef = collection(db, "users", user.uid, "stock_holdings");
      const holdingSnap = await getDocs(query(holdingsRef, where("symbol", "==", symbol)));

      if (!holdingSnap.empty) {
        const holdingDoc  = holdingSnap.docs[0];
        const h           = holdingDoc.data();
        const oldQty      = Number(h.quantity       ?? 0);
        const oldInvested = Number(h.invested_amount ?? 0);
        const oldAvg      = oldQty > 0 ? oldInvested / oldQty : 0;

        const newQty      = isBuy ? oldQty + qty : Math.max(0, oldQty - qty);
        // For SELL: remove at avg buy price so invested stays proportional
        const newInvested = isBuy ? oldInvested + val : Math.max(0, newQty * oldAvg);
        const newAvg      = newQty > 0 ? newInvested / newQty : 0;

        await updateDoc(doc(db, "users", user.uid, "stock_holdings", holdingDoc.id), {
          quantity:        newQty,
          invested_amount: newInvested,
          avg_buy_price:   newAvg,
          updated_at:      new Date().toISOString(),
        });
      } else if (isBuy) {
        // First transaction for this stock — create a new holding
        await addDoc(holdingsRef, {
          symbol,
          stock_name:      form.stock_name.trim().toUpperCase(),
          quantity:        qty,
          avg_buy_price:   qty > 0 ? val / qty : 0,
          invested_amount: val,
          exchange:        form.exchange || "NSE",
          isin:            form.isin.trim() || null,
          updated_at:      new Date().toISOString(),
        });
      }
      // ── Save transaction record ────────────────────────────────────────
      await addDoc(collection(db, "users", user.uid, "stock_transactions"), {
        stock_name:       form.stock_name.trim().toUpperCase(),
        symbol,
        isin:             form.isin.trim() || null,
        transaction_type: form.transaction_type,
        quantity:         qty,
        price:            qty > 0 ? val / qty : null,
        value:            val,
        exchange:         form.exchange || null,
        execution_date:   form.execution_date || null,
        order_status:     "Executed",
        notes:            form.notes || null,
        created_at:       new Date().toISOString(),
      });

      setOpen(false);
      setForm({ stock_name: "", symbol: "", isin: "", transaction_type: "BUY", quantity: "", value: "", exchange: "NSE", execution_date: new Date().toISOString().slice(0, 16), notes: "" });
      onAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="w-4 h-4" />
        Add Order
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-none sm:max-w-lg bg-gray-900/95 backdrop-blur-sm border border-gray-800/60 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto overscroll-contain overflow-x-hidden">
            <div className="sm:hidden flex justify-center mb-3 -mt-1">
              <div className="w-10 h-1 rounded-full bg-gray-700" />
            </div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-white">Add Stock Order</h2>
                <p className="text-xs text-gray-500 mt-0.5">If the stock is in your holdings, it will be updated automatically</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 min-w-0">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="form-label">Stock Name *</label>
                  <input
                    name="stock_name"
                    className="form-input"
                    placeholder="HDFC BANK LTD"
                    value={form.stock_name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Symbol *</label>
                  <input
                    name="symbol"
                    className="form-input"
                    placeholder="HDFCBANK"
                    value={form.symbol}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="form-label">Order Type *</label>
                  <select
                    name="transaction_type"
                    className="form-input"
                    value={form.transaction_type}
                    onChange={handleChange}
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Exchange</label>
                  <select
                    name="exchange"
                    className="form-input"
                    value={form.exchange}
                    onChange={handleChange}
                  >
                    <option value="NSE">NSE</option>
                    <option value="BSE">BSE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="form-label">Quantity *</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    name="quantity"
                    className="form-input"
                    placeholder="1"
                    step="0.0001"
                    min="0"
                    value={form.quantity}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Total Value (₹) *</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    name="value"
                    className="form-input"
                    placeholder="802.00"
                    step="0.01"
                    min="0"
                    value={form.value}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Execution Date &amp; Time</label>
                <input
                  type="datetime-local"
                  name="execution_date"
                  className="form-input"
                  value={form.execution_date}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="form-label">ISIN</label>
                <input
                  name="isin"
                  className="form-input"
                  placeholder="INE040A01034"
                  value={form.isin}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="form-label">Notes</label>
                <textarea
                  name="notes"
                  className="form-input resize-none"
                  rows={2}
                  placeholder="Optional notes…"
                  value={form.notes}
                  onChange={handleChange}
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2 pb-4">
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
                  {loading ? "Saving…" : "Save Order"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}