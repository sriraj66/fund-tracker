"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, X, Loader2 } from "lucide-react";
import { extractCoin } from "@/lib/utils";

interface Props {
  userId: string;
}

const COMMON_PAIRS = ["BTCINR", "ETHINR", "SOLINR", "XRPINR", "ADAINR", "DOGINR", "MATICNINR", "BNBINR"];

export default function CryptoAddModal({ userId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    market: "BTCINR",
    coin: "BTC",
    trade_type: "BUY",
    price: "",
    volume: "",
    total_inr: "",
    tds_amount: "0",
    fee_amount: "0",
    transaction_date: new Date().toISOString().slice(0, 16),
    notes: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };
      // Auto-derive coin from market
      if (name === "market") {
        updated.coin = extractCoin(value.toUpperCase());
      }
      // Auto-calculate total from price × volume
      if (name === "price" || name === "volume") {
        const p = parseFloat(name === "price" ? value : prev.price);
        const v = parseFloat(name === "volume" ? value : prev.volume);
        if (!isNaN(p) && !isNaN(v)) {
          updated.total_inr = (p * v).toFixed(2);
        }
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.from("crypto_transactions").insert({
      user_id: userId,
      market: form.market.trim().toUpperCase(),
      coin: form.coin.trim().toUpperCase(),
      trade_type: form.trade_type,
      price: form.price ? parseFloat(form.price) : null,
      volume: form.volume ? parseFloat(form.volume) : null,
      total_inr: form.total_inr ? parseFloat(form.total_inr) : null,
      tds_amount: parseFloat(form.tds_amount) || 0,
      fee_amount: parseFloat(form.fee_amount) || 0,
      transaction_date: form.transaction_date,
      notes: form.notes || null,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setOpen(false);
      setForm({
        market: "BTCINR",
        coin: "BTC",
        trade_type: "BUY",
        price: "",
        volume: "",
        total_inr: "",
        tds_amount: "0",
        fee_amount: "0",
        transaction_date: new Date().toISOString().slice(0, 16),
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
          <div className="relative glass-card w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Add Crypto Trade</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Market Pair *</label>
                  <input
                    name="market"
                    className="form-input uppercase"
                    placeholder="BTCINR"
                    list="market-pairs"
                    value={form.market}
                    onChange={handleChange}
                    required
                  />
                  <datalist id="market-pairs">
                    {COMMON_PAIRS.map((p) => <option key={p} value={p} />)}
                  </datalist>
                </div>
                <div>
                  <label className="form-label">Coin</label>
                  <input
                    name="coin"
                    className="form-input uppercase"
                    placeholder="BTC"
                    value={form.coin}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Trade Type *</label>
                <select
                  name="trade_type"
                  className="form-input"
                  value={form.trade_type}
                  onChange={handleChange}
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Price (INR)</label>
                  <input
                    type="number"
                    name="price"
                    className="form-input"
                    placeholder="6410689"
                    step="0.00000001"
                    min="0"
                    value={form.price}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="form-label">Volume (coin)</label>
                  <input
                    type="number"
                    name="volume"
                    className="form-input"
                    placeholder="0.000022"
                    step="0.00000001"
                    min="0"
                    value={form.volume}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="form-label">Total (INR) *</label>
                  <input
                    type="number"
                    name="total_inr"
                    className="form-input"
                    placeholder="140.33"
                    step="0.01"
                    min="0"
                    value={form.total_inr}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">TDS Amount (INR)</label>
                  <input
                    type="number"
                    name="tds_amount"
                    className="form-input"
                    placeholder="1.42"
                    step="0.01"
                    min="0"
                    value={form.tds_amount}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="form-label">Fee Amount (INR)</label>
                  <input
                    type="number"
                    name="fee_amount"
                    className="form-input"
                    placeholder="4"
                    step="0.01"
                    min="0"
                    value={form.fee_amount}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Date &amp; Time *</label>
                <input
                  type="datetime-local"
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