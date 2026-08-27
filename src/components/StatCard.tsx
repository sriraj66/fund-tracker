import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trend?: {
    value: string;
    positive: boolean;
  };
  className?: string;
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = "text-sky-400",
  iconBg = "bg-sky-500/10",
  trend,
  className,
}: StatCardProps) {
  return (
    <div className={cn("glass-card p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
            {title}
          </p>
          <p className="text-base sm:text-xl md:text-2xl font-bold text-white truncate leading-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1 leading-tight">{subtitle}</p>
          )}
          {trend && (
            <p
              className={cn(
                "text-xs font-medium mt-2",
                trend.positive ? "text-emerald-400" : "text-red-400"
              )}
            >
              {trend.positive ? "▲" : "▼"} {trend.value}
            </p>
          )}
        </div>
        <div
          className={cn(
            "w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ml-2 sm:ml-3",
            iconBg
          )}
        >
          <Icon className={cn("w-4 h-4 sm:w-5 sm:h-5", iconColor)} />
        </div>
      </div>
    </div>
  );
}