"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  ScanText,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  Loader2,
} from "lucide-react";
import {
  scanEmail,
  scanUrl,
  getScanStatus,
  getUserQuota,
  type ScanQuota,
  type ScanVerdict,
  type ScanStatusResult,
  type ScanCacheHitResult,
} from "@/lib/user-api";
import dynamic from "next/dynamic";
import VerdictDisplay from "@/components/scan/VerdictDisplay";
const ScanHistoryPanel = dynamic(() => import("@/components/scan/ScanHistoryPanel"), { ssr: false });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScanDisplayResult {
  verdict: ScanVerdict;
  confidence: number;
  scam_score: number;
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Verdict helpers
// ---------------------------------------------------------------------------

const VERDICT_CONFIG: Record<
  ScanVerdict,
  { label: string; color: string; bg: string; icon: typeof ShieldCheck }
> = {
  phishing: {
    label: "Phishing",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/30",
    icon: AlertTriangle,
  },
  likely_phishing: {
    label: "Likely Phishing",
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/30",
    icon: ShieldAlert,
  },
  suspicious: {
    label: "Suspicious",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/30",
    icon: HelpCircle,
  },
  likely_legitimate: {
    label: "Likely Legitimate",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    icon: ShieldCheck,
  },
  legitimate: {
    label: "Legitimate",
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/30",
    icon: ShieldCheck,
  },
};

function VerdictBadge({ verdict }: { verdict: ScanVerdict }) {
  const cfg = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.suspicious;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}
    >
      <Icon size={12} />
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Result Card
// ---------------------------------------------------------------------------

function ResultCard({ result }: { result: ScanDisplayResult }) {
  const cfg = VERDICT_CONFIG[result.verdict] ?? VERDICT_CONFIG.suspicious;
  const scorePercent = Math.round(result.scam_score ?? 0);
  const confidencePercent = Math.round((result.confidence ?? 0) * 100);

  return (
    <div className={`glass-panel rounded-xl border p-6 space-y-4 ${cfg.bg}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Analysis Result</h3>
        <VerdictBadge verdict={result.verdict} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Scam Score</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-background/50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                style={{ width: `${scorePercent}%` }}
              />
            </div>
            <span className={`text-sm font-bold ${cfg.color}`}>{scorePercent}</span>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Confidence</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-background/50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-accent-cyan"
                style={{ width: `${confidencePercent}%` }}
              />
            </div>
            <span className="text-sm font-bold text-accent-cyan">{confidencePercent}%</span>
          </div>
        </div>
      </div>

      {result.reasoning && (
        <div className="pt-2 border-t border-border/30">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide font-medium">Reasoning</p>
          <p className="text-sm leading-relaxed">{result.reasoning}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 120; // 3 minutes maximum

export default function ScanEmailPage() {
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;

  // Add scan mode toggle
  const [scanMode, setScanMode] = useState<"email" | "url">("email");

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [targetUrl, setTargetUrl] = useState("");

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanDisplayResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [quota, setQuota] = useState<ScanQuota | null>(null);

  // Polling state
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttemptsRef = useRef(0);

  const fetchQuota = async () => {
    if (!token) return;
    try {
      const q = await getUserQuota(token);
      setQuota(q);
    } catch (err) {
      console.error('Failed to fetch quota', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchQuota();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    pollAttemptsRef.current = 0;
  };

  const handlePollResult = (statusResult: ScanStatusResult) => {
    if (statusResult.status === 'complete') {
      stopPolling();
      setScanning(false);
      setResult({
        verdict: statusResult.verdict ?? 'suspicious',
        confidence: statusResult.confidence ?? 0,
        scam_score: statusResult.scam_score ?? 0,
        reasoning: statusResult.reasoning ?? '',
      });
      fetchQuota();
    } else if (statusResult.status === 'failed') {
      stopPolling();
      setScanning(false);
      setError(statusResult.error ?? 'Detection failed. Please Try again.');
      fetchQuota();
    }
    // 'pending' — keep polling
  };

  const startPolling = (jobId: string, authToken: string) => {
    pollAttemptsRef.current = 0;

    pollIntervalRef.current = setInterval(async () => {
      pollAttemptsRef.current += 1;

      if (pollAttemptsRef.current > MAX_POLL_ATTEMPTS) {
        stopPolling();
        setScanning(false);
        setError('Scan timed out. Please try again.');
        return;
      }

      try {
        const statusResult = await getScanStatus(authToken, jobId);
        handlePollResult(statusResult);
      } catch {
        stopPolling();
        setScanning(false);
        setError('Failed to check scan status. Please try again.');
      }
    }, POLL_INTERVAL_MS);
  };

  const isCacheHit = (result: unknown): result is ScanCacheHitResult =>
    typeof result === 'object' && result !== null && 'cached' in result && (result as Record<string, unknown>).cached === true && (result as Record<string, unknown>).status === 'complete';

  const handleScan = async () => {
    if (!token) return;

    if (scanMode === "email" && !body.trim()) return;
    if (scanMode === "url" && !targetUrl.trim()) return;

    stopPolling();
    setScanning(true);
    setResult(null);
    setError(null);

    try {
      let submitResult;
      if (scanMode === "email") {
        submitResult = await scanEmail(token, subject.trim(), body.trim());
      } else {
        submitResult = await scanUrl(token, targetUrl.trim());
      }

      if (isCacheHit(submitResult)) {
        // Cache hit — render verdict immediately, no polling needed
        setScanning(false);
        setResult({
          verdict: submitResult.verdict,
          confidence: submitResult.confidence,
          scam_score: submitResult.scam_score,
          reasoning: submitResult.reasoning,
        });
        fetchQuota();
      } else {
        // Cache miss — start polling with the returned job_id
        startPolling(submitResult.job_id, token);
      }
    } catch (err) {
      setScanning(false);
      setError(err instanceof Error ? err.message : "Scan failed. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ScanText className="text-accent-cyan" size={28} />
            Scan Phishing
          </h1>
          <p className="text-muted-foreground mt-1">
            Paste an email or a URL to instantly check it for phishing or scams.
          </p>
        </div>
        {quota && (
          <div className="glass-panel p-3 px-5 rounded-lg flex flex-col items-end">
            <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
              Scans Remaining Today
            </span>
            <span className="text-2xl font-bold text-accent-cyan">
              {quota.remaining} <span className="text-sm font-normal text-muted-foreground">/ {quota.assigned_limit}</span>
            </span>
          </div>
        )}
      </div>

      {/* Split panel: form + result */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: form */}
        <div className="glass-panel rounded-xl p-6 space-y-4">
          <div className="flex gap-2 p-1 bg-background/50 rounded-lg p-1 w-fit border border-border/50">
            <button
              onClick={() => setScanMode("email")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                scanMode === "email" ? "bg-accent-cyan text-black" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Email Scan
            </button>
            <button
              onClick={() => setScanMode("url")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                scanMode === "url" ? "bg-accent-cyan text-black" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              URL Scan
            </button>
          </div>

          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            {scanMode === "email" ? "Email Content" : "Target URL"}
          </h2>

          {scanMode === "email" ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Subject <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter email subject line…"
                  className="w-full bg-background/50 border border-border/50 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Email Body <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Paste the full email body here…"
                  rows={10}
                  className="w-full bg-background/50 border border-border/50 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 resize-none"
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                URL to Scan <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full bg-background/50 border border-border/50 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
              />
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={handleScan}
            disabled={scanning || (scanMode === "email" ? !body.trim() : !targetUrl.trim())}
            className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanning ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Analysing…
              </>
            ) : (
              <>
                <ScanText size={16} />
                {scanMode === "email" ? "Scan Email" : "Scan URL"}
              </>
            )}
          </button>
        </div>

        {/* Right: result */}
        <div className="space-y-4">
          {result ? (
            <>
              <VerdictDisplay
                verdict={
                  result.verdict === "phishing" || result.verdict === "likely_phishing"
                    ? "phishing"
                    : "safe"
                }
                confidence={result.confidence ?? 0}
                reasoning={
                  result.reasoning
                    ? result.reasoning.split(/\n|\.(?=\s)/).map((s) => s.trim()).filter(Boolean)
                    : []
                }
                subject={subject}
              />
              <ResultCard result={result} />
            </>
          ) : (
            <div className="glass-panel rounded-xl p-10 text-center text-muted-foreground space-y-3 h-full flex flex-col items-center justify-center">
              <ShieldCheck size={40} className="opacity-30" />
              <p className="text-sm">
                {scanning
                  ? "Analysing your email with AI…"
                  : "Your scan result will appear here."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      {token ? (
        <ScanHistoryPanel token={token} />
      ) : (
        <div className="glass-panel rounded-xl p-6 text-center text-sm text-muted-foreground">
          Log in with a backend account to view scan history.
        </div>
      )}
    </div>
  );
}
