"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useLoading } from "@/context/LoadingContext";

export function PageLoader() {
  const { isLoading, message, hideLoader } = useLoading();
  const pathname = usePathname();

  // Auto-hide when the destination page has finished loading
  useEffect(() => {
    hideLoader();
  }, [pathname, hideLoader]);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="glass-panel flex flex-col items-center gap-4 px-12 py-8 rounded-2xl">
        <Logo className="scale-90" />
        <Loader2 className="w-8 h-8 animate-spin text-accent-cyan" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
