"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Settings } from "lucide-react";
import { auth } from "@/lib/firebase/config";

interface ExchangeRateSettingsProps {
  currentRate: number;
}

export default function ExchangeRateSettings({ currentRate }: ExchangeRateSettingsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rate, setRate] = useState(currentRate.toString());
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");

  const handleUpdate = async () => {
    const numRate = parseFloat(rate);
    if (isNaN(numRate) || numRate <= 0) {
      setError("Please enter a valid exchange rate");
      return;
    }

    setIsUpdating(true);
    setError("");

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ usd_to_inr_rate: numRate }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error ?? "Update failed");
      } else {
        router.refresh();
        setOpen(false);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-300 transition-colors"
        title="Update USD to INR exchange rate"
      >
        <Settings className="w-3.5 h-3.5" />
        ₹{currentRate}/USD
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative glass-card w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-white">Exchange Rate Settings</h2>
                <p className="text-xs text-gray-500 mt-0.5">Update USD to INR conversion rate</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  USD to INR Rate
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="input w-full"
                  placeholder="83.50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Current rate: ₹{currentRate} per USD
                </p>
              </div>

              {error && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleUpdate}
                  disabled={isUpdating}
                  className="btn-primary flex-1"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Rate"
                  )}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  disabled={isUpdating}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
