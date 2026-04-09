"use client";

import { StatCard } from "@/components/dashboard/StatCard";
import { RoundTable } from "@/components/dashboard/RoundTable";
import { CostPieChart } from "@/components/dashboard/CostPieChart";
import { AgentLogsTable } from "@/components/dashboard/AgentLogsTable";
import { RecentLogsSection } from "@/components/dashboard/RecentLogsSection";
import RecentScansTable from "@/components/admin/RecentScansTable";
import IntelligencePanel from "@/components/admin/IntelligencePanel";
import { Mail, ShieldAlert, BadgeDollarSign, Activity } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  getAdminStats,
  getAdminRounds,
  getAdminAgents,
  getCostBreakdown,
  getLogs,
  getIntelligenceStats,
  getCacheStats,
  getAdminRecentScans,
  type CostBreakdown,
  type LogEntry,
  type IntelligenceStats,
  type CacheStats,
  type AdminScansPage,
} from "@/lib/admin-api";
import { config } from "@/lib/config";
import type { Round, Agent, ModelCost, DashboardStats } from "@/types";

export default function AdminDashboard() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);

  // Real data state
  const [stats, setStats] = useState<DashboardStats>({
    totalApiCost: 0,
    activeAgents: 0,
    totalEmailsScanned: 0,
    phishingDetected: 0,
    markedSafe: 0,
    creditsRemaining: 0,
  });
  const [rounds, setRounds] = useState<Round[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown>({ items: [], total: 0 });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [intelStats, setIntelStats] = useState<IntelligenceStats>({
    confidence_distribution: [],
    accuracy_over_rounds: [],
    fp_fn_rates: [],
    top_phishing_words: [],
  });
  const [cacheStats, setCacheStats] = useState<CacheStats>({ cached_keys: 0, available: false });
  const [initialScans, setInitialScans] = useState<AdminScansPage>({
    scans: [],
    total: 0,
    page: 1,
    per_page: 10,
    pages: 1,
  });

  useEffect(() => {
    if (session?.user?.fromBackend) {
      const token = session.accessToken ?? "";
      const fetchAll = async () => {
        try {
          // All 8 requests in one parallel batch — single round-trip window
          const [
            statsData,
            roundsData,
            agentsData,
            costData,
            logsData,
            intelData,
            cacheData,
            scansData,
          ] = await Promise.all([
            getAdminStats(token),
            getAdminRounds(token),
            getAdminAgents(token),
            getCostBreakdown(token).catch(() => ({ items: [], total: 0 } as CostBreakdown)),
            getLogs(token, 5).catch(() => [] as LogEntry[]),
            getIntelligenceStats(token).catch(() => ({
              confidence_distribution: [],
              accuracy_over_rounds: [],
              fp_fn_rates: [],
              top_phishing_words: [],
            } as IntelligenceStats)),
            getCacheStats(token).catch(() => ({ cached_keys: 0, available: false } as CacheStats)),
            getAdminRecentScans(token, 1, 10).catch(() => ({
              scans: [],
              total: 0,
              page: 1,
              per_page: 10,
              pages: 1,
            } as AdminScansPage)),
          ]);
          setStats(statsData);
          setRounds(roundsData);
          setAgents(agentsData);
          setCostBreakdown(costData);
          setLogs(logsData);
          setIntelStats(intelData);
          setCacheStats(cacheData);
          setInitialScans(scansData);
        } catch (error) {
          console.error("Failed to fetch admin data:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchAll();
    } else {
      setLoading(false);
    }
  }, [session]);


  if (loading) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Overview</h1>
        <p className="text-muted-foreground mt-2">
          System performance, cost analysis, and active agents.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total API Cost"
          value={`$${stats.totalApiCost?.toLocaleString()}`}
          icon={BadgeDollarSign}
          delay={0.1}
          valueClassName="text-accent-cyan"
        />
        <StatCard
          title="Active Agents"
          value={stats.activeAgents || 0}
          icon={Activity}
          delay={0.15}
        />
        <StatCard
          title="Global Scanning"
          value={stats.totalEmailsScanned.toLocaleString()}
          icon={Mail}
          delay={0.2}
        />
        <StatCard
          title="Total Threats Detected"
          value={stats.phishingDetected.toLocaleString()}
          icon={ShieldAlert}
          valueClassName="text-accent-red"
          delay={0.25}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <RoundTable rounds={rounds} />
          {session?.user?.fromBackend && (
            <RecentScansTable initialData={initialScans} />
          )}
          {session?.user?.fromBackend && <RecentLogsSection logs={logs} />}
        </div>

        <div className="lg:col-span-1 flex flex-col gap-6 h-full">
          <div className="flex-1 min-h-[300px]">
            <CostPieChart serverData={costBreakdown} />
          </div>
          <div className="flex-1 min-h-[350px]">
            <AgentLogsTable agents={agents} />
          </div>
        </div>
      </div>

      {session?.user?.fromBackend && (
        <IntelligencePanel
          stats={intelStats}
          cacheStats={cacheStats}
        />
      )}
    </div>
  );
}
