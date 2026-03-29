"use client";

import { config } from "@/lib/config";
import { StatCard } from "@/components/dashboard/StatCard";
import { MOCK_STATS_USER } from "@/lib/mock-data";
import {
  Mail, ShieldAlert, ShieldCheck,
  Puzzle, CheckCircle2, Circle, Wifi, WifiOff,
  Activity, BarChart3, ShieldCheck as ShieldCheckIcon,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getUserStats, type UserStats } from "@/lib/user-api";
import { getExtensionInstances, type ExtensionInstance } from "@/lib/admin-api";
import { getAdminStats } from "@/lib/admin-api";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Onboarding / Protection status panel
// ---------------------------------------------------------------------------

function Step({
  number,
  label,
  done,
  children,
}: {
  number: number;
  label: string;
  done?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold mt-0.5 ${
          done
            ? "border-accent-green bg-accent-green/10 text-accent-green"
            : "border-border text-muted-foreground"
        }`}
      >
        {done ? <CheckCircle2 size={14} /> : number}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${done ? "text-accent-green" : ""}`}>{label}</p>
        {children && <div className="mt-1">{children}</div>}
      </div>
    </div>
  );
}

function OnboardingPanel({ instances }: { instances: ExtensionInstance[] }) {
  const hasInstance = instances.length > 0;
  const hasActive = instances.some((i) => i.is_active);

  if (hasActive) {
    return (
      <div className="glass-panel rounded-xl p-6 space-y-4 border border-accent-green/20">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon size={20} className="text-accent-green" />
          <h3 className="font-semibold text-accent-green">Your Emails are Protected</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Sentra is actively monitoring your inbox. Your browser extension is connected and sending
          heartbeats.
        </p>
        <ul className="space-y-3 pt-1">
          {instances.map((inst) => (
            <li
              key={inst.id}
              className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/10 px-4 py-3"
            >
              <div className={inst.is_active ? "text-accent-green" : "text-muted-foreground"}>
                {inst.is_active ? <Wifi size={16} /> : <WifiOff size={16} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{inst.browser ?? "Extension"}</p>
                {inst.last_seen && (
                  <p className="text-[11px] text-muted-foreground">
                    Last seen {new Date(inst.last_seen).toLocaleString()}
                  </p>
                )}
              </div>
              <span
                className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  inst.is_active
                    ? "bg-accent-green/10 text-accent-green"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {inst.is_active ? "Active" : "Idle"}
              </span>
            </li>
          ))}
        </ul>
        <Link
          href="/dashboard/user/settings"
          className="inline-flex items-center gap-1.5 text-xs text-accent-cyan hover:underline"
        >
          Manage extension instances <ArrowRight size={12} />
        </Link>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Puzzle size={20} className="text-accent-cyan" />
        <h3 className="font-semibold">Get Started with Sentra</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Follow these steps to start protecting your inbox from phishing attacks.
      </p>
      <div className="space-y-4">
        <Step number={1} label="Install the Sentra browser extension" done={false}>
          <p className="text-xs text-muted-foreground">
            Chrome and Firefox support coming soon. The extension scans your incoming emails in
            real-time.
          </p>
        </Step>
        <Step number={2} label="Register your device" done={hasInstance}>
          <p className="text-xs text-muted-foreground">
            Go to{" "}
            <Link href="/dashboard/user/settings" className="text-accent-cyan hover:underline">
              Profile Settings
            </Link>{" "}
            → Browser Extension → click{" "}
            <span className="font-medium text-foreground">Add Instance</span> to generate your
            unique token.
          </p>
        </Step>
        <Step number={3} label="Paste your token into the extension" done={false}>
          <p className="text-xs text-muted-foreground">
            Open the Sentra extension popup, enter your token, and you are protected. The extension
            sends a heartbeat every 5 minutes — this page will show Active once it connects.
          </p>
        </Step>
      </div>
      {!hasInstance && (
        <Link
          href="/dashboard/user/settings"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-cyan/10 text-accent-cyan text-sm font-semibold hover:bg-accent-cyan/20 transition-colors"
        >
          <Puzzle size={14} />
          Register Your First Instance
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Platform stats panel
// ---------------------------------------------------------------------------

function PlatformStatsPanel({ token }: { token: string }) {
  const [platformStats, setPlatformStats] = useState<{
    totalEmailsScanned: number;
    phishingDetected: number;
    activeAgents: number;
  } | null>(null);

  useEffect(() => {
    getAdminStats(token)
      .then((d) =>
        setPlatformStats({
          totalEmailsScanned: d.totalEmailsScanned,
          phishingDetected: d.phishingDetected,
          activeAgents: d.activeAgents ?? 0,
        })
      )
      .catch(() => {});
  }, [token]);

  const rows = [
    {
      icon: Mail,
      label: "Training emails analysed",
      value: platformStats?.totalEmailsScanned.toLocaleString() ?? "—",
    },
    {
      icon: ShieldAlert,
      label: "Phishing patterns detected",
      value: platformStats?.phishingDetected.toLocaleString() ?? "—",
    },
    {
      icon: Activity,
      label: "AI agents active",
      value: platformStats?.activeAgents ?? "—",
    },
  ];

  return (
    <div className="glass-panel rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2 border-b border-border/50 pb-3">
        <BarChart3 size={18} className="text-accent-cyan" />
        <h3 className="font-semibold">Platform Intelligence</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Sentra continuously trains its AI model on synthetic phishing data so it can protect you
        from real-world threats.
      </p>
      <ul className="space-y-3">
        {rows.map(({ icon: Icon, label, value }) => (
          <li key={label} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon size={14} className="flex-shrink-0" />
              {label}
            </div>
            <span className="text-sm font-semibold tabular-nums">{value}</span>
          </li>
        ))}
      </ul>
      <div className="pt-2 border-t border-border/50">
        <div className="flex items-center gap-2">
          <Circle size={8} className="fill-accent-green text-accent-green" />
          <span className="text-xs text-muted-foreground">AI model online and improving</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function UserDashboard() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const [stats, setStats] = useState<UserStats>({
    totalEmailsScanned: 0,
    phishingDetected: 0,
    markedSafe: 0,
    creditsRemaining: 1000,
  });
  const [instances, setInstances] = useState<ExtensionInstance[]>([]);

  useEffect(() => {
    const demoFlag = localStorage.getItem(config.STORAGE_KEYS.IS_DEMO) === "true";
    setIsDemo(demoFlag);

    if (demoFlag) {
      setStats(MOCK_STATS_USER);
      setLoading(false);
    } else if (session?.user?.fromBackend && session.accessToken) {
      const token = session.accessToken;
      Promise.all([
        getUserStats(token).then(setStats).catch(() => {}),
        getExtensionInstances(token).then(setInstances).catch(() => {}),
      ]).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [session]);

  const hasActiveExtension = instances.some((i) => i.is_active);

  if (loading) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
        <p className="text-muted-foreground mt-2">
          Your personal protection status and inbox security insights.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Emails Scanned"
          value={stats.totalEmailsScanned.toLocaleString()}
          icon={Mail}
          trend={isDemo ? { value: 12, isPositive: true } : undefined}
          delay={0.1}
        />
        <StatCard
          title="Threats Blocked"
          value={stats.phishingDetected.toLocaleString()}
          icon={ShieldAlert}
          valueClassName="text-accent-red"
          trend={isDemo ? { value: 5, isPositive: false } : undefined}
          delay={0.2}
        />
        <StatCard
          title="Marked Safe"
          value={stats.markedSafe.toLocaleString()}
          icon={ShieldCheck}
          valueClassName="text-accent-green"
          trend={isDemo ? { value: 8, isPositive: true } : undefined}
          delay={0.3}
        />
        <StatCard
          title="Extension Status"
          value={isDemo ? "Active" : hasActiveExtension ? "Active" : "Not installed"}
          icon={Puzzle}
          valueClassName={
            isDemo || hasActiveExtension ? "text-accent-green" : "text-muted-foreground"
          }
          delay={0.4}
        />
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <OnboardingPanel instances={isDemo ? [] : instances} />
        </motion.div>

        <motion.div
          className="lg:col-span-1"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          {session?.user?.fromBackend && session.accessToken ? (
            <PlatformStatsPanel token={session.accessToken} />
          ) : (
            <div className="glass-panel rounded-xl p-6 space-y-3">
              <div className="flex items-center gap-2 border-b border-border/50 pb-3">
                <BarChart3 size={18} className="text-accent-cyan" />
                <h3 className="font-semibold">Platform Intelligence</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Sentra trains AI on synthetic phishing data to protect your inbox. Log in with a
                backend account to see live platform stats.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
