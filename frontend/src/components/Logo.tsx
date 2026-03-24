import React from "react";
import { cn } from "@/lib/utils";

export const Logo = ({ className, showText = true }: { className?: string, showText?: boolean }) => {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <svg
        width="40"
        height="40"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-[0_0_10px_rgba(0,212,255,0.6)]"
      >
        <path
          d="M100 20L30 60V140L100 180L170 140V60L100 20Z"
          stroke="url(#paint0_linear)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M100 65L65 85V115L100 135L135 115V85L100 65Z"
          fill="url(#paint1_linear)"
        />
        <path
          d="M100 135V180"
          stroke="url(#paint2_linear)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="paint0_linear" x1="100" y1="20" x2="100" y2="180" gradientUnits="userSpaceOnUse">
            <stop stopColor="hsl(var(--accent-cyan))" />
            <stop offset="1" stopColor="hsl(var(--accent-purple))" />
          </linearGradient>
          <linearGradient id="paint1_linear" x1="100" y1="65" x2="100" y2="135" gradientUnits="userSpaceOnUse">
            <stop stopColor="hsl(var(--accent-cyan))" stopOpacity="0.8" />
            <stop offset="1" stopColor="hsl(var(--accent-purple))" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="paint2_linear" x1="100" y1="135" x2="100" y2="180" gradientUnits="userSpaceOnUse">
            <stop stopColor="hsl(var(--accent-purple))" />
            <stop offset="1" stopColor="hsl(var(--accent-cyan))" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      {showText && (
        <span className="text-2xl font-bold tracking-widest uppercase neon-text select-none">
          Sentra
        </span>
      )}
    </div>
  );
};
