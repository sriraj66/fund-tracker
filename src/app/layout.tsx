import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "FundTracker — My Investment Portfolio",
  description: "Track Mutual Funds, Stocks, US Stocks, Crypto & Gold in one place",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FundTracker",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* iOS home screen icons */}
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
        {/* iOS splash screen colour */}
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Register service worker — enables beforeinstallprompt on Chrome/Android */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){});}`,
          }}
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
