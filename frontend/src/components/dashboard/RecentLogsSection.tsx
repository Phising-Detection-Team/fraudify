"use client";

import { type LogEntry } from "@/lib/admin-api";
import Link from "next/link";
import { parseUTC } from "@/lib/utils";

const LEVEL_STYLES: Record<string, string> = {
  info: "bg-accent-cyan/10 text-accent-cyan",
  warning: "bg-yellow-500/10 text-yellow-400",
  error: "bg-accent-red/10 text-accent-red",
  critical: "bg-accent-red/20 text-accent-red font-bold",
};

interface Props {
  logs: LogEntry[];
}

export function RecentLogsSection({ logs }: Props) {
  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      <div className="p-6 border-b border-border/50 flex justify-between items-center bg-card/30">
        <h3 className="text-lg font-semibold">Recent System Logs</h3>
        <Link
          href="/dashboard/admin/logs"
          className="text-sm text-accent-cyan hover:underline hover:text-accent-cyan/80 transition-colors"
        >
          View All
        </Link>
      </div>

      {logs.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground">No logs yet.</div>
      ) : (
        <ul className="divide-y divide-border/30">
          {logs.map((log) => (
            <li key={log.id} className="px-6 py-3 flex items-start gap-3">
              <span
                className={`mt-0.5 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${
                  LEVEL_STYLES[log.level] ?? "bg-muted text-muted-foreground"
                }`}
              >
                {log.level}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{log.message}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {parseUTC(log.timestamp).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {log.round_id != null && (
                    <span className="ml-2 text-muted-foreground/60">
                      Round #{log.round_id}
                    </span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
