"use client";

import { useState, useEffect } from "react";
import {
  collection, addDoc, deleteDoc, doc, getDocs, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import {
  Settings2, X, Plus, Loader2, Trash2,
  UtensilsCrossed, Car, ShoppingBag, Zap, Heart, Film,
  ShoppingCart, Plane, Package, Coffee, Wifi, Home,
  Dumbbell, BookOpen, Music, Gift, Briefcase, Baby,
  PawPrint, Shirt, Fuel, Bus, Train, Bike,
} from "lucide-react";

// Available Lucide icons for categories
export const CATEGORY_ICONS: { key: string; Icon: React.FC<{ className?: string }> ; label: string }[] = [
  { key: "UtensilsCrossed", Icon: UtensilsCrossed, label: "Food" },
  { key: "Coffee", Icon: Coffee, label: "Coffee" },
  { key: "Car", Icon: Car, label: "Car" },
  { key: "Bus", Icon: Bus, label: "Bus" },
  { key: "Train", Icon: Train, label: "Train" },
  { key: "Bike", Icon: Bike, label: "Bike" },
  { key: "Fuel", Icon: Fuel, label: "Fuel" },
  { key: "Plane", Icon: Plane, label: "Travel" },
  { key: "ShoppingBag", Icon: ShoppingBag, label: "Shopping" },
  { key: "ShoppingCart", Icon: ShoppingCart, label: "Groceries" },
  { key: "Shirt", Icon: Shirt, label: "Clothing" },
  { key: "Zap", Icon: Zap, label: "Bills" },
  { key: "Wifi", Icon: Wifi, label: "Internet" },
  { key: "Home", Icon: Home, label: "Rent" },
  { key: "Heart", Icon: Heart, label: "Health" },
  { key: "Dumbbell", Icon: Dumbbell, label: "Fitness" },
  { key: "Film", Icon: Film, label: "Movies" },
  { key: "Music", Icon: Music, label: "Music" },
  { key: "BookOpen", Icon: BookOpen, label: "Education" },
  { key: "Gift", Icon: Gift, label: "Gifts" },
  { key: "Briefcase", Icon: Briefcase, label: "Work" },
  { key: "Baby", Icon: Baby, label: "Kids" },
  { key: "PawPrint", Icon: PawPrint, label: "Pets" },
  { key: "Package", Icon: Package, label: "Other" },
];

export const CATEGORY_COLORS: { key: string; bg: string; text: string; dot: string }[] = [
  { key: "red",    bg: "bg-red-500/15",    text: "text-red-400",    dot: "bg-red-400" },
  { key: "orange", bg: "bg-orange-500/15", text: "text-orange-400", dot: "bg-orange-400" },
  { key: "amber",  bg: "bg-amber-500/15",  text: "text-amber-400",  dot: "bg-amber-400" },
  { key: "yellow", bg: "bg-yellow-500/15", text: "text-yellow-400", dot: "bg-yellow-400" },
  { key: "lime",   bg: "bg-lime-500/15",   text: "text-lime-400",   dot: "bg-lime-400" },
  { key: "green",  bg: "bg-green-500/15",  text: "text-green-400",  dot: "bg-green-400" },
  { key: "teal",   bg: "bg-teal-500/15",   text: "text-teal-400",   dot: "bg-teal-400" },
  { key: "cyan",   bg: "bg-cyan-500/15",   text: "text-cyan-400",   dot: "bg-cyan-400" },
  { key: "sky",    bg: "bg-sky-500/15",    text: "text-sky-400",    dot: "bg-sky-400" },
  { key: "blue",   bg: "bg-blue-500/15",   text: "text-blue-400",   dot: "bg-blue-400" },
  { key: "violet", bg: "bg-violet-500/15", text: "text-violet-400", dot: "bg-violet-400" },
  { key: "purple", bg: "bg-purple-500/15", text: "text-purple-400", dot: "bg-purple-400" },
  { key: "pink",   bg: "bg-pink-500/15",   text: "text-pink-400",   dot: "bg-pink-400" },
  { key: "rose",   bg: "bg-rose-500/15",   text: "text-rose-400",   dot: "bg-rose-400" },
  { key: "gray",   bg: "bg-gray-500/15",   text: "text-gray-400",   dot: "bg-gray-400" },
];

export const DEFAULT_CATEGORIES = [
  { name: "Food",          icon: "UtensilsCrossed", color: "orange" },
  { name: "Transport",     icon: "Car",             color: "blue"   },
  { name: "Shopping",      icon: "ShoppingBag",     color: "pink"   },
  { name: "Bills",         icon: "Zap",             color: "yellow" },
  { name: "Health",        icon: "Heart",           color: "red"    },
  { name: "Entertainment", icon: "Film",            color: "purple" },
  { name: "Groceries",     icon: "ShoppingCart",    color: "green"  },
  { name: "Travel",        icon: "Plane",           color: "sky"    },
  { name: "Education",     icon: "BookOpen",        color: "teal"   },
  { name: "Other",         icon: "Package",         color: "gray"   },
];

export interface CategoryDoc {
  id: string;
  name: string;
  icon: string;
  color: string;
  budget_limit?: number | null;
  created_at: string;
}

export function getCategoryColor(colorKey: string) {
  return CATEGORY_COLORS.find((c) => c.key === colorKey) ?? CATEGORY_COLORS[CATEGORY_COLORS.length - 1];
}

export function getCategoryIcon(iconKey: string): React.FC<{ className?: string }> {
  return CATEGORY_ICONS.find((i) => i.key === iconKey)?.Icon ?? Package;
}

interface Props {
  onChanged?: () => void;
}

export default function CategoryManageModal({ onChanged }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    icon: "Package",
    color: "gray",
    budget_limit: "",
  });

  const fetchCategories = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "users", user.uid, "expense_categories"), orderBy("created_at", "asc"))
      );
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CategoryDoc)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchCategories();
  }, [open, user]);

  const handleSeed = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const col = collection(db, "users", user.uid, "expense_categories");
      await Promise.all(
        DEFAULT_CATEGORIES.map((cat) =>
          addDoc(col, { ...cat, budget_limit: null, created_at: new Date().toISOString() })
        )
      );
      await fetchCategories();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to seed categories");
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.name.trim()) return;
    setError("");
    setSaving(true);
    try {
      await addDoc(collection(db, "users", user.uid, "expense_categories"), {
        name: form.name.trim(),
        icon: form.icon,
        color: form.color,
        budget_limit: form.budget_limit ? parseFloat(form.budget_limit) : null,
        created_at: new Date().toISOString(),
      });
      setForm({ name: "", icon: "Package", color: "gray", budget_limit: "" });
      await fetchCategories();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add category");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    if (!window.confirm("Delete this category? Existing expenses will still reference it.")) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, "users", user.uid, "expense_categories", id));
      await fetchCategories();
      onChanged?.();
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeletingId(null);
    }
  };

  const selectedIconEntry = CATEGORY_ICONS.find((i) => i.key === form.icon);
  const SelectedIcon = selectedIconEntry?.Icon ?? Package;
  const selectedColor = getCategoryColor(form.color);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-all border border-gray-700/60"
      >
        <Settings2 className="w-4 h-4" />
        Categories
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative glass-card w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800/60">
              <div>
                <h2 className="text-lg font-semibold text-white">Manage Categories</h2>
                <p className="text-xs text-gray-500 mt-0.5">Add custom categories with icons and colors</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {/* Add form */}
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="form-label">Category Name *</label>
                    <input
                      className="form-input"
                      placeholder="e.g. Subscriptions"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Monthly Budget (₹)</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Optional limit"
                      step="0.01"
                      min="0"
                      value={form.budget_limit}
                      onChange={(e) => setForm((p) => ({ ...p, budget_limit: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Icon picker */}
                <div>
                  <label className="form-label">Icon</label>
                  <div className="grid grid-cols-8 gap-1.5 p-3 bg-gray-900/60 rounded-xl border border-gray-800">
                    {CATEGORY_ICONS.map(({ key, Icon }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, icon: key }))}
                        title={key}
                        className={`p-2 rounded-lg flex items-center justify-center transition-all ${
                          form.icon === key
                            ? "bg-gray-700 ring-2 ring-sky-500"
                            : "hover:bg-gray-800"
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${form.icon === key ? "text-sky-400" : "text-gray-400"}`} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color picker */}
                <div>
                  <label className="form-label">Color</label>
                  <div className="flex flex-wrap gap-2 p-3 bg-gray-900/60 rounded-xl border border-gray-800">
                    {CATEGORY_COLORS.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, color: c.key }))}
                        className={`w-7 h-7 rounded-full transition-all ${c.dot} ${
                          form.color === c.key ? "ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110" : "opacity-70 hover:opacity-100"
                        }`}
                        title={c.key}
                      />
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="flex items-center gap-3 p-3 bg-gray-900/40 rounded-xl border border-gray-800/60">
                  <span className="text-xs text-gray-500">Preview:</span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${selectedColor.bg} ${selectedColor.text}`}>
                    <SelectedIcon className="w-3.5 h-3.5" />
                    {form.name || "Category Name"}
                  </span>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">{error}</div>
                )}

                <div className="flex gap-3">
                  <button type="submit" disabled={saving} className="btn-primary">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {saving ? "Adding…" : "Add Category"}
                  </button>
                </div>
              </form>

              {/* Existing categories */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">
                    Your Categories
                    <span className="ml-2 text-xs font-normal text-gray-500">({categories.length})</span>
                  </h3>
                  {categories.length === 0 && !loading && (
                    <button
                      type="button"
                      onClick={handleSeed}
                      disabled={saving}
                      className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                    >
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      Load default categories
                    </button>
                  )}
                </div>

                {loading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                  </div>
                ) : categories.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No categories yet. Add one above or load defaults.</p>
                ) : (
                  <div className="space-y-1">
                    {categories.map((cat) => {
                      const CatIcon = getCategoryIcon(cat.icon);
                      const color = getCategoryColor(cat.color);
                      return (
                        <div
                          key={cat.id}
                          className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-900/40 border border-gray-800/40 group"
                        >
                          <div className="flex items-center gap-3">
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${color.bg}`}>
                              <CatIcon className={`w-4 h-4 ${color.text}`} />
                            </span>
                            <div>
                              <p className="text-sm font-medium text-gray-200">{cat.name}</p>
                              {cat.budget_limit ? (
                                <p className="text-xs text-gray-500">Budget: ₹{cat.budget_limit.toLocaleString("en-IN")}/mo</p>
                              ) : null}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDelete(cat.id)}
                            disabled={deletingId === cat.id}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                          >
                            {deletingId === cat.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
