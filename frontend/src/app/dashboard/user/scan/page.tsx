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
  getScanStatus,
  type ScanVerdict,
  type ScanStatusResult,
  type ScanCacheHitResult,
} from "@/lib/user-api";
import dynamic from "next/dynamic";
import VerdictDisplay from "@/components/scan/VerdictDisplay";
import { useLanguage } from "@/components/LanguageProvider";
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
  { color: string; bg: string; icon: typeof ShieldCheck }
> = {
  phishing: {
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/30",
    icon: AlertTriangle,
  },
  likely_phishing: {
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/30",
    icon: ShieldAlert,
  },
  suspicious: {
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/30",
    icon: HelpCircle,
  },
  likely_legitimate: {
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    icon: ShieldCheck,
  },
  legitimate: {
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/30",
    icon: ShieldCheck,
  },
};

function VerdictBadge({ verdict, label }: { verdict: ScanVerdict; label: string }) {
  const cfg = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.suspicious;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}
    >
      <Icon size={12} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Result Card
// ---------------------------------------------------------------------------

function ResultCard({ result, tr }: { result: ScanDisplayResult; tr: (key: string) => string }) {
  const cfg = VERDICT_CONFIG[result.verdict] ?? VERDICT_CONFIG.suspicious;
  const scorePercent = Math.round(result.scam_score ?? 0);
  const confidencePercent = Math.round((result.confidence ?? 0) * 100);

  return (
    <div className={`glass-panel rounded-xl border p-6 space-y-4 ${cfg.bg}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{tr("scan.analysisResult")}</h3>
        <VerdictBadge verdict={result.verdict} label={tr(`scan.verdict.${result.verdict}`)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{tr("scan.scamScore")}</p>
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
          <p className="text-xs text-muted-foreground">{tr("scan.confidence")}</p>
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
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide font-medium">{tr("scan.reasoning")}</p>
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
  const { tr } = useLanguage();
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanDisplayResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Polling state
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttemptsRef = useRef(0);

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
    } else if (statusResult.status === 'failed') {
      stopPolling();
      setScanning(false);
      setError(statusResult.error ?? tr("scan.errorDetectionFailed"));
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
        setError(tr("scan.errorTimedOut"));
        return;
      }

      try {
        const statusResult = await getScanStatus(authToken, jobId);
        handlePollResult(statusResult);
      } catch {
        stopPolling();
        setScanning(false);
        setError(tr("scan.errorCheckStatus"));
      }
    }, POLL_INTERVAL_MS);
  };

  const isCacheHit = (result: ReturnType<typeof scanEmail> extends Promise<infer T> ? T : never): result is ScanCacheHitResult =>
    'cached' in result && result.cached === true && result.status === 'complete';

  const handleScan = async () => {
    if (!token || !body.trim()) return;

    stopPolling();
    setScanning(true);
    setResult(null);
    setError(null);

    try {
      const submitResult = await scanEmail(token, subject.trim(), body.trim());

      if (isCacheHit(submitResult)) {
        // Cache hit — render verdict immediately, no polling needed
        setScanning(false);
        setResult({
          verdict: submitResult.verdict,
          confidence: submitResult.confidence,
          scam_score: submitResult.scam_score,
          reasoning: submitResult.reasoning,
        });
      } else {
        // Cache miss — start polling with the returned job_id
        startPolling(submitResult.job_id, token);
      }
    } catch (err) {
      setScanning(false);
      setError(err instanceof Error ? err.message : tr("scan.errorScanFailed"));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <ScanText className="text-accent-cyan" size={28} />
          {tr("scan.title")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {tr("scan.subtitle")}
        </p>
      </div>

      {/* Split panel: form + result */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: form */}
        <div className="glass-panel rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{tr("scan.emailContent")}</h2>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              {tr("scan.subject")} <span className="text-muted-foreground font-normal text-xs">({tr("scan.optional")})</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={tr("scan.subjectPlaceholder")}
              className="w-full bg-background/50 border border-border/50 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              {tr("scan.emailBody")} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={tr("scan.bodyPlaceholder")}
              rows={10}
              className="w-full bg-background/50 border border-border/50 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={handleScan}
            disabled={scanning || !body.trim()}
            className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanning ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {tr("scan.analysing")}
              </>
            ) : (
              <>
                <ScanText size={16} />
                {tr("scan.scanButton")}
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
              <ResultCard result={result} tr={tr} />
            </>
          ) : (
            <div className="glass-panel rounded-xl p-10 text-center text-muted-foreground space-y-3 h-full flex flex-col items-center justify-center">
              <ShieldCheck size={40} className="opacity-30" />
              <p className="text-sm">
                {scanning
                  ? tr("scan.analysingWithAI")
                  : tr("scan.resultPlaceholder")}
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
          {tr("scan.loginToViewHistory")}
        </div>
      )}
    </div>
  );
}
