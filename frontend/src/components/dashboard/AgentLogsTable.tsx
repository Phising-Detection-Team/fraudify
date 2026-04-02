"use client";

import { Agent } from "@/types";
import { Activity, BrainCircuit, Cpu, Coins, Clock } from "lucide-react";
import { parseUTC } from "@/lib/utils";

function formatLastActive(iso: string): string {
  if (!iso || iso === "null" || iso === "undefined") return "Never";
  const date = parseUTC(iso);
  if (isNaN(date.getTime())) return iso;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function AgentLogsTable({ agents }: { agents: Agent[] }) {
  return (
    <div className="glass-panel p-6 rounded-xl flex flex-col h-full">
      <h3 className="text-lg font-semibold mb-4">Active Agents</h3>

      <div className="flex flex-col gap-3 flex-1">
        {agents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No agents found.
          </p>
        ) : (
          agents.map((agent) => {
            const isDetector = agent.type === "detector";
            const accentClass = isDetector
              ? "text-accent-purple"
              : "text-accent-cyan";
            const bgClass = isDetector
              ? "bg-accent-purple/10"
              : "bg-accent-cyan/10";

            return (
              <div
                key={agent.id}
                className="rounded-lg bg-background/40 border border-border/40 hover:border-border transition-colors overflow-hidden"
              >
                {/* Header row */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-1.5 rounded-md ${bgClass} ${accentClass} shrink-0`}>
                      {isDetector ? (
                        <Activity size={15} />
                      ) : (
                        <BrainCircuit size={15} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight">{agent.name}</p>
                      <p className={`text-[11px] font-mono mt-0.5 truncate ${accentClass}`}>
                        {agent.model}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 ml-3 px-2 py-1 rounded-full text-[10px] uppercase font-bold tracking-widest ${
                      agent.status === "active"
                        ? "bg-accent-green/10 text-accent-green"
                        : agent.status === "training"
                        ? "bg-accent-cyan/10 text-accent-cyan animate-pulse"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {agent.status}
                  </span>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 divide-x divide-border/30">
                  <div className="flex flex-col items-center justify-center px-3 py-3 gap-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Cpu size={11} />
                      <span className="text-[10px] uppercase tracking-wider font-semibold">
                        Calls
                      </span>
                    </div>
                    <span className="text-sm font-bold tabular-nums">
                      {agent.emailsProcessed.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex flex-col items-center justify-center px-3 py-3 gap-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Coins size={11} />
                      <span className="text-[10px] uppercase tracking-wider font-semibold">
                        Cost
                      </span>
                    </div>
                    <span className="text-sm font-bold tabular-nums">
                      ${((agent.totalCost ?? 0)).toFixed(
                        (agent.totalCost ?? 0) < 0.01 ? 6 : 4
                      )}
                    </span>
                  </div>

                  <div className="flex flex-col items-center justify-center px-3 py-3 gap-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock size={11} />
                      <span className="text-[10px] uppercase tracking-wider font-semibold">
                        Last Active
                      </span>
                    </div>
                    <span className="text-sm font-bold">
                      {formatLastActive(agent.lastActive)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
