"use client";

import { StatCard } from "@/components/dashboard/StatCard";
import { RoundTable } from "@/components/dashboard/RoundTable";
import { CostPieChart } from "@/components/dashboard/CostPieChart";
import { AgentLogsTable } from "@/components/dashboard/AgentLogsTable";
import { Mail, ShieldAlert, BadgeDollarSign, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  MOCK_STATS_ADMIN,
  MOCK_ROUNDS,
  MOCK_AGENTS,
} from "@/lib/mock-data";
import {
  getAdminStats,
  getAdminRounds,
  getAdminAgents,
} from "@/lib/admin-api";
import { config } from "@/lib/config";

export default function AdminDashboard() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  // Real data state
  const [stats, setStats] = useState({
    totalApiCost: 0,
    activeAgents: 0,
    totalEmailsScanned: 0,
    phishingDetected: 0,
  });
  const [rounds, setRounds] = useState([]);
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    const demoFlag =
      localStorage.getItem(config.STORAGE_KEYS.IS_DEMO) === "true";
    setIsDemo(demoFlag);

    if (demoFlag) {
      setStats(MOCK_STATS_ADMIN);
      setRounds(MOCK_ROUNDS as any);
      setAgents(MOCK_AGENTS as any);
      setLoading(false);
    } else if (session?.accessToken) {
      const fetchData = async () => {
        try {
          const [statsData, roundsData, agentsData] = await Promise.all([
            getAdminStats(session.accessToken),
            getAdminRounds(session.accessToken),
            getAdminAgents(session.accessToken),
          ]);
          setStats(statsData);
          setRounds(roundsData);
          setAgents(agentsData);
        } catch (error) {
          console.error("Failed to fetch admin data:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    } else {
      setLoading(false);
    }
  }, [session]);

  const mergedCosts = rounds.flatMap(r => r.apiCosts).reduce((acc, curr) => {
    const existing = acc.find(a => a.model === curr.model);
    if (existing) {
      existing.cost += curr.cost;
      existing.calls += curr.calls;
    } else {
      acc.push({ ...curr });
    }
    return acc;
  }, [] as any[]);

  if (loading) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Overview</h1>
        <p className="text-muted-foreground mt-2">System performance, cost analysis, and active agents.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total API Cost"
          value={`$${stats.totalApiCost?.toLocaleString()}`}
          icon={BadgeDollarSign}
          trend={isDemo ? { value: 4.5, isPositive: false } : undefined}
          delay={0.1}
          valueClassName="text-accent-cyan"
        />
        <StatCard
          title="Active Agents"
          value={stats.activeAgents || 0}
          icon={Activity}
          delay={0.2}
        />
        <StatCard
          title="Global Scanning"
          value={stats.totalEmailsScanned.toLocaleString()}
          icon={Mail}
          delay={0.3}
        />
        <StatCard
          title="Total Threats Detected"
          value={stats.phishingDetected.toLocaleString()}
          icon={ShieldAlert}
          valueClassName="text-accent-red"
          delay={0.4}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div 
          className="lg:col-span-2 flex flex-col gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <RoundTable rounds={rounds} />
        </motion.div>
        
        <motion.div 
          className="lg:col-span-1 flex flex-col gap-6 h-full"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <div className="flex-1 min-h-[300px]">
            <CostPieChart data={mergedCosts} />
          </div>
          <div className="flex-1 min-h-[350px]">
            <AgentLogsTable agents={agents} />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
