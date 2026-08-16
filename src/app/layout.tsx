import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FundTracker — My Investment Portfolio",
  description: "Track Mutual Funds, Stocks, US Stocks, Crypto & Gold in one place",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}