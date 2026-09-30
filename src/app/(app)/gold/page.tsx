"use client";

import { Gem } from "lucide-react";
import TrackerSection from "@/components/tracker/TrackerSection";

export default function GoldPage() {
  return (
    <TrackerSection
      asset="gold"
      title="Gold"
      subtitle="Synced from Portfolio Tracker snapshots"
      label="gold holdings"
      icon={Gem}
      iconColor="text-yellow-400"
      iconBg="bg-yellow-500/10"
    />
  );
}
