"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Wifi, WifiOff, RefreshCw, Puzzle } from "lucide-react";
import { getExtensionInstances, type ExtensionInstance } from "@/lib/admin-api";
import { parseUTC } from "@/lib/utils";
import Link from "next/link";

export default function UserLiveFeedPage() {
  const { data: session } = useSession();
  const [instances, setInstances] = useState<ExtensionInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchData() {
    if (!session?.accessToken) return;
    try {
      const data = await getExtensionInstances(session.accessToken);
      setInstances(data);
      setLastRefresh(new Date());
    } catch {
      // keep stale data
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

  const activeCount = instances.filter((i) => i.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live Feed</h1>
          <p className="text-muted-foreground mt-1">
            Your registered browser extension instances.
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

      {/* How it works */}
      <div className="glass-panel rounded-xl p-5 flex items-start gap-4 border border-accent-cyan/20">
        <Puzzle size={20} className="text-accent-cyan mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-semibold">How extension tracking works</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Install the Sentra browser extension, then register a new instance from your{" "}
            <Link href="/dashboard/user/settings" className="text-accent-cyan hover:underline">
              Profile Settings
            </Link>
            . The extension uses the generated token to send periodic heartbeats — this page
            updates every 10 seconds to reflect which of your devices are currently active.
          </p>
        </div>
      </div>

      {/* Instances */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="p-5 border-b border-border/50 bg-card/30 flex items-center justify-between">
          <h3 className="font-semibold">My Instances</h3>
          {activeCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-accent-green/10 text-accent-green">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
              {activeCount} active
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <RefreshCw size={16} className="animate-spin" />
            Loading…
          </div>
        ) : instances.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <WifiOff size={28} className="mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">No extension instances registered</p>
            <Link
              href="/dashboard/user/settings"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-cyan/10 text-accent-cyan text-sm font-semibold hover:bg-accent-cyan/20 transition-colors"
            >
              <Puzzle size={14} />
              Register an Instance
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border/30">
            {instances.map((inst) => (
              <li key={inst.id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/20 transition-colors">
                <div className={inst.is_active ? "text-accent-green" : "text-muted-foreground"}>
                  {inst.is_active ? <Wifi size={18} /> : <WifiOff size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {inst.browser ?? "Unknown browser"}
                    </span>
                    {inst.os_name && (
                      <span className="text-xs text-muted-foreground">· {inst.os_name}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 font-mono truncate">
                    {inst.instance_token}
                  </p>
                  {inst.last_seen && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Last seen {parseUTC(inst.last_seen).toLocaleString()}
                    </p>
                  )}
                </div>
                <span
                  className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
