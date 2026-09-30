"use client";

import { BarChart3 } from "lucide-react";
import TrackerSection from "@/components/tracker/TrackerSection";

export default function MutualFundsPage() {
  return (
    <TrackerSection
      asset="mf"
      title="Mutual Funds"
      subtitle="Synced from Portfolio Tracker snapshots"
      label="mutual funds"
      icon={BarChart3}
      iconColor="text-violet-400"
      iconBg="bg-violet-500/10"
    />
  );
}
