"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

interface DeleteButtonProps {
  id: string;
  endpoint: string; // e.g., "/api/delete/mf"
  itemName?: string; // e.g., scheme name or symbol
}

export default function DeleteButton({ id, endpoint, itemName }: DeleteButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`${endpoint}?id=${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok || data.error) {
        alert(`Error: ${data.error ?? "Delete failed"}`);
      } else {
        router.refresh();
      }
    } catch (error) {
      alert(`Network error: ${error}`);
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50"
        >
          {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={isDeleting}
          className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="text-red-400 hover:text-red-300 transition-colors"
      title={`Delete ${itemName || "transaction"}`}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
