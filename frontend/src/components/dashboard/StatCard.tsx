"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; isPositive: boolean };
  delay?: number;
  className?: string;
  valueClassName?: string;
}

export function StatCard({ title, value, icon: Icon, trend, delay = 0, className, valueClassName }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn("glass-panel p-6 rounded-xl flex flex-col gap-4 relative overflow-hidden group", className)}
    >
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-accent-cyan/10 to-accent-purple/10 rounded-full blur-2xl group-hover:bg-accent-cyan/20 transition-all duration-500" />
      
      <div className="flex items-center justify-between z-10">
        <div className="p-2.5 rounded-lg bg-background/50 border border-border/50 text-muted-foreground group-hover:text-accent-cyan transition-colors">
          <Icon size={20} />
        </div>
        {trend && (
          <div className={cn("text-xs font-semibold px-2 py-1 rounded-full", trend.isPositive ? "text-accent-green bg-accent-green/10" : "text-accent-red bg-accent-red/10")}>
            {trend.isPositive ? "+" : "−"}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>

      <div className="z-10">
        <h3 className="text-sm font-medium text-muted-foreground mb-1">{title}</h3>
        <p className={cn("text-3xl font-bold tracking-tight", valueClassName)}>{value}</p>
      </div>
    </motion.div>
  );
}
