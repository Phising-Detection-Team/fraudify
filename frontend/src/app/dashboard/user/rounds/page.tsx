"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ChevronRight, AlertTriangle, Loader2 } from "lucide-react";
import { getAdminRounds } from "@/lib/admin-api";
import { config } from "@/lib/config";
import type { Round } from "@/types";

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-accent-green/10 text-accent-green",
  in_progress: "bg-accent-cyan/10 text-accent-cyan",
  failed: "bg-accent-red/10 text-accent-red",
};

export default function UserRoundsPage() {
  const { data: session } = useSession();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.accessToken || !session.user?.fromBackend) {
      setLoading(false);
      return;
    }
    getAdminRounds(session.accessToken)
      .then(setRounds)
      .catch(() => setRounds([]))
      .finally(() => setLoading(false));
  }, [session]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Detection Rounds</h1>
        <p className="text-muted-foreground mt-1">
          View all synthetic data generation rounds.
        </p>
      </div>

      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-background/50 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-medium">Round ID</th>
                <th className="px-6 py-4 font-medium">Started</th>
                <th className="px-6 py-4 font-medium">Total Emails</th>
                <th className="px-6 py-4 font-medium">Detection Rate</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : rounds.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    No rounds available yet.
                  </td>
                </tr>
              ) : (
                rounds.map((round) => (
                  <tr
                    key={round.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-6 py-4 font-mono font-medium">#{round.id}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {new Date(round.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-6 py-4">{round.totalEmails}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {round.detectionRate > 80 && (
                          <AlertTriangle size={14} className="text-accent-red" />
                        )}
                        <span
                          className={
                            round.detectionRate > 80 ? "text-accent-red font-medium" : ""
                          }
                        >
                          {round.detectionRate}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          STATUS_STYLES[round.status] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {round.status === "in_progress" && (
                          <Loader2 size={10} className="animate-spin" />
                        )}
                        {round.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/user/rounds/${round.id}`}
                        className="inline-flex items-center justify-center p-2 rounded-lg bg-background/50 hover:bg-accent-cyan/10 text-muted-foreground hover:text-accent-cyan transition-colors"
                      >
                        <ChevronRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
