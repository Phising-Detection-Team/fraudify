"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  X,
  Mail,
  Brain,
  ChevronLeft,
  ChevronRight,
  Loader2,
  User,
  RefreshCw,
} from "lucide-react";
import { getAdminRecentScans, type AdminScanItem, type AdminScansPage } from "@/lib/admin-api";
import { parseUTC } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelative(iso: string): string {
  if (!iso) return "—";
  const date = parseUTC(iso);
  if (isNaN(date.getTime())) return iso;
  const diffMs = Date.now() - date.getTime();
  const s = Math.floor(diffMs / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (s < 60) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type VerdictTier = "danger" | "warning" | "safe";

function verdictTier(verdict: string): VerdictTier {
  if (verdict === "phishing" || verdict === "likely_phishing") return "danger";
  if (verdict === "suspicious") return "warning";
  return "safe";
}

const TIER_BADGE: Record<VerdictTier, string> = {
  danger: "bg-accent-red/20 text-accent-red border border-accent-red/30",
  warning: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
  safe: "bg-accent-green/20 text-accent-green border border-accent-green/30",
};

function VerdictBadge({ verdict }: { verdict: string }) {
  const tier = verdictTier(verdict);
  const Icon =
    tier === "danger"
      ? ShieldAlert
      : tier === "warning"
      ? ShieldQuestion
      : ShieldCheck;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${TIER_BADGE[tier]}`}
    >
      <Icon size={11} />
      {verdict.replace("_", " ")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Scan detail modal
// ---------------------------------------------------------------------------

function ScanModal({
  scan,
  onClose,
}: {
  scan: AdminScanItem;
  onClose: () => void;
}) {
  return (
    <>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={onClose}
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
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-border/30 shrink-0">
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-1">
                <Mail size={15} className="text-accent-cyan shrink-0" />
                <h2 className="text-base font-semibold truncate">
                  {scan.subject ?? "(no subject)"}
                </h2>
              </div>
              <div className="flex items-center gap-3 flex-wrap mt-1.5">
                <VerdictBadge verdict={scan.verdict} />
                {scan.confidence != null && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {Math.round(scan.confidence * 100)}% confidence
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <User size={11} />
                  {scan.user_email}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatRelative(scan.scanned_at)}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 p-6 space-y-5">
            {/* Email body */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Mail size={13} className="text-accent-purple" />
                <span className="text-xs font-semibold text-accent-purple uppercase tracking-wider">
                  Email Body
                </span>
              </div>
              <div className="bg-background/60 rounded-lg p-4 border border-border/40">
                {scan.full_body ? (
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {scan.full_body}
                  </p>
                ) : scan.body_snippet ? (
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {scan.body_snippet}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No body content</p>
                )}
              </div>
            </div>

            {/* Detector reasoning */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Brain size={13} className="text-accent-cyan" />
                <span className="text-xs font-semibold text-accent-cyan uppercase tracking-wider">
                  Detector Reasoning
                </span>
              </div>
              <div className="bg-background/60 rounded-lg p-4 border border-border/40">
                {scan.reasoning ? (
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {scan.reasoning}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No reasoning available</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  /** Initial page-1 data pre-fetched by the parent. */
  initialData: AdminScansPage;
}

export default function RecentScansTable({ initialData }: Props) {
  const { data: session } = useSession();
  const [scans, setScans] = useState<AdminScanItem[]>(initialData.scans);
  const [total, setTotal] = useState(initialData.total);
  const [page, setPage] = useState(initialData.page);
  const [pages, setPages] = useState(initialData.pages);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AdminScanItem | null>(null);

  const PER_PAGE = 10;

  const fetchPage = useCallback(
    async (p: number) => {
      if (!session?.accessToken) return;
      setLoading(true);
      try {
        const data = await getAdminRecentScans(session.accessToken, p, PER_PAGE);
        setScans(data.scans);
        setTotal(data.total);
        setPage(data.page);
        setPages(data.pages);
      } catch {
        setScans([]);
      } finally {
        setLoading(false);
      }
    },
    [session?.accessToken]
  );

  // Only fetch on pagination — page 1 is already provided via initialData
  useEffect(() => {
    if (page > 1) {
      fetchPage(page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="glass-panel rounded-xl overflow-hidden">
        {/* Section header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
          <div>
            <h3 className="text-base font-semibold">Recent User Scans</h3>
            {total > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {total.toLocaleString()} total scan{total !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <button
            onClick={() => fetchPage(1)}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40"
            title="Refresh scans"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading scans…</span>
          </div>
        ) : scans.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No user scans yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-background/50 border-b border-border/50">
                <tr>
                  <th className="px-6 py-3 font-medium">User</th>
                  <th className="px-6 py-3 font-medium">Subject</th>
                  <th className="px-6 py-3 font-medium w-36">Verdict</th>
                  <th className="px-6 py-3 font-medium w-24 text-right">Conf.</th>
                  <th className="px-6 py-3 font-medium w-28 text-right">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                  {scans.map((scan) => (
                    <tr
                      key={scan.id}
                      onClick={() => setSelected(scan)}
                      className={`cursor-pointer transition-colors ${
                        verdictTier(scan.verdict) === "danger"
                          ? "bg-accent-red/5 hover:bg-accent-red/10"
                          : verdictTier(scan.verdict) === "warning"
                          ? "bg-yellow-500/5 hover:bg-yellow-500/10"
                          : "bg-accent-green/5 hover:bg-accent-green/10"
                      }`}
                    >
                      <td className="px-6 py-3 text-xs text-muted-foreground truncate max-w-[180px]">
                        {scan.user_email}
                      </td>
                      <td className="px-6 py-3 max-w-xs">
                        <span className="line-clamp-1 font-medium">
                          {scan.subject ?? "(no subject)"}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <VerdictBadge verdict={scan.verdict} />
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-xs">
                        {scan.confidence != null
                          ? `${Math.round(scan.confidence * 100)}%`
                          : "—"}
                      </td>
                      <td className="px-6 py-3 text-right text-xs text-muted-foreground">
                        {formatRelative(scan.scanned_at)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border/30 text-xs text-muted-foreground">
            <button
              onClick={() => fetchPage(page - 1)}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span>
              Page {page} of {pages}
            </span>
            <button
              onClick={() => fetchPage(page + 1)}
              disabled={page >= pages}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}

        {scans.length > 0 && pages <= 1 && (
          <div className="px-6 py-3 border-t border-border/30 text-xs text-muted-foreground">
            Click any row to view full scan details
          </div>
        )}
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {selected && (
          <ScanModal scan={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </>
  );
}
