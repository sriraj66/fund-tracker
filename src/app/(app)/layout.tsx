"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import { Menu } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth/login");
    }
  }, [user, loading, router]);

  // Close sidebar on route changes (navigation)
  useEffect(() => {
    setSidebarOpen(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-gray-950 overflow-x-hidden">
      {/* Sidebar — desktop: always visible, mobile: drawer */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen md:ml-60 min-w-0">
        {/* Mobile top header — hidden on desktop */}
        <header className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800/60 flex items-center px-4 gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs">
              FT
            </div>
            <span className="text-sm font-semibold text-white">FundTracker</span>
          </div>
        </header>

        {/* Page content — top padding on mobile for fixed header */}
        <main className="flex-1 pt-14 md:pt-0 min-w-0" style={{ overflowX: "clip" }}>
          <div className="px-3 py-4 sm:px-4 md:px-6 md:py-6 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
