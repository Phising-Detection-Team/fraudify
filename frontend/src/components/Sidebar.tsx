"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";

import {
  LayoutDashboard,
  ShieldAlert,
  Activity,
  CreditCard,
  Settings,
  LogOut,
  Users,
  BrainCircuit,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  
  // TODO(AUTH): Replace with actual useSession context 
  const isAdmin = pathname.includes('/dashboard/admin');
  const basePath = isAdmin ? "/dashboard/admin" : "/dashboard/user";
  
  const [userName, setUserName] = useState("User");
  
  useEffect(() => {
    // Basic sync
    const storedRole = localStorage.getItem("sentra-role");
    setUserName(storedRole === "admin" ? "Bob Admin" : "Alice Security");
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem("sentra-role");
    router.push("/login");
  };

  const navLinks = [
    { name: "Dashboard", href: basePath, icon: LayoutDashboard },
    { name: "Rounds", href: `${basePath}/rounds`, icon: ShieldAlert },
    { name: "Live Feed", href: `${basePath}/feed`, icon: Activity },
    ...(isAdmin ? [
      { name: "Team Overview", href: `${basePath}/team`, icon: Users },
      { name: "Training", href: `${basePath}/training`, icon: BrainCircuit },
    ] : [
      { name: "Credits", href: `${basePath}/credits`, icon: CreditCard },
    ]),
    { name: "Settings", href: `${basePath}/settings`, icon: Settings },
  ];

  return (
    <div className="w-64 h-full border-r border-border/50 glass-panel !rounded-none flex flex-col hidden md:flex sticky top-0">
      <div className="p-6">
        <Logo />
      </div>
      
      <div className="flex-1 px-4 py-4 space-y-1">
        {navLinks.map((link) => {
          const isActive = pathname === link.href || (pathname.startsWith(link.href) && link.href !== basePath);
          const Icon = link.icon;
          
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${
                isActive 
                  ? "bg-accent-cyan/10 text-accent-cyan shadow-[inset_2px_0_0_hsl(var(--accent-cyan))]" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon size={18} className={isActive ? "text-accent-cyan" : ""} />
              {link.name}
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-border/50 mt-auto">
        <div className="flex items-center gap-3 px-3 py-3 rounded-lg mb-2 bg-background/50 border border-border/30">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-cyan to-accent-purple flex items-center justify-center text-white font-bold text-xs">
            {userName[0]}
          </div>
          <div className="flex flex-col flex-1 overflow-hidden">
            <span className="text-sm font-medium truncate">{userName}</span>
            <span className="text-xs text-muted-foreground capitalize">{isAdmin ? "Admin" : "User"}</span>
          </div>
        </div>
        
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all text-sm font-medium text-muted-foreground hover:bg-accent-red/10 hover:text-accent-red"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
