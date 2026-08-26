"use client";

import { useState } from "react";
import { collection, addDoc, getDocs, query, where, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { Plus, X, Loader2 } from "lucide-react";

interface Props { onAdded?: () => void; }

const extractCoin = (market: string) => {
  const u = market.toUpperCase().trim();
  // Remove common quote currencies from the end
  for (const q of ["INR", "USDT", "USDC", "BTC", "ETH", "BNB"]) {
    if (u.endsWith(q)) return u.slice(0, u.length - q.length);
  }
  return u;
};

export default function CryptoAddModal({ onAdded }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const blank = () => ({
    market: "",
    trade_type: "BUY",
    price: "",
    total_inr: "",
    transaction_date: new Date().toISOString().slice(0, 10),
  });

  const [form, setForm] = useState(blank());

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(""); setLoading(true);
    try {
      const price    = parseFloat(form.price)     || 0;
      const total    = parseFloat(form.total_inr) || 0;
      const volume   = price > 0 ? total / price : 0;
      const coin     = extractCoin(form.market);
      const isBuy    = form.trade_type === "BUY";

      // Check if coin exists in crypto_holdings
      const holdingsRef = collection(db, "users", user.uid, "crypto_holdings");
      const holdingSnap = await getDocs(query(holdingsRef, where("coin_name", "==", coin)));

      let holding_id: string | null = null;
      let applied_qty   = volume;
      let applied_amount = total;

      if (!holdingSnap.empty) {
        const holdingDoc = holdingSnap.docs[0];
        holding_id = holdingDoc.id;
        const h = holdingDoc.data();
        const oldQty      = Number(h.quantity      ?? 0);
        const oldInvested = Number(h.invested_amount ?? 0);

        const newQty      = isBuy ? oldQty + volume      : Math.max(0, oldQty - volume);
        const newInvested = isBuy ? oldInvested + total  : Math.max(0, oldInvested - total);
        const newAvgPrice = newQty > 0 ? newInvested / newQty : 0;

        await updateDoc(doc(db, "users", user.uid, "crypto_holdings", holding_id), {
          quantity:       newQty,
          invested_amount: newInvested,
          avg_buy_price:  newAvgPrice,
        });
      }

      await addDoc(collection(db, "users", user.uid, "crypto_transactions"), {
        market:           form.market.trim().toUpperCase(),
        coin,
        trade_type:       form.trade_type,
        price:            price || null,
        volume:           volume || null,
        total_inr:        total || null,
        tds_amount:       0,
        fee_amount:       0,
        transaction_date: form.transaction_date,
        // holding link for revert-on-delete
        holding_id:       holding_id,
        applied_qty:      applied_qty,
        applied_amount:   applied_amount,
        created_at:       new Date().toISOString(),
      });

      setOpen(false);
      setForm(blank());
      onAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setLoading(false); }
  };

  const price = parseFloat(form.price) || 0;
  const total = parseFloat(form.total_inr) || 0;
  const autoVolume = price > 0 ? (total / price) : 0;

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary"><Plus className="w-4 h-4" />Add Trade</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative glass-card w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-white">Add Crypto Trade</h2>
                <p className="text-xs text-gray-500 mt-0.5">If the coin is in your holdings, it will be updated automatically</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Market * (e.g. BTCINR)</label>
                  <input name="market" className="form-input font-mono uppercase" placeholder="BTCINR"
                    value={form.market} onChange={handleChange} required />
                </div>
                <div>
                  <label className="form-label">Trade Type *</label>
                  <select name="trade_type" className="form-input" value={form.trade_type} onChange={handleChange}>
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Price per Coin (₹) *</label>
                  <input type="number" name="price" className="form-input" placeholder="6410689.81"
                    step="0.01" min="0" value={form.price} onChange={handleChange} required />
                </div>
                <div>
                  <label className="form-label">Value / Total (₹) *</label>
                  <input type="number" name="total_inr" className="form-input" placeholder="1000.00"
                    step="0.01" min="0" value={form.total_inr} onChange={handleChange} required />
                </div>
              </div>
              {autoVolume > 0 && (
                <p className="text-xs text-gray-500 -mt-2">
                  ≈ <span className="text-gray-300 font-mono">{autoVolume.toFixed(8)}</span> coins (auto-calculated)
                </p>
              )}
              <div>
                <label className="form-label">Date *</label>
                <input type="date" name="transaction_date" className="form-input"
                  value={form.transaction_date} onChange={handleChange} required />
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
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
