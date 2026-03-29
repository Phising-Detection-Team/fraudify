"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  ScanText,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  Loader2,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  scanEmail,
  getScanHistory,
  type ScanResult,
  type ScanHistoryItem,
  type ScanVerdict,
} from "@/lib/user-api";

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

function ResultCard({ result }: { result: ScanResult }) {
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
// History Table
// ---------------------------------------------------------------------------

function HistoryTable({
  scans,
  total,
  page,
  pages,
  onPageChange,
}: {
  scans: ScanHistoryItem[];
  total: number;
  page: number;
  pages: number;
  onPageChange: (p: number) => void;
}) {
  if (scans.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-10 text-center text-muted-foreground space-y-2">
        <Clock size={28} className="mx-auto opacity-50" />
        <p className="text-sm">No scans yet. Submit an email above to get started.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border/50 flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Clock size={14} className="text-accent-cyan" />
          Scan History
          <span className="text-muted-foreground font-normal">({total})</span>
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-background/50 border-b border-border/50">
            <tr>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Subject</th>
              <th className="px-5 py-3 font-medium">Verdict</th>
              <th className="px-5 py-3 font-medium">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {scans.map((s) => (
              <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3 text-muted-foreground text-xs whitespace-nowrap">
                  {new Date(s.scanned_at).toLocaleString()}
                </td>
                <td className="px-5 py-3 max-w-xs">
                  <p className="truncate text-sm">{s.subject ?? <span className="text-muted-foreground italic">No subject</span>}</p>
                  {s.body_snippet && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{s.body_snippet}</p>
                  )}
                </td>
                <td className="px-5 py-3">
                  <VerdictBadge verdict={s.verdict} />
                </td>
                <td className="px-5 py-3">
                  <span className="text-sm font-mono">
                    {s.scam_score !== null ? Math.round(s.scam_score) : "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="p-3 border-t border-border/50 flex items-center justify-end gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="p-1.5 rounded border border-border/50 hover:bg-muted/30 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {pages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pages}
            className="p-1.5 rounded border border-border/50 hover:bg-muted/30 disabled:opacity-40 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ScanEmailPage() {
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPages, setHistoryPages] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = async (page = 1) => {
    if (!token) return;
    setHistoryLoading(true);
    try {
      const data = await getScanHistory(token, page);
      setHistory(data.scans);
      setHistoryTotal(data.total);
      setHistoryPages(data.pages);
      setHistoryPage(page);
    } catch {
      // silently fail — history is non-critical
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory(1);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScan = async () => {
    if (!token || !body.trim()) return;
    setScanning(true);
    setResult(null);
    setError(null);
    try {
      const res = await scanEmail(token, subject.trim(), body.trim());
      setResult(res);
      loadHistory(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed. Please try again.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <ScanText className="text-accent-cyan" size={28} />
          Scan Email
        </h1>
        <p className="text-muted-foreground mt-1">
          Paste an email to instantly check it for phishing or scams.
        </p>
      </div>

      {/* Split panel: form + result */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: form */}
        <div className="glass-panel rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Email Content</h2>

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
                Analysing…
              </>
            ) : (
              <>
                <ScanText size={16} />
                Scan Email
              </>
            )}
          </button>
        </div>

        {/* Right: result */}
        <div className="space-y-4">
          {result ? (
            <ResultCard result={result} />
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
      {historyLoading ? (
        <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          Loading history…
        </div>
      ) : (
        <HistoryTable
          scans={history}
          total={historyTotal}
          page={historyPage}
          pages={historyPages}
          onPageChange={(p) => loadHistory(p)}
        />
      )}
    </div>
  );
}
