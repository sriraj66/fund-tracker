"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { collection, doc, updateDoc, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { Pencil, X, Loader2, Tag } from "lucide-react";
import { getCategoryColor, getCategoryIcon, type CategoryDoc } from "./CategoryManageModal";
import { type TagDoc, getTagColor } from "./TagManageModal";
import { useScrollLock } from "@/hooks/useScrollLock";

interface ExpenseRow {
  id: string;
  amount: number;
  category_id: string;
  category_name: string;
  category_icon: string;
  category_color: string;
  description: string;
  date: string;
  payment_method: string;
  tags?: string[];
  notes?: string | null;
}

interface Props {
  expense: ExpenseRow;
  onUpdated?: () => void;
}

const PAYMENT_METHODS = ["UPI", "Card", "Cash", "Net Banking", "Other"] as const;

export default function ExpenseEditModal({ expense, onUpdated }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingCats, setLoadingCats] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [availableTags, setAvailableTags] = useState<TagDoc[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [form, setForm] = useState({
    amount: "",
    category_id: "",
    description: "",
    date: "",
    payment_method: "UPI",
    notes: "",
  });

  useScrollLock(open);

  // Populate form whenever the modal opens with fresh expense data
  useEffect(() => {
    if (open) {
      setForm({
        amount: String(expense.amount),
        category_id: expense.category_id,
        description: expense.description ?? "",
        date: expense.date,
        payment_method: expense.payment_method,
        notes: expense.notes ?? "",
      });
      setSelectedTags(expense.tags ?? []);
      setError("");
    }
  }, [open, expense]);

  const fetchMeta = async () => {
    if (!user) return;
    setLoadingCats(true);
    try {
      const [catSnap, tagSnap] = await Promise.all([
        getDocs(query(collection(db, "users", user.uid, "expense_categories"), orderBy("created_at", "asc"))),
        getDocs(query(collection(db, "users", user.uid, "expense_tags"), orderBy("created_at", "asc"))),
      ]);
      setCategories(catSnap.docs.map((d) => ({ id: d.id, ...d.data() } as CategoryDoc)));
      setAvailableTags(tagSnap.docs.map((d) => ({ id: d.id, ...d.data() } as TagDoc)));
    } finally {
      setLoadingCats(false);
    }
  };

  useEffect(() => {
    if (open) fetchMeta();
  }, [open, user]);

  const toggleTag = (name: string) => {
    setSelectedTags((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]
    );
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
    if (!form.category_id) { setError("Select a category"); return; }

    const cat = categories.find((c) => c.id === form.category_id);
    if (!cat) { setError("Invalid category"); return; }

    setError("");
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", user.uid, "expenses", expense.id), {
        amount: amt,
        category_id: cat.id,
        category_name: cat.name,
        category_icon: cat.icon,
        category_color: cat.color,
        description: form.description.trim(),
        date: form.date,
        payment_method: form.payment_method,
        tags: selectedTags,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      });
      setOpen(false);
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const selectedCat = categories.find((c) => c.id === form.category_id);
  const selectedColor = selectedCat ? getCategoryColor(selectedCat.color) : null;
  const SelectedIcon = selectedCat ? getCategoryIcon(selectedCat.icon) : null;

  return (
    <>
      {/* Edit trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 rounded-lg text-gray-600 hover:text-sky-400 hover:bg-sky-500/10 transition-all"
        title="Edit expense"
      >
        <Pencil className="w-4 h-4" />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-none sm:max-w-lg bg-gray-900/95 backdrop-blur-sm border border-gray-800/60 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto overflow-x-hidden">
            {/* Drag handle (mobile) */}
            <div className="sm:hidden flex justify-center mb-3 -mt-1">
              <div className="w-10 h-1 rounded-full bg-gray-700" />
            </div>

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Edit Expense</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingCats ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm">No categories found.</p>
              </div>
            ) : (
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

                {/* Category */}
                <div>
                  <label className="form-label">Category *</label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                    {categories.map((cat) => {
                      const CatIcon = getCategoryIcon(cat.icon);
                      const color = getCategoryColor(cat.color);
                      const isSelected = form.category_id === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, category_id: cat.id }))}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all text-left ${
                            isSelected
                              ? `${color.bg} ${color.text} border-current/30 ring-1 ring-current/40`
                              : "bg-gray-800/40 text-gray-400 border-gray-700/40 hover:bg-gray-800 hover:text-gray-300"
                          }`}
                        >
                          <CatIcon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{cat.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="form-label">Description</label>
                  <input
                    name="description"
                    className="form-input"
                    placeholder="e.g. Dinner at restaurant (optional)"
                    value={form.description}
                    onChange={handleChange}
                  />
                </div>

                {/* Date + Payment Method */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  <div>
                    <label className="form-label">Payment Method</label>
                    <select name="payment_method" className="form-input" value={form.payment_method} onChange={handleChange}>
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Tags */}
                {availableTags.length > 0 && (
                  <div>
                    <label className="form-label">
                      Tags
                      <span className="ml-1 text-gray-600 font-normal">(optional, multi-select)</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5 p-3 bg-gray-900/60 rounded-xl border border-gray-800">
                      {availableTags.map((tag) => {
                        const color = getTagColor(tag.color);
                        const isSelected = selectedTags.includes(tag.name);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggleTag(tag.name)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                              isSelected
                                ? `${color.bg} ${color.text} ring-1 ring-current/40`
                                : "bg-gray-800 text-gray-500 hover:text-gray-300 hover:bg-gray-700"
                            }`}
                          >
                            <Tag className="w-3 h-3" />
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                    {selectedTags.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Selected: {selectedTags.join(", ")}
                      </p>
                    )}
                  </div>
                )}

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

                {/* Preview badge */}
                {selectedCat && selectedColor && SelectedIcon && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>Saving as:</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md font-medium ${selectedColor.bg} ${selectedColor.text}`}>
                      <SelectedIcon className="w-3 h-3" />
                      {selectedCat.name}
                    </span>
                    {form.amount && (
                      <span className="text-gray-300 font-semibold">
                        ₹{parseFloat(form.amount).toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
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
                    {loading ? "Saving…" : "Update Expense"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
