"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { collection, addDoc, getDocs, query, where, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { Layers, X, Loader2 } from "lucide-react";
import { useScrollLock } from "@/hooks/useScrollLock";

interface Props { onAdded?: () => void; }

export default function StockHoldingModal({ onAdded }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const blank = () => ({
    stock_name: "", symbol: "", exchange: "NSE", isin: "",
    quantity: "", avg_buy_price: "",
  });
  const [form, setForm] = useState(blank());
  useScrollLock(open);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const qty       = parseFloat(form.quantity) || 0;
  const avgPrice  = parseFloat(form.avg_buy_price) || 0;
  const totalInvested = qty * avgPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const q = parseFloat(form.quantity);
    const ap = parseFloat(form.avg_buy_price);
    const symbol = form.symbol.trim().toUpperCase();
    if (!q || q <= 0)   { setError("Enter a valid quantity"); return; }
    if (!ap || ap <= 0) { setError("Enter a valid avg buy price"); return; }
    if (!symbol)        { setError("Enter a symbol"); return; }

    setError("");
    setLoading(true);
    try {
      const holdingsRef = collection(db, "users", user.uid, "stock_holdings");
      const snap = await getDocs(query(holdingsRef, where("symbol", "==", symbol)));

      const data = {
        symbol,
        stock_name:      form.stock_name.trim().toUpperCase() || symbol,
        quantity:        q,
        avg_buy_price:   ap,
        invested_amount: q * ap,
        exchange:        form.exchange,
        isin:            form.isin.trim() || null,
        updated_at:      new Date().toISOString(),
      };

      if (!snap.empty) {
        await updateDoc(doc(db, "users", user.uid, "stock_holdings", snap.docs[0].id), data);
      } else {
        await addDoc(holdingsRef, data);
      }

      setOpen(false);
      setForm(blank());
      onAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setLoading(false); }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium rounded-lg border border-gray-700 transition-colors"
      >
        <Layers className="w-4 h-4" />
        Set Holding
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-none sm:max-w-lg bg-gray-900/95 backdrop-blur-sm border border-gray-800/60 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto overflow-x-hidden overscroll-contain">
            <div className="sm:hidden flex justify-center mb-3 -mt-1">
              <div className="w-10 h-1 rounded-full bg-gray-700" />
            </div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                  <Layers className="w-4 h-4 text-sky-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Set Stock Holding</h2>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-5">
              Enter your current holding snapshot. If this symbol already exists it will be overwritten.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 min-w-0">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="form-label">Stock Name *</label>
                  <input name="stock_name" className="form-input" placeholder="HDFC BANK LTD"
                    value={form.stock_name} onChange={handleChange} required />
                </div>
                <div>
                  <label className="form-label">Symbol *</label>
                  <input name="symbol" className="form-input font-mono uppercase" placeholder="HDFCBANK"
                    value={form.symbol} onChange={handleChange} required />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="form-label">Exchange</label>
                  <select name="exchange" className="form-input" value={form.exchange} onChange={handleChange}>
                    <option value="NSE">NSE</option>
                    <option value="BSE">BSE</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">ISIN</label>
                  <input name="isin" className="form-input font-mono" placeholder="INE040A01034"
                    value={form.isin} onChange={handleChange} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="form-label">Quantity *</label>
                  <input type="number" inputMode="decimal" name="quantity" className="form-input"
                    placeholder="100" step="0.0001" min="0.0001"
                    value={form.quantity} onChange={handleChange} required />
                </div>
                <div>
                  <label className="form-label">Avg Buy Price (₹) *</label>
                  <input type="number" inputMode="decimal" name="avg_buy_price" className="form-input"
                    placeholder="1500.00" step="0.01" min="0.01"
                    value={form.avg_buy_price} onChange={handleChange} required />
                </div>
              </div>

              {totalInvested > 0 && (
                <p className="text-xs text-gray-500">
                  Total invested: <span className="text-gray-300 font-semibold">
                    ₹{totalInvested.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </span>
                </p>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2 pb-4">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1 justify-center">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? "Saving…" : "Save Holding"}
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
