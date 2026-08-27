"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, deleteDoc, doc, getDocs, query, orderBy, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { Tag, X, Plus, Loader2, Trash2, Pencil, Check } from "lucide-react";

export const TAG_COLORS: { key: string; bg: string; text: string; dot: string }[] = [
  { key: "red",    bg: "bg-red-500/15",    text: "text-red-400",    dot: "bg-red-400"    },
  { key: "orange", bg: "bg-orange-500/15", text: "text-orange-400", dot: "bg-orange-400" },
  { key: "amber",  bg: "bg-amber-500/15",  text: "text-amber-400",  dot: "bg-amber-400"  },
  { key: "yellow", bg: "bg-yellow-500/15", text: "text-yellow-400", dot: "bg-yellow-400" },
  { key: "lime",   bg: "bg-lime-500/15",   text: "text-lime-400",   dot: "bg-lime-400"   },
  { key: "green",  bg: "bg-green-500/15",  text: "text-green-400",  dot: "bg-green-400"  },
  { key: "teal",   bg: "bg-teal-500/15",   text: "text-teal-400",   dot: "bg-teal-400"   },
  { key: "cyan",   bg: "bg-cyan-500/15",   text: "text-cyan-400",   dot: "bg-cyan-400"   },
  { key: "sky",    bg: "bg-sky-500/15",    text: "text-sky-400",    dot: "bg-sky-400"    },
  { key: "blue",   bg: "bg-blue-500/15",   text: "text-blue-400",   dot: "bg-blue-400"   },
  { key: "violet", bg: "bg-violet-500/15", text: "text-violet-400", dot: "bg-violet-400" },
  { key: "purple", bg: "bg-purple-500/15", text: "text-purple-400", dot: "bg-purple-400" },
  { key: "pink",   bg: "bg-pink-500/15",   text: "text-pink-400",   dot: "bg-pink-400"   },
  { key: "rose",   bg: "bg-rose-500/15",   text: "text-rose-400",   dot: "bg-rose-400"   },
  { key: "gray",   bg: "bg-gray-500/15",   text: "text-gray-400",   dot: "bg-gray-400"   },
];

export interface TagDoc {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export function getTagColor(colorKey: string) {
  return TAG_COLORS.find((c) => c.key === colorKey) ?? TAG_COLORS[TAG_COLORS.length - 1];
}

interface Props {
  onChanged?: () => void;
}

export default function TagManageModal({ onChanged }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<TagDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  // Edit state: which tag is being edited
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", color: "sky" });

  const [form, setForm] = useState({ name: "", color: "sky" });

  const fetchTags = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "users", user.uid, "expense_tags"), orderBy("created_at", "asc"))
      );
      setTags(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TagDoc)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchTags();
  }, [open, user]);

  // Close the modal and notify parent to refresh
  const handleClose = () => {
    setOpen(false);
    setEditingId(null);
    onChanged?.();
  };

  // Add one or many tags (comma-separated input)
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.name.trim()) return;
    setError("");

    // Parse comma-separated names
    const names = form.name
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);

    if (names.length === 0) return;

    // Check for duplicates against existing tags
    const existingNames = new Set(tags.map((t) => t.name.toLowerCase()));
    const duplicates = names.filter((n) => existingNames.has(n.toLowerCase()));
    if (duplicates.length > 0) {
      setError(`Already exists: ${duplicates.join(", ")}`);
      return;
    }

    setSaving(true);
    try {
      const col = collection(db, "users", user.uid, "expense_tags");
      // Create all tags with slight offset in created_at to preserve order
      await Promise.all(
        names.map((name, i) =>
          addDoc(col, {
            name,
            color: form.color,
            created_at: new Date(Date.now() + i).toISOString(),
          })
        )
      );
      // Reset form but keep modal open
      setForm({ name: "", color: "sky" });
      setError("");
      await fetchTags(); // refresh local list only — no parent re-fetch
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add tag");
    } finally {
      setSaving(false);
    }
  };

  // Start inline edit
  const startEdit = (tag: TagDoc) => {
    setEditingId(tag.id);
    setEditForm({ name: tag.name, color: tag.color });
  };

  // Save edit
  const handleSaveEdit = async (id: string) => {
    if (!user || !editForm.name.trim()) return;
    // Check duplicate (exclude self)
    const duplicate = tags.find(
      (t) => t.id !== id && t.name.toLowerCase() === editForm.name.trim().toLowerCase()
    );
    if (duplicate) {
      alert(`Tag name "${editForm.name.trim()}" already exists.`);
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid, "expense_tags", id), {
        name: editForm.name.trim(),
        color: editForm.color,
      });
      setEditingId(null);
      await fetchTags();
    } catch (err) {
      alert(`Update failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, tagName: string) => {
    if (!user) return;
    if (!window.confirm(`Delete tag "${tagName}"? Existing expenses will still store the name.`)) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, "users", user.uid, "expense_tags", id));
      await fetchTags(); // refresh local list only
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeletingId(null);
    }
  };

  const selectedColor = getTagColor(form.color);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-all border border-gray-700/60"
      >
        <Tag className="w-4 h-4" />
        Tags
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
          <div className="relative glass-card w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800/60">
              <div>
                <h2 className="text-lg font-semibold text-white">Manage Tags</h2>
                <p className="text-xs text-gray-500 mt-0.5">Add tags like Swiggy, Zomato, Zepto…</p>
              </div>
              <button onClick={handleClose} className="text-gray-500 hover:text-gray-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {/* Add form */}
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="form-label">
                    Tag Name *
                    <span className="ml-1 text-gray-600 font-normal text-xs">
                      — separate multiple with commas
                    </span>
                  </label>
                  <input
                    className="form-input"
                    placeholder="e.g. Swiggy, Zomato, Netflix"
                    value={form.name}
                    onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setError(""); }}
                    required
                    autoFocus
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Enter multiple tags separated by commas to add them all at once.
                  </p>
                </div>

                {/* Color picker */}
                <div>
                  <label className="form-label">Color</label>
                  <div className="flex flex-wrap gap-2 p-3 bg-gray-900/60 rounded-xl border border-gray-800">
                    {TAG_COLORS.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, color: c.key }))}
                        className={`w-7 h-7 rounded-full transition-all ${c.dot} ${
                          form.color === c.key
                            ? "ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110"
                            : "opacity-70 hover:opacity-100"
                        }`}
                        title={c.key}
                      />
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="flex items-center gap-3 p-3 bg-gray-900/40 rounded-xl border border-gray-800/60">
                  <span className="text-xs text-gray-500">Preview:</span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${selectedColor.bg} ${selectedColor.text}`}>
                    <Tag className="w-3 h-3" />
                    {form.name || "tag name"}
                  </span>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">{error}</div>
                )}

                <button type="submit" disabled={saving || !form.name.trim()} className="btn-primary">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {saving
                    ? "Adding…"
                    : form.name.includes(",")
                    ? `Add ${form.name.split(",").filter((n) => n.trim()).length} Tags`
                    : "Add Tag"}
                </button>
              </form>

              {/* Existing tags */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">
                  Your Tags
                  <span className="ml-2 text-xs font-normal text-gray-500">({tags.length})</span>
                </h3>
                {loading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                  </div>
                ) : tags.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No tags yet. Add one above.</p>
                ) : (
                  <div className="space-y-1.5">
                    {tags.map((tag) => {
                      const isEditing = editingId === tag.id;
                      const color = getTagColor(isEditing ? editForm.color : tag.color);

                      if (isEditing) {
                        return (
                          <div key={tag.id} className="p-3 rounded-xl bg-gray-900/60 border border-gray-700/60 space-y-2">
                            {/* Edit name */}
                            <input
                              className="form-input text-sm py-1.5"
                              value={editForm.name}
                              onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                              placeholder="Tag name"
                              autoFocus
                            />
                            {/* Edit color */}
                            <div className="flex flex-wrap gap-1.5">
                              {TAG_COLORS.map((c) => (
                                <button
                                  key={c.key}
                                  type="button"
                                  onClick={() => setEditForm((p) => ({ ...p, color: c.key }))}
                                  className={`w-5 h-5 rounded-full transition-all ${c.dot} ${
                                    editForm.color === c.key
                                      ? "ring-2 ring-white ring-offset-1 ring-offset-gray-900 scale-110"
                                      : "opacity-60 hover:opacity-100"
                                  }`}
                                />
                              ))}
                            </div>
                            {/* Preview + actions */}
                            <div className="flex items-center justify-between">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color.bg} ${color.text}`}>
                                <Tag className="w-3 h-3" />
                                {editForm.name || "preview"}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(tag.id)}
                                  disabled={saving || !editForm.name.trim()}
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-40 transition-colors"
                                >
                                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                  Save
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // Normal row
                      return (
                        <div
                          key={tag.id}
                          className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-900/40 border border-gray-800/40 group"
                        >
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color.bg} ${color.text}`}>
                            <Tag className="w-3 h-3" />
                            {tag.name}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => startEdit(tag)}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-sky-400 hover:bg-sky-500/10 transition-all"
                              title="Edit tag"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(tag.id, tag.name)}
                              disabled={deletingId === tag.id}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30"
                              title="Delete tag"
                            >
                              {deletingId === tag.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
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
