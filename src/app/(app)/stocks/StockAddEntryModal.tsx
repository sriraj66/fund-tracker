"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { collection, addDoc, getDocs, query, where, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { Plus, X, Loader2 } from "lucide-react";
import { useScrollLock } from "@/hooks/useScrollLock";

interface Props { onAdded?: () => void; }

const blank = () => ({
  month:         new Date().toISOString().slice(0, 7), // "YYYY-MM"
  invested:      "",
  current_value: "",
});

export default function StockAddEntryModal({ onAdded }: Props) {
  const { user } = useAuth();
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [form,    setForm]    = useState(blank());
  useScrollLock(open);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const inv = parseFloat(form.invested)      || 0;
  const cur = parseFloat(form.current_value) || 0;
  const pnl = cur - inv;
  const pct = inv > 0 ? (pnl / inv) * 100 : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.month)  { setError("Select a month"); return; }
    if (inv <= 0)     { setError("Enter the invested amount"); return; }
    setError("");
    setLoading(true);
    try {
      const [yyyy, mm] = form.month.split("-");
      const label = new Date(Number(yyyy), Number(mm) - 1, 1).toLocaleDateString("en-IN", {
        month: "short", year: "numeric",
      });

      const colRef   = collection(db, "users", user.uid, "stock_monthly_entries");
      const existing = await getDocs(query(colRef, where("month", "==", form.month)));

      const data = {
        month:         form.month,
        month_label:   label,
        invested:      inv,
        current_value: cur,
        pnl:           Math.round(pnl * 100) / 100,
        pnl_pct:       Math.round(pct * 100) / 100,
        updated_at:    new Date().toISOString(),
      };

      if (!existing.empty) {
        await updateDoc(
          doc(db, "users", user.uid, "stock_monthly_entries", existing.docs[0].id),
          data,
        );
      } else {
        await addDoc(colRef, { ...data, created_at: new Date().toISOString() });
      }

      setOpen(false);
      setForm(blank());
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
        Add Entry
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-none sm:max-w-md bg-gray-900/95 backdrop-blur-sm
                          border border-gray-800/60 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6
                          shadow-2xl max-h-[88vh] overflow-y-auto overscroll-contain">
            {/* Mobile handle */}
            <div className="sm:hidden flex justify-center mb-3 -mt-1">
              <div className="w-10 h-1 rounded-full bg-gray-700" />
            </div>

            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-white">Add Monthly Snapshot</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Existing entry for this month will be overwritten.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Month picker */}
              <div>
                <label className="form-label">Month *</label>
                <input
                  type="month"
                  name="month"
                  className="form-input"
                  value={form.month}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Invested */}
              <div>
                <label className="form-label">Invested Amount (₹) *</label>
                <input
                  type="number"
                  inputMode="decimal"
                  name="invested"
                  className="form-input"
                  placeholder="Total cost basis"
                  step="0.01"
                  min="0"
                  value={form.invested}
                  onChange={handleChange}
                />
              </div>

              {/* Current Value */}
              <div>
                <label className="form-label">Current / Closing Value (₹)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  name="current_value"
                  className="form-input"
                  placeholder="Market value at month-end"
                  step="0.01"
                  min="0"
                  value={form.current_value}
                  onChange={handleChange}
                />
              </div>

              {/* Live preview */}
              {inv > 0 && (
                <div className="bg-gray-800/50 rounded-lg px-4 py-3 text-sm space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Invested</span>
                    <span className="text-gray-200 font-medium">
                      ₹{inv.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {cur > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Current Value</span>
                      <span className="text-blue-400 font-medium">
                        ₹{cur.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  {cur > 0 && (
                    <div className="flex justify-between border-t border-gray-700 pt-1.5">
                      <span className="text-gray-300 font-medium">Unrealised P&amp;L</span>
                      <span className={`font-semibold ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {pnl >= 0 ? "+" : ""}₹{pnl.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                        {" "}({pnl >= 0 ? "+" : ""}{pct.toFixed(2)}%)
                      </span>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2
                                text-sm text-red-400">
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
                  {loading ? "Saving…" : "Save Snapshot"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
