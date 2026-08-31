"use client";

import { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { PiggyBank, X, Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import { useScrollLock } from "@/hooks/useScrollLock";

export interface SavingsRow {
  id: string;
  amount: number;
  description: string;
  date: string;
  type: string;
  notes?: string | null;
  created_at: string;
}

const SAVINGS_TYPES = [
  "Savings Account",
  "Fixed Deposit",
  "Investment",
  "Emergency Fund",
  "Other",
] as const;

interface Props {
  onAdded?: () => void;
}

export default function SavingsAddModal({ onAdded }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    amount: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    type: "Savings Account",
    notes: "",
  });

  useScrollLock(open);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
    if (!form.description.trim()) { setError("Enter a description"); return; }

    setError("");
    setLoading(true);
    try {
      await addDoc(collection(db, "users", user.uid, "savings"), {
        amount: amt,
        description: form.description.trim(),
        date: form.date,
        type: form.type,
        notes: form.notes.trim() || null,
        created_at: new Date().toISOString(),
      });
      setOpen(false);
      setForm({
        amount: "",
        description: "",
        date: new Date().toISOString().slice(0, 10),
        type: "Savings Account",
        notes: "",
      });
      onAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <PiggyBank className="w-4 h-4" />
        Add Saving
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-none sm:max-w-md bg-gray-900/95 backdrop-blur-sm border border-gray-800/60 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto overflow-x-hidden">
            {/* drag handle */}
            <div className="sm:hidden flex justify-center mb-3 -mt-1">
              <div className="w-10 h-1 rounded-full bg-gray-700" />
            </div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <PiggyBank className="w-4 h-4 text-emerald-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Add Saving</h2>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 min-w-0">
              {/* Amount */}
              <div>
                <label className="form-label">Amount (₹) *</label>
                <input
                  type="number"
                  inputMode="decimal"
                  name="amount"
                  className="form-input text-lg font-semibold"
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onChange={handleChange}
                  required
                  autoFocus
                />
              </div>

              {/* Type */}
              <div>
                <label className="form-label">Savings Type *</label>
                <select name="type" className="form-input" value={form.type} onChange={handleChange}>
                  {SAVINGS_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="form-label">Description *</label>
                <input
                  name="description"
                  className="form-input"
                  placeholder="e.g. Monthly SIP deposit"
                  value={form.description}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Date */}
              <div>
                <label className="form-label">Date *</label>
                <input
                  type="date"
                  name="date"
                  className="form-input min-w-0"
                  value={form.date}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Notes */}
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
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1 justify-center">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 justify-center inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? "Saving…" : "Save"}
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
