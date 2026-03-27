"use client";

import { Menu } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./Logo";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="h-16 border-b border-border/50 glass-panel !rounded-none flex items-center justify-between px-4 md:px-8 sticky top-0 z-40 relative">
      <div className="flex items-center gap-3 md:hidden">
        <button
          aria-label="Toggle navigation menu"
          onClick={onMenuClick}
          className="p-2 -ml-2 text-muted-foreground hover:bg-muted rounded-md"
        >
          <Menu size={20} />
        </button>
        <Logo className="scale-75 origin-left" showText={false} />
      </div>
      
      <div className="hidden md:flex flex-1" />

      <div className="flex items-center gap-4">
        <ThemeToggle />
      </div>
    </header>
  );
}
