"use client";

import { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { Plus, X, Loader2 } from "lucide-react";

interface Props { onAdded?: () => void; }

export default function MfAddModal({ onAdded }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    scheme_name: "",
    transaction_type: "PURCHASE",
    units: "",
    nav: "",
    amount: "",
    transaction_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(""); setLoading(true);
    try {
      await addDoc(collection(db, "users", user.uid, "mf_transactions"), {
        scheme_name: form.scheme_name.trim(),
        transaction_type: form.transaction_type,
        units: form.units ? parseFloat(form.units) : null,
        nav: form.nav ? parseFloat(form.nav) : null,
        amount: parseFloat(form.amount),
        transaction_date: form.transaction_date,
        notes: form.notes || null,
        created_at: new Date().toISOString(),
      });
      setOpen(false);
      setForm({ scheme_name: "", transaction_type: "PURCHASE", units: "", nav: "", amount: "", transaction_date: new Date().toISOString().slice(0, 10), notes: "" });
      onAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setLoading(false); }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary"><Plus className="w-4 h-4" />Add Transaction</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative glass-card w-full max-w-lg p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Add MF Transaction</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="form-label">Scheme Name *</label><input name="scheme_name" className="form-input" placeholder="Nippon India Small Cap Fund - Direct" value={form.scheme_name} onChange={handleChange} required /></div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><label className="form-label">Transaction Type *</label><select name="transaction_type" className="form-input" value={form.transaction_type} onChange={handleChange}><option value="PURCHASE">PURCHASE</option><option value="SIP">SIP</option><option value="REDEMPTION">REDEMPTION</option></select></div>
                <div><label className="form-label">Date *</label><input type="date" name="transaction_date" className="form-input" value={form.transaction_date} onChange={handleChange} required /></div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><label className="form-label">Units</label><input type="number" name="units" className="form-input" placeholder="100.0000" step="0.0001" value={form.units} onChange={handleChange} /></div>
                <div><label className="form-label">NAV (₹)</label><input type="number" name="nav" className="form-input" placeholder="45.00" step="0.01" value={form.nav} onChange={handleChange} /></div>
              </div>
              <div><label className="form-label">Amount (₹) *</label><input type="number" name="amount" className="form-input" placeholder="5000.00" step="0.01" min="0" value={form.amount} onChange={handleChange} required /></div>
              <div><label className="form-label">Notes</label><textarea name="notes" className="form-input resize-none" rows={2} value={form.notes} onChange={handleChange} /></div>
              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">{loading && <Loader2 className="w-4 h-4 animate-spin" />}{loading ? "Saving…" : "Save Transaction"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}