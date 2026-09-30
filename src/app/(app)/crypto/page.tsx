"use client";

import { Bitcoin } from "lucide-react";
import TrackerSection from "@/components/tracker/TrackerSection";

export default function CryptoPage() {
  return (
    <TrackerSection
      asset="crypto"
      title="Crypto"
      subtitle="Synced from Portfolio Tracker snapshots"
      label="crypto holdings"
      icon={Bitcoin}
      iconColor="text-orange-400"
      iconBg="bg-orange-500/10"
    />
  );
}
