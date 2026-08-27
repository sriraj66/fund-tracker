"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Globe,
  Bitcoin,
  Gem,
  BarChart3,
  LogOut,
  ChevronRight,
  LineChart,
  Settings,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { href: "/dashboard",         label: "Dashboard",        icon: LayoutDashboard, color: "text-sky-400"    },
  { href: "/portfolio-tracker", label: "Portfolio Tracker", icon: LineChart,       color: "text-purple-400" },
  { href: "/mutual-funds",      label: "Mutual Funds",     icon: BarChart3,       color: "text-violet-400" },
  { href: "/stocks",            label: "Indian Stocks",    icon: TrendingUp,      color: "text-emerald-400"},
  { href: "/us-stocks",         label: "US Stocks",        icon: Globe,           color: "text-blue-400"   },
  { href: "/crypto",            label: "Crypto",           icon: Bitcoin,         color: "text-orange-400" },
  { href: "/gold",              label: "Gold",             icon: Gem,             color: "text-yellow-400" },
  { href: "/expenses",          label: "Expenses",         icon: Wallet,          color: "text-rose-400"   },
  { href: "/settings",          label: "Settings",         icon: Settings,        color: "text-gray-400"   },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { signOut } = useAuth();

  const handleNavClick = () => {
    // Close drawer on mobile after navigating
    onClose?.();
  };

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar drawer */}
      <aside
        className={cn(
          // Base styles
          "fixed left-0 top-0 h-full w-64 bg-gray-900 border-r border-gray-800/60 flex flex-col z-50",
          // Mobile: slide in/out
          "transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: always visible
          "md:translate-x-0 md:w-60"
        )}
      >
        {/* Logo + mobile close button */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-gray-800/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
              FT
            </div>
            <div>
              <p className="text-sm font-semibold text-white">FundTracker</p>
              <p className="text-xs text-gray-500">Portfolio Manager</p>
            </div>
          </div>
          {/* Close button — only visible on mobile */}
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                  isActive
                    ? "bg-gray-800 text-white shadow-sm"
                    : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0 transition-colors",
                    isActive ? item.color : "text-gray-500 group-hover:text-gray-300"
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="w-3 h-3 text-gray-500" />}
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="p-3 border-t border-gray-800/60">
          <button
            onClick={() => { signOut(); onClose?.(); }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all group"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
