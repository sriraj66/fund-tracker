import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FundTracker — My Investment Portfolio",
    short_name: "FundTracker",
    description: "Track Mutual Funds, Stocks, US Stocks, Crypto & Gold in one place",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#030712",
    theme_color: "#0ea5e9",
    orientation: "portrait-primary",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}