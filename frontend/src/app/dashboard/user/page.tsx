"use client";

import { config } from "@/lib/config";
import { StatCard } from "@/components/dashboard/StatCard";
import { LiveFeed } from "@/components/dashboard/LiveFeed";
import { RoundTable } from "@/components/dashboard/RoundTable";
import { MOCK_STATS_USER, MOCK_ROUNDS } from "@/lib/mock-data";
import { Mail, ShieldAlert, ShieldCheck, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getUserStats, getUserRounds } from "@/lib/user-api";
import type { Round } from "@/types";

export default function UserDashboard() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  // Real data state
  const [stats, setStats] = useState({
    totalEmailsScanned: 0,
    phishingDetected: 0,
    markedSafe: 0,
    creditsRemaining: 1000, // default starting credits
  });
  const [rounds, setRounds] = useState<Round[]>([]);

  useEffect(() => {
    const demoFlag =
      localStorage.getItem(config.STORAGE_KEYS.IS_DEMO) === "true";
    setIsDemo(demoFlag);

    if (demoFlag) {
      setStats(MOCK_STATS_USER);
      setRounds(MOCK_ROUNDS as Round[]);
      setLoading(false);
    } else if (session?.user?.fromBackend) {
      const fetchData = async () => {
        try {
          const [statsData, roundsData] = await Promise.all([
            getUserStats(session.accessToken ?? ''),
            getUserRounds(session.accessToken ?? ''),
          ]);
          setStats(statsData);
          setRounds(roundsData);
        } catch (error) {
          console.error("Failed to fetch user data:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    } else {
      setLoading(false);
    }
  }, [session]);

  if (loading) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
        <p className="text-muted-foreground mt-2">Real-time insights and latest detection rounds.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Emails Scanned"
          value={stats.totalEmailsScanned.toLocaleString()}
          icon={Mail}
          trend={isDemo ? { value: 12, isPositive: true } : undefined}
          delay={0.1}
        />
        <StatCard
          title="Phishing Detected"
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
          title="Credits Remaining"
          value={stats.creditsRemaining.toLocaleString()}
          icon={Zap}
          delay={0.4}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div 
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <RoundTable rounds={rounds} />
        </motion.div>
        
        <motion.div 
          className="lg:col-span-1 h-[500px]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <LiveFeed isDemo={isDemo} />
        </motion.div>
      </div>
    </div>
  );
}
