"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { config } from "@/lib/config";
import { useSession, signOut } from "next-auth/react";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";

import {
  LayoutDashboard,
  ShieldAlert,
  Activity,
  Settings,
  LogOut,
  Users,
  BrainCircuit,
  MessageSquare,
  ScanText,
  X,
  Info,
} from "lucide-react";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  
  const isAdmin = session?.user?.role === 'admin';
  const basePath = isAdmin ? config.ROUTES.DASHBOARD_ADMIN : config.ROUTES.DASHBOARD_USER;
  
  const [userName, setUserName] = useState("User");
  
  useEffect(() => {
    if (session?.user?.name) {
      setUserName(session.user.name);
    }
  }, [session]);

  const handleSignOut = async () => {
    localStorage.removeItem("sentra-role");
    
    await signOut({ redirect: false });
    router.push(config.ROUTES.LOGIN);
  };

  const navLinks = isAdmin
    ? [
        { name: "Dashboard", href: basePath, icon: LayoutDashboard },
        { name: "Rounds", href: `${basePath}/rounds`, icon: ShieldAlert },
        { name: "Live Feed", href: `${basePath}/feed`, icon: Activity },
        { name: "Users", href: `${basePath}/team`, icon: Users },
        { name: "Training", href: `${basePath}/training`, icon: BrainCircuit },
        { name: "Feedback", href: `${basePath}/feedback`, icon: MessageSquare },
        { name: "Settings", href: `${basePath}/settings`, icon: Settings },
      ]
    : [
        { name: "Dashboard", href: basePath, icon: LayoutDashboard },
        { name: "Scan Email", href: `${basePath}/scan`, icon: ScanText },
        { name: "Training", href: `${basePath}/training`, icon: BrainCircuit },
        { name: "Feedback", href: `${basePath}/feedback`, icon: MessageSquare },
        { name: "Settings", href: `${basePath}/settings`, icon: Settings },
        { name: "About Us", href: "/about", icon: Info },
      ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Content */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-border/50 glass-panel !rounded-none flex flex-col transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div className="p-6 flex items-center justify-between">
          <Logo />
          <button 
            onClick={onClose}
            className="md:hidden p-2 text-muted-foreground hover:bg-muted rounded-md"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navLinks.map((link) => {
          const isActive = pathname === link.href || (pathname.startsWith(link.href + '/') && link.href !== basePath);
          const Icon = link.icon;
          
          return (
            <Link
              key={link.name}
              href={link.href}
              onClick={() => {
                if (onClose) onClose();
              }}
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
            {userName.charAt(0) || "?"}
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
    </>
  );
}
