"use client";

import { useEffect, useState } from "react";
import { Download, Share, CheckCircle } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function getIsIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as { MSStream?: unknown }).MSStream;
}

function getIsInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

export default function InstallPWA() {
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setIsIOS(getIsIOS());
    setIsInstalled(getIsInstalled());

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setIsInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } finally {
      setInstalling(false);
    }
  };

  // ── Already installed ──────────────────────────────────────────────────
  if (isInstalled) {
    return (
      <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
        <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-400">App Installed</p>
          <p className="text-xs text-gray-400 mt-0.5">FundTracker is running as a native app on your device.</p>
        </div>
      </div>
    );
  }

  // ── iOS: Show Share → Add to Home Screen instructions ─────────────────
  if (isIOS) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-300 leading-relaxed">
          In <strong className="text-white">Safari</strong>, tap the{" "}
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-700 rounded text-gray-200 text-xs font-medium">
            <Share className="w-3 h-3" /> Share
          </span>{" "}
          button at the bottom of the screen, then tap{" "}
          <strong className="text-white">&ldquo;Add to Home Screen&rdquo;</strong>.
        </p>
        <ol className="space-y-2 text-sm text-gray-400 list-none">
          {[
            "Open this page in Safari (if not already).",
            "Tap the Share button (box with an arrow) at the bottom.",
            "Scroll down and tap \"Add to Home Screen\".",
            "Tap \"Add\" in the top-right corner.",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  // ── Android/Desktop: Install button ───────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Primary install button — triggers native prompt on Chrome/Edge/Android */}
      <button
        onClick={deferredPrompt ? handleInstall : undefined}
        disabled={installing || !deferredPrompt}
        className="inline-flex items-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
      >
        <Download className="w-4 h-4" />
        {installing ? "Installing…" : "Install App"}
      </button>

      {!deferredPrompt && (
        <p className="text-xs text-gray-500 leading-relaxed">
          The install button activates automatically when your browser is ready.
          If it stays disabled, use your browser menu:
          <span className="block mt-1 text-gray-400">
            <strong className="text-gray-300">Chrome/Edge:</strong> tap ⋮ or click ⊕ in address bar → &ldquo;Add to Home Screen&rdquo; ·{" "}
            <strong className="text-gray-300">Samsung:</strong> ☰ → &ldquo;Add page to&rdquo; ·{" "}
            <strong className="text-gray-300">Firefox:</strong> ⋮ → &ldquo;Install&rdquo;
          </span>
        </p>
      )}
    </div>
  );
}
