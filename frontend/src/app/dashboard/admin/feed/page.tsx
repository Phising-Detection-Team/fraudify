"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Wifi, WifiOff, RefreshCw, Users, Activity, Clock } from "lucide-react";
import { getAllExtensionInstances, type ExtensionInstance } from "@/lib/admin-api";
import { parseUTC } from "@/lib/utils";

function StatCard({ label, value, icon: Icon, highlight }: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  highlight?: string;
}) {
  return (
    <div className="glass-panel rounded-xl p-5 flex items-center gap-4">
      <div className="p-3 rounded-lg bg-muted/30">
        <Icon size={20} className="text-accent-cyan" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${highlight ?? ""}`}>{value}</p>
      </div>
    </div>
  );
}

function Initials({ name }: { name: string }) {
  const chars = name.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");
  return (
    <div className="w-8 h-8 rounded-full bg-accent-cyan/20 text-accent-cyan flex items-center justify-center text-xs font-bold flex-shrink-0">
      {chars}
    </div>
  );
}

export default function AdminLiveFeedPage() {
  const { data: session } = useSession();
  const [instances, setInstances] = useState<ExtensionInstance[]>([]);
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchData() {
    if (!session?.accessToken) return;
    try {
      const result = await getAllExtensionInstances(session.accessToken);
      setInstances(result.data);
      setTotal(result.total);
      setActive(result.active);
      setLastRefresh(new Date());
    } catch {
      // keep stale data on error
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!session?.accessToken || !session.user?.fromBackend) {
      setLoading(false);
      return;
    }
    fetchData();

    function startPolling() {
      if (!intervalRef.current) {
        intervalRef.current = setInterval(fetchData, 30_000);
      }
    }
    function stopPolling() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        fetchData();
        startPolling();
      } else {
        stopPolling();
      }
    }

    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Count instances active in last 24h
  const last24h = instances.filter((i) => {
    if (!i.last_seen) return false;
    return Date.now() - parseUTC(i.last_seen).getTime() < 86_400_000;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live Feed</h1>
          <p className="text-muted-foreground mt-1">
            Real-time view of all active browser extension instances.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {lastRefresh && (
        <p className="text-xs text-muted-foreground -mt-4">
          Last updated {lastRefresh.toLocaleTimeString()} · auto-refreshes every 10s
        </p>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Registered" value={total} icon={Users} />
        <StatCard
          label="Currently Active"
          value={active}
          icon={Wifi}
          highlight={active > 0 ? "text-accent-green" : ""}
        />
        <StatCard label="Active Last 24h" value={last24h} icon={Clock} />
      </div>

      {/* Instances table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="p-5 border-b border-border/50 flex items-center gap-2 bg-card/30">
          <Activity size={16} className="text-accent-cyan" />
          <h3 className="font-semibold">Extension Instances</h3>
          {active > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-green/10 text-accent-green">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
              {active} active
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <RefreshCw size={16} className="animate-spin" />
            Loading…
          </div>
        ) : instances.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground space-y-2">
            <WifiOff size={28} className="mx-auto" />
            <p className="text-sm font-medium">No extension instances registered yet</p>
            <p className="text-xs">Users can register instances from their Profile Settings page.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-background/50 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">User</th>
                  <th className="px-6 py-4 font-medium">Browser</th>
                  <th className="px-6 py-4 font-medium">OS</th>
                  <th className="px-6 py-4 font-medium">Last Seen</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {instances.map((inst) => (
                  <tr key={inst.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Initials name={inst.user?.username ?? "?"} />
                        <div>
                          <p className="font-medium text-sm">{inst.user?.username ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{inst.user?.email ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{inst.browser ?? "—"}</td>
                    <td className="px-6 py-4 text-muted-foreground">{inst.os_name ?? "—"}</td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {inst.last_seen
                        ? parseUTC(inst.last_seen).toLocaleString()
                        : "Never"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          inst.is_active
                            ? "bg-accent-green/10 text-accent-green"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {inst.is_active && (
                          <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                        )}
                        {inst.is_active ? "Active" : "Idle"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
