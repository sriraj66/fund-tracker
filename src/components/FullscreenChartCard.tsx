"use client";

import { useEffect, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { ResponsiveContainer } from "recharts";
import { Maximize2, X } from "lucide-react";
import { useScrollLock } from "@/hooks/useScrollLock";

interface Props {
  title: string;
  subtitle?: string;
  heightClass?: string;
  // Stretch to the grid row height; chart keeps a 16rem minimum.
  fill?: boolean;
  // `big` is true in full-screen so the chart can use larger ticks and bars.
  children: (big: boolean) => ReactElement;
}

export default function FullscreenChartCard({ title, subtitle, heightClass = "h-56 sm:h-64", fill = false, children }: Props) {
  const [full, setFull] = useState(false);
  useScrollLock(full);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  return (
    <>
      <div className={`glass-card p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 min-w-0 overflow-hidden ${fill ? "h-full flex flex-col" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={() => setFull(true)}
            className="flex-shrink-0 p-2 rounded-lg bg-gray-800/60 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
            aria-label="View chart full screen"
            title="Full screen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
        {fill ? (
          <div className="relative flex-1 min-h-[16rem]">
            <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">{children(false)}</ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className={heightClass}>
            <ResponsiveContainer width="100%" height="100%">{children(false)}</ResponsiveContainer>
          </div>
        )}
      </div>

      {full && createPortal(
        <div className="fixed inset-0 z-[60] bg-gray-950 flex flex-col p-3 gap-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-white">{title}</h3>
              {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={() => setFull(false)}
              className="flex-shrink-0 p-2 rounded-lg bg-gray-800 text-gray-300 hover:text-white"
              aria-label="Close full screen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">{children(true)}</ResponsiveContainer>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
