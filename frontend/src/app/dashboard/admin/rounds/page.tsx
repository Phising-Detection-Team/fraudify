"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ChevronRight, Plus, AlertTriangle, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createRound, runRound, getRound, getAdminRounds } from "@/lib/admin-api";
import { config } from "@/lib/config";
import type { Round } from "@/types";

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-accent-green/10 text-accent-green",
  in_progress: "bg-accent-cyan/10 text-accent-cyan",
  failed: "bg-accent-red/10 text-accent-red",
};

export default function AdminRoundsPage() {
  const { data: session } = useSession();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [totalEmails, setTotalEmails] = useState(10);
  const [parallelWorkflows, setParallelWorkflows] = useState(2);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  useEffect(() => {
    return () => {
      pollingRefs.current.forEach(clearInterval);
    };
  }, []);

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

  function startPolling(roundId: string) {
    if (pollingRefs.current.has(roundId)) return;
    const interval = setInterval(async () => {
      if (!session?.accessToken) return;
      try {
        const updated = await getRound(session.accessToken, Number(roundId));
        setRounds((prev) =>
          prev.map((r) => (r.id === roundId ? updated : r))
        );
        if (updated.status !== "in_progress") {
          clearInterval(interval);
          pollingRefs.current.delete(roundId);
        }
      } catch {
        // keep polling
      }
    }, 5000);
    pollingRefs.current.set(roundId, interval);
  }

  async function handleTrigger() {
    if (!session?.accessToken) return;
    setTriggering(true);
    setError(null);
    try {
      const { id: newId } = await createRound(session.accessToken, totalEmails);
      const placeholder: Round = {
        id: String(newId),
        date: new Date().toISOString(),
        totalEmails,
        detectionRate: 0,
        status: "in_progress",
        detected: 0,
        emails: [],
        apiCosts: [],
      };
      setRounds((prev) => [placeholder, ...prev]);
      await runRound(session.accessToken, newId, parallelWorkflows);
      setShowModal(false);
      startPolling(String(newId));
    } catch (e) {
      setError((e as Error).message ?? "Failed to trigger round");
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Detection Rounds</h1>
          <p className="text-muted-foreground mt-1">
            All synthetic data generation rounds.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-cyan text-black font-semibold text-sm hover:bg-accent-cyan/90 transition-colors shadow-[0_4px_14px_hsl(var(--accent-cyan)/0.3)]"
        >
          <Plus size={16} />
          Trigger New Round
        </button>
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
                    No rounds yet. Trigger your first round above.
                  </td>
                </tr>
              ) : (
                rounds.map((round) => (
                  <tr
                    key={round.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-6 py-4 font-mono font-medium">
                      #{round.id}
                    </td>
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
                            round.detectionRate > 80
                              ? "text-accent-red font-medium"
                              : ""
                          }
                        >
                          {round.detectionRate}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          STATUS_STYLES[round.status] ??
                          "bg-muted text-muted-foreground"
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
                        href={`/dashboard/admin/rounds/${round.id}`}
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

      {/* Trigger modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Trigger New Round</h2>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" htmlFor="total-emails">
                    Total Emails
                  </label>
                  <input
                    id="total-emails"
                    type="number"
                    min={1}
                    value={totalEmails}
                    onChange={(e) => setTotalEmails(Number(e.target.value))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent-cyan"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Number of synthetic emails to generate and evaluate.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" htmlFor="parallel-workflows">
                    Parallel Workflows
                  </label>
                  <input
                    id="parallel-workflows"
                    type="number"
                    min={1}
                    max={8}
                    value={parallelWorkflows}
                    onChange={(e) => setParallelWorkflows(Number(e.target.value))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent-cyan"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Concurrent agent pipelines (default: 2).
                  </p>
                </div>

                {error && (
                  <p className="text-sm text-accent-red bg-accent-red/10 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTrigger}
                  disabled={triggering}
                  className="flex-1 py-2.5 rounded-lg bg-accent-cyan text-black font-semibold text-sm hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {triggering ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Starting…
                    </>
                  ) : (
                    "Start Round"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
