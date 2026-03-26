"use client";

import { Agent } from "@/types";
import { Activity, BrainCircuit } from "lucide-react";

export function AgentLogsTable({ agents }: { agents: Agent[] }) {
  return (
    <div className="glass-panel p-6 rounded-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Active Agents</h3>
      </div>
      
      <div className="overflow-auto flex-1 pr-2 scrollbar-thin">
        <div className="grid gap-4">
          {agents.map((agent) => (
            <div key={agent.id} className="p-4 rounded-lg bg-background/40 border border-border/40 flex flex-col gap-3 group hover:border-border transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${agent.type === 'detector' ? 'bg-accent-purple/10 text-accent-purple' : 'bg-accent-cyan/10 text-accent-cyan'}`}>
                    {agent.type === 'detector' ? <Activity size={16} /> : <BrainCircuit size={16} />}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">{agent.name}</h4>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{agent.model}</p>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold tracking-widest ${
                  agent.status === 'active' ? 'bg-accent-green/10 text-accent-green' :
                  agent.status === 'training' ? 'bg-accent-cyan/10 text-accent-cyan animate-pulse' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {agent.status}
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/30 pt-3">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-foreground">{agent.successRate}%</span> success
                </div>
                <div className="flex items-center gap-1 tabular-nums">
                  {agent.emailsProcessed.toLocaleString()} processed
                </div>
                <div className="italic">
                  Active {agent.lastActive}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
