"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    color: "text-sky-400",
  },
  {
    href: "/portfolio-tracker",
    label: "Portfolio Tracker",
    icon: LineChart,
    color: "text-purple-400",
  },
  {
    href: "/mutual-funds",
    label: "Mutual Funds",
    icon: BarChart3,
    color: "text-violet-400",
  },
  {
    href: "/stocks",
    label: "Indian Stocks",
    icon: TrendingUp,
    color: "text-emerald-400",
  },
  {
    href: "/us-stocks",
    label: "US Stocks",
    icon: Globe,
    color: "text-blue-400",
  },
  {
    href: "/crypto",
    label: "Crypto",
    icon: Bitcoin,
    color: "text-orange-400",
  },
  {
    href: "/gold",
    label: "Gold",
    icon: Gem,
    color: "text-yellow-400",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    color: "text-gray-400",
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-gray-900 border-r border-gray-800/60 flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-800/60">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
          FT
        </div>
        <div>
          <p className="text-sm font-semibold text-white">FundTracker</p>
          <p className="text-xs text-gray-500">Portfolio Manager</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
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
              {isActive && (
                <ChevronRight className="w-3 h-3 text-gray-500" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="p-3 border-t border-gray-800/60">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all group"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}