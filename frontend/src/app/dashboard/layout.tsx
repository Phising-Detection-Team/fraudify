"use client";

import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { ReactNode, useEffect, useState } from "react";
import { Toaster } from "sonner";
import { signOut } from "next-auth/react";
import { registerSignOut } from "@/lib/api-fetch";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Register the signOut function so apiFetch can call it on 401
  useEffect(() => {
    registerSignOut(signOut);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-auto p-4 md:p-6" style={{ overscrollBehavior: "contain" }}>
          {children}
        </main>
      </div>
      <Toaster position="top-right" theme="dark" richColors />
    </div>
  );
}
