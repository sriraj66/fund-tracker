"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

type Scale = "sm" | "md" | "lg";

const SCALES: { value: Scale; label: string; desc: string; preview: string }[] = [
  { value: "sm", label: "Small",   desc: "Compact — fits more on screen",  preview: "Aa" },
  { value: "md", label: "Default", desc: "Standard — balanced readability", preview: "Aa" },
  { value: "lg", label: "Large",   desc: "Accessible — easier to read",    preview: "Aa" },
];

const STORAGE_KEY = "ft_font_scale";
const TEXT_SIZES: Record<Scale, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

export default function FontSizeSetting() {
  const [scale, setScale] = useState<Scale>("md");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Scale | null;
    if (saved && ["sm", "md", "lg"].includes(saved)) setScale(saved);
  }, []);

  const handleSelect = (s: Scale) => {
    setScale(s);
    localStorage.setItem(STORAGE_KEY, s);
    // Apply immediately
    const cl = document.documentElement.classList;
    cl.remove("font-scale-sm", "font-scale-md", "font-scale-lg");
    cl.add(`font-scale-${s}`);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-400">Adjust the text size across the entire app.</p>
      <div className="grid grid-cols-3 gap-3">
        {SCALES.map((s) => {
          const isSelected = scale === s.value;
          return (
            <button
              key={s.value}
              onClick={() => handleSelect(s.value)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                isSelected
                  ? "bg-sky-500/10 border-sky-500/40"
                  : "bg-gray-800/40 border-gray-700/40 hover:bg-gray-800 hover:border-gray-600"
              }`}
            >
              <span
                className={`font-bold text-white ${
                  s.value === "sm" ? "text-lg" : s.value === "md" ? "text-2xl" : "text-4xl"
                }`}
                aria-hidden
              >
                {s.preview}
              </span>
              <div className="text-center">
                <p className={`font-semibold ${isSelected ? "text-sky-400" : "text-gray-300"} text-xs`}>{s.label}</p>
                <p className="text-gray-500 text-xs mt-0.5 hidden sm:block">{s.desc}</p>
              </div>
              {isSelected && (
                <div className="w-4 h-4 rounded-full bg-sky-500 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}