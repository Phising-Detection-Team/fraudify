"use client";

import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  // TODO(AUTH): Wrap the layout in <SessionProvider> once authentication is configured
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
