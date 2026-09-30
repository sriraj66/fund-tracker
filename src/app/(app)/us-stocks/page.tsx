"use client";

import { Globe } from "lucide-react";
import TrackerSection from "@/components/tracker/TrackerSection";

export default function UsStocksPage() {
  return (
    <TrackerSection
      asset="us_stocks"
      title="US Stocks"
      subtitle="Synced from Portfolio Tracker snapshots"
      label="US stocks"
      icon={Globe}
      iconColor="text-sky-400"
      iconBg="bg-sky-500/10"
      usdToggle
    />
  );
}
