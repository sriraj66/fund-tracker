import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "FundTracker — My Investment Portfolio",
  description: "Track Mutual Funds, Stocks, US Stocks, Crypto & Gold in one place",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
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
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* App icons */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        {/* iOS splash screen colour */}
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
        {/* Apply font scale before hydration — prevents flash */}
        <Script id="font-scale" strategy="beforeInteractive">{`(function(){var s=localStorage.getItem('ft_font_scale');if(s&&['sm','md','lg'].includes(s)){document.documentElement.classList.add('font-scale-'+s);}})();`}</Script>
        {/* Register service worker */}
        <Script id="sw-register" strategy="afterInteractive">{`if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){});}`}</Script>
      </body>
    </html>
  );
}
