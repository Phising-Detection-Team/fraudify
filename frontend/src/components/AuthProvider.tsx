"use client";

import { SessionProvider } from "next-auth/react";
import { LoadingProvider } from "@/context/LoadingContext";
import { PageLoader } from "@/components/PageLoader";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LoadingProvider>
        <PageLoader />
        {children}
      </LoadingProvider>
    </SessionProvider>
  );
}