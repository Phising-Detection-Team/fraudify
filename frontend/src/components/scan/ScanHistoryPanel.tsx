"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { History, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { getScanHistory, type ScanHistoryItem, type ScanVerdict } from "@/lib/user-api";
import { parseUTC } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScanHistoryPanelProps {
  token: string;
}

interface ChartDataPoint {
  date: string;
  phishing: number;
  safe: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PHISHING_VERDICTS: ScanVerdict[] = ["phishing", "likely_phishing"];
const SAFE_VERDICTS: ScanVerdict[] = ["legitimate", "likely_legitimate"];

function isPhishing(verdict: ScanVerdict): boolean {
  return PHISHING_VERDICTS.includes(verdict);
}

function isSafe(verdict: ScanVerdict): boolean {
  return SAFE_VERDICTS.includes(verdict);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function relativeTime(isoDate: string): string {
  const diff = Date.now() - parseUTC(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function buildChartData(scans: ScanHistoryItem[]): ChartDataPoint[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const byDate: Record<string, ChartDataPoint> = {};

  for (const scan of scans) {
    const d = parseUTC(scan.scanned_at);
    if (d < cutoff) continue;
    const key = d.toISOString().slice(0, 10);
    if (!byDate[key]) {
      byDate[key] = { date: key, phishing: 0, safe: 0 };
    }
    if (isPhishing(scan.verdict)) byDate[key].phishing += 1;
    else if (isSafe(scan.verdict)) byDate[key].safe += 1;
  }

  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Verdict badge
// ---------------------------------------------------------------------------

const VERDICT_LABEL: Record<ScanVerdict, string> = {
  phishing: "Phishing",
  likely_phishing: "Likely Phishing",
  suspicious: "Suspicious",
  likely_legitimate: "Likely Safe",
  legitimate: "Safe",
};

const VERDICT_CLASS: Record<ScanVerdict, string> = {
  phishing: "bg-red-500/10 border-red-500/30 text-red-400",
  likely_phishing: "bg-orange-500/10 border-orange-500/30 text-orange-400",
  suspicious: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
  likely_legitimate: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  legitimate: "bg-green-500/10 border-green-500/30 text-green-400",
};

function VerdictBadge({ verdict, id }: { verdict: ScanVerdict; id: number }) {
  return (
    <span
      data-testid={`verdict-badge-${id}`}
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${VERDICT_CLASS[verdict] ?? VERDICT_CLASS.suspicious}`}
    >
      {VERDICT_LABEL[verdict] ?? verdict}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div data-testid="scan-history-loading" className="space-y-3">
      {[1, 2, 3].map((n) => (
        <div key={n} className="h-12 bg-muted/20 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat chip
// ---------------------------------------------------------------------------

function StatChip({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-3 bg-background/40 rounded-xl border border-border/30">
      <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
        {label}
      </span>
      <span className="text-xl font-bold" data-testid={testId}>
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ScanHistoryPanel({ token }: ScanHistoryPanelProps) {
  const [scans, setScans] = useState<ScanHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadPage = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const data = await getScanHistory(token, p, 20);
        setScans((prev) => (p === 1 ? data.scans : [...prev, ...data.scans]));
        setTotal(data.total);
        setPages(data.pages);
        setPage(p);
      } catch {
        // On error, show empty state
        if (p === 1) setScans([]);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  // ---- Derived stats ----
  const phishingCount = scans.filter((s) => isPhishing(s.verdict)).length;
  const safeCount = scans.filter((s) => isSafe(s.verdict)).length;
  const phishingPct = scans.length > 0 ? Math.round((phishingCount / scans.length) * 100) : 0;
  const safePct = scans.length > 0 ? Math.round((safeCount / scans.length) * 100) : 0;

  const chartData = buildChartData(scans);

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (loading && scans.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-6">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <History size={18} className="text-accent-cyan" />
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
          Scan History
        </h2>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatChip label="Total Scanned" value={String(total)} testId="stat-total" />
        <StatChip label="% Phishing" value={`${phishingPct}%`} testId="stat-phishing-pct" />
        <StatChip label="% Safe" value={`${safePct}%`} testId="stat-safe-pct" />
      </div>

      {/* Line chart: scans per day (last 30 days) */}
      {chartData.length > 0 && (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="phishing"
                stroke="#f87171"
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="safe"
                stroke="#4ade80"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* History table */}
      {scans.length === 0 ? (
        <div
          data-testid="no-scans-message"
          className="py-10 text-center text-muted-foreground text-sm"
        >
          No scans yet. Submit an email above to get started.
        </div>
      ) : (
        <div className="space-y-0 divide-y divide-border/30 rounded-xl overflow-hidden border border-border/30">
          {scans.map((scan) => (
            <div key={scan.id}>
              {/* Main row */}
              <div
                data-testid={`scan-row-${scan.id}`}
                onClick={() => toggleExpand(scan.id)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 cursor-pointer transition-colors"
              >
                {/* Subject */}
                <span
                  data-testid={`scan-subject-${scan.id}`}
                  className="flex-1 text-sm truncate"
                >
                  {truncate(scan.subject ?? "No subject", 50)}
                </span>

                {/* Verdict badge */}
                <VerdictBadge verdict={scan.verdict} id={scan.id} />

                {/* Confidence bar */}
                <div
                  data-testid={`confidence-bar-${scan.id}`}
                  className="flex items-center gap-1.5 min-w-[80px]"
                >
                  <div className="flex-1 h-1.5 bg-background/50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent-cyan"
                      style={{ width: `${Math.round((scan.confidence ?? 0) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {Math.round((scan.confidence ?? 0) * 100)}%
                  </span>
                </div>

                {/* Relative time */}
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {relativeTime(scan.scanned_at)}
                </span>

                {/* Expand icon */}
                {expandedId === scan.id ? (
                  <ChevronUp size={14} className="text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                )}
              </div>

              {/* Expanded reasoning */}
              {expandedId === scan.id && scan.reasoning && (
                <div
                  data-testid={`scan-reasoning-${scan.id}`}
                  className="px-4 pb-3 text-sm text-muted-foreground leading-relaxed bg-muted/10"
                >
                  {scan.reasoning}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {page < pages && (
        <button
          data-testid="load-more-btn"
          onClick={() => loadPage(page + 1)}
          disabled={loading}
          className="w-full py-2 text-sm text-accent-cyan border border-accent-cyan/30 rounded-lg hover:bg-accent-cyan/5 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Loading…
            </span>
          ) : (
            "Load more"
          )}
        </button>
      )}
    </div>
  );
}
