"use client";

import { config } from "@/lib/config";
import { getRound, overrideEmailVerdict } from "@/lib/admin-api";
import { io } from "socket.io-client";
import {
  ShieldAlert,
  ShieldCheck,
  ArrowLeft,
  Bot,
  Activity,
  Loader2,
  X,
  Mail,
  Brain,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { Round } from "@/types";

interface BackendEmail {
  id: number;
  generated_email_subject: string | null;
  generated_email_body: string | null;
  generated_content: string | null;
  is_phishing: boolean;
  detector_verdict: string | null;
  detector_confidence: number | null;
  detector_reasoning: string | null;
  detector_risk_score: number | null;
}

interface DisplayEmail {
  id: string;
  subject: string;
  body: string | null;
  generatorResponse: string;
  detectorResponse: string;
  verdict: "phishing" | "safe";
  confidence: number;
  isPhishing: boolean | null;
  timestamp: string;
}

export function RoundDetailView() {
  const { data: session } = useSession();
  const params = useParams();

  const [loading, setLoading] = useState(true);
  const [round, setRound] = useState<Round | null>(null);
  const [emails, setEmails] = useState<BackendEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<DisplayEmail | null>(null);
  const [overrideVerdict, setOverrideVerdict] = useState<"phishing" | "legitimate">("legitimate");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [overrideSuccess, setOverrideSuccess] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    processed: number;
    total: number;
    accuracy: number;
  } | null>(null);

  const isAdmin = session?.user?.role === "admin";
  const baseHref = isAdmin ? "/dashboard/admin" : "/dashboard/user";

  async function handleOverrideSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEmail || !session?.accessToken) return;
    setOverrideSubmitting(true);
    setOverrideError(null);
    setOverrideSuccess(null);
    try {
      await overrideEmailVerdict(
        session.accessToken,
        Number(selectedEmail.id),
        overrideVerdict,
        overrideReason || undefined
      );
      setOverrideSuccess(`Verdict overridden to "${overrideVerdict}"`);
      setOverrideReason("");
    } catch (err) {
      setOverrideError(err instanceof Error ? err.message : "Override failed");
    } finally {
      setOverrideSubmitting(false);
    }
  }
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const roundId = id ? Number(id) : null;

  // WebSocket subscription for real-time round progress
  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000");

    socket.on(
      "round_progress",
      (data: {
        round_id: number;
        processed: number;
        total: number;
        verdict: string;
        accuracy: number;
      }) => {
        if (data.round_id === roundId) {
          setProgress({
            processed: data.processed,
            total: data.total,
            accuracy: data.accuracy,
          });
        }
      }
    );

    return () => {
      socket.disconnect();
    };
  }, [roundId]);

  useEffect(() => {
    if (!session?.accessToken || !session.user?.fromBackend) {
      setLoading(false);
      return;
    }

    const apiBase = config.API.BASE_URL;
    const token = session.accessToken;

    Promise.all([
      getRound(token, Number(id)),
      fetch(`${apiBase}/api/rounds/${id}/emails?per_page=100`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => (r.ok ? r.json() : { items: [] })),
    ])
      .then(([roundData, emailsJson]) => {
        setRound(roundData);
        setEmails((emailsJson.items ?? emailsJson.data ?? []) as BackendEmail[]);
      })
      .catch(() => {
        setRound(null);
        setEmails([]);
      })
      .finally(() => setLoading(false));
  }, [session, id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 size={20} className="animate-spin" />
        Loading round details…
      </div>
    );
  }

  if (!round) {
    return (
      <div className="space-y-6">
        <Link
          href={baseHref}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent-cyan transition-colors"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
        <div className="p-8 text-center text-muted-foreground pt-20">
          Round not found or no data available yet.
        </div>
      </div>
    );
  }

  const displayEmails: DisplayEmail[] = emails.map((e) => ({
      id: String(e.id),
        subject: e.generated_email_subject ?? "(no subject)",
        body: e.generated_email_body ?? e.generated_content ?? null,
        generatorResponse: e.generated_content ?? "",
        detectorResponse: e.detector_reasoning ?? "",
        verdict: (e.detector_verdict === "phishing" ? "phishing" : "safe") as "phishing" | "safe",
        confidence: Math.round((e.detector_confidence ?? 0) * 100),
        isPhishing: e.is_phishing ?? null,
        timestamp: "",
      }));

  return (
    <>
      <div className="space-y-6">
        <Link
          href={`${baseHref}/rounds`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent-cyan transition-colors"
        >
          <ArrowLeft size={16} /> Back to Rounds
        </Link>

        <div className="glass-panel p-6 rounded-xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">
              Round #{round.id} details
            </h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <span>{new Date(round.date).toLocaleString()}</span> •
              <span
                className={
                  round.detectionRate > 80 ? "text-accent-red font-medium" : ""
                }
              >
                {round.detectionRate}% Detection
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  round.status === "completed"
                    ? "bg-accent-green/10 text-accent-green"
                    : round.status === "in_progress"
                    ? "bg-accent-cyan/10 text-accent-cyan"
                    : "bg-accent-red/10 text-accent-red"
                }`}
              >
                {round.status === "in_progress" && (
                  <Loader2 size={9} className="animate-spin mr-1" />
                )}
                {round.status.replace("_", " ")}
              </span>
            </p>
          </div>

          <div className="flex gap-4">
            <div className="text-right">
              <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">
                Generator
              </div>
              <div className="flex items-center gap-2 bg-background/50 px-3 py-1.5 rounded border border-border/50 text-sm">
                <Bot size={16} className="text-accent-purple" />
                gemini-2.0-flash
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">
                Detector
              </div>
              <div className="flex items-center gap-2 bg-background/50 px-3 py-1.5 rounded border border-border/50 text-sm">
                <Activity size={16} className="text-accent-cyan" />
                claude-3-5-haiku
              </div>
            </div>
          </div>
        </div>

        {/* Real-time progress bar (visible while round is running) */}
        {progress !== null && (
          <div
            data-testid="round-progress-bar"
            className="glass-panel p-4 rounded-xl"
          >
            <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
              <span>
                Processing emails: {progress.processed} / {progress.total}
              </span>
              <span>
                Accuracy so far: {(progress.accuracy * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-2 w-full bg-background/50 rounded-full overflow-hidden">
              <motion.div
                data-testid="round-progress-fill"
                className="h-2 rounded-full bg-gradient-to-r from-accent-cyan to-accent-purple"
                style={{
                  width: `${(progress.processed / progress.total) * 100}%`,
                }}
                initial={{ width: "0%" }}
                animate={{
                  width: `${(progress.processed / progress.total) * 100}%`,
                }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>
        )}

        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-background/50 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium w-16">#</th>
                  <th className="px-6 py-4 font-medium">Subject</th>
                  <th className="px-6 py-4 font-medium">Detector Reasoning</th>
                  <th className="px-6 py-4 font-medium w-32">Verdict</th>
                  <th className="px-6 py-4 font-medium w-24 text-right">Conf.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {displayEmails.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      {round.status === "in_progress"
                        ? "Round is still running — refresh to see results."
                        : "No emails processed in this round."}
                    </td>
                  </tr>
                ) : (
                  <>
                    {displayEmails.map((email, idx) => (
                      <tr
                        key={email.id}
                        onClick={() => {
                          setSelectedEmail(email);
                          setOverrideVerdict("legitimate");
                          setOverrideReason("");
                          setOverrideError(null);
                          setOverrideSuccess(null);
                        }}
                        className={`group transition-colors cursor-pointer ${
                          email.verdict === "phishing"
                            ? "bg-accent-red/5 hover:bg-accent-red/10"
                            : "bg-accent-green/5 hover:bg-accent-green/10"
                        }`}
                      >
                        <td className="px-6 py-4 font-mono font-medium text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="px-6 py-4 font-medium max-w-xs">
                          <span className="line-clamp-1">{email.subject}</span>
                        </td>
                        <td className="px-6 py-4 max-w-sm">
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {email.detectorResponse || (
                              <span className="italic opacity-50">No reasoning available</span>
                            )}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              email.verdict === "phishing"
                                ? "bg-accent-red/20 text-accent-red border border-accent-red/30"
                                : "bg-accent-green/20 text-accent-green border border-accent-green/30"
                            }`}
                          >
                            {email.verdict === "phishing" ? (
                              <ShieldAlert size={12} />
                            ) : (
                              <ShieldCheck size={12} />
                            )}
                            {email.verdict}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-medium">
                          {email.confidence}%
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
          {displayEmails.length > 0 && (
            <div className="px-6 py-3 border-t border-border/30 text-xs text-muted-foreground">
              Click any row to view full email content
            </div>
          )}
        </div>
      </div>

      {/* Email Detail Dialog */}
      <AnimatePresence>
        {selectedEmail && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
              onClick={() => setSelectedEmail(null)}
            />
            <motion.div
              key="dialog"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="glass-panel rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden pointer-events-auto flex flex-col shadow-2xl border border-border/50"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Dialog Header */}
                <div className="flex items-start justify-between p-6 border-b border-border/30 shrink-0">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Mail size={16} className="text-accent-cyan shrink-0" />
                      <h2 className="text-base font-semibold truncate">
                        {selectedEmail.subject}
                      </h2>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          selectedEmail.verdict === "phishing"
                            ? "bg-accent-red/20 text-accent-red border border-accent-red/30"
                            : "bg-accent-green/20 text-accent-green border border-accent-green/30"
                        }`}
                      >
                        {selectedEmail.verdict === "phishing" ? (
                          <ShieldAlert size={11} />
                        ) : (
                          <ShieldCheck size={11} />
                        )}
                        {selectedEmail.verdict}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {selectedEmail.confidence}% confidence
                      </span>
                      {selectedEmail.isPhishing !== null && (
                        <span
                          className={`inline-flex items-center gap-1 text-xs ${
                            selectedEmail.isPhishing
                              ? "text-accent-red"
                              : "text-accent-green"
                          }`}
                        >
                          {selectedEmail.isPhishing ? (
                            <AlertTriangle size={11} />
                          ) : (
                            <CheckCircle2 size={11} />
                          )}
                          Ground truth: {selectedEmail.isPhishing ? "phishing" : "legitimate"}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedEmail(null)}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Dialog Body */}
                <div className="overflow-y-auto flex-1 p-6 space-y-5">
                  {/* Email Body */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Bot size={14} className="text-accent-purple" />
                      <span className="text-xs font-semibold text-accent-purple uppercase tracking-wider">
                        Generated Email Body
                      </span>
                    </div>
                    <div className="bg-background/60 rounded-lg p-4 border border-border/40">
                      {selectedEmail.body ? (
                        <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                          {selectedEmail.body}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          No email body available
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Detector Reasoning */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Brain size={14} className="text-accent-cyan" />
                      <span className="text-xs font-semibold text-accent-cyan uppercase tracking-wider">
                        Detector Reasoning
                      </span>
                    </div>
                    <div className="bg-background/60 rounded-lg p-4 border border-border/40">
                      {selectedEmail.detectorResponse ? (
                        <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                          {selectedEmail.detectorResponse}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          No detector reasoning available
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Override Verdict — admin only, live data only */}
                    {isAdmin && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={14} className="text-accent-yellow" />
                        <span className="text-xs font-semibold text-accent-yellow uppercase tracking-wider">
                          Override Verdict
                        </span>
                      </div>
                      <form
                        onSubmit={handleOverrideSubmit}
                        className="bg-background/60 rounded-lg p-4 border border-border/40 space-y-3"
                      >
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setOverrideVerdict("phishing")}
                            className={`flex-1 py-1.5 rounded text-xs font-semibold transition-colors ${
                              overrideVerdict === "phishing"
                                ? "bg-accent-red/30 text-accent-red border border-accent-red/50"
                                : "bg-background/50 text-muted-foreground border border-border/40 hover:border-accent-red/30"
                            }`}
                          >
                            Phishing
                          </button>
                          <button
                            type="button"
                            onClick={() => setOverrideVerdict("legitimate")}
                            className={`flex-1 py-1.5 rounded text-xs font-semibold transition-colors ${
                              overrideVerdict === "legitimate"
                                ? "bg-accent-green/30 text-accent-green border border-accent-green/50"
                                : "bg-background/50 text-muted-foreground border border-border/40 hover:border-accent-green/30"
                            }`}
                          >
                            Legitimate
                          </button>
                        </div>
                        <input
                          type="text"
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          placeholder="Reason (optional)"
                          className="w-full bg-background/50 border border-border/40 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-accent-cyan/50"
                        />
                        {overrideError && (
                          <p className="text-xs text-accent-red">{overrideError}</p>
                        )}
                        {overrideSuccess && (
                          <p className="text-xs text-accent-green">{overrideSuccess}</p>
                        )}
                        <button
                          type="submit"
                          disabled={overrideSubmitting}
                          className="w-full py-1.5 bg-accent-cyan/20 hover:bg-accent-cyan/30 text-accent-cyan border border-accent-cyan/30 rounded text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          {overrideSubmitting ? "Submitting…" : "Submit Override"}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
