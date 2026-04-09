"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getFeedback, updateFeedbackStatus, type FeedbackItem } from "@/lib/admin-api";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Loader2, RefreshCw, CheckCircle2, Circle, Clock } from "lucide-react";
import { parseUTC } from "@/lib/utils";

export default function AdminFeedbackPage() {
  const { data: session } = useSession();
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("pending,reviewed");

  const fetchFeedbackData = async (pageNum = page, filter = statusFilter) => {
    if (!session?.accessToken) return;
    try {
      setIsLoading(true);
      const data = await getFeedback(session.accessToken, pageNum, 20, filter === "all" ? undefined : filter);
      setFeedback(data.items);
      setTotalPages(data.pages);
      setPage(data.page);
    } catch (err: unknown) {
      const e = err as Error;
      toast.error(e.message || "Failed to load feedback");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbackData(1, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken, statusFilter]);

  useEffect(() => {
    if (page !== 1) fetchFeedbackData(page, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await updateFeedbackStatus(session?.accessToken as string, id, newStatus);
      toast.success("Status updated!");
      setFeedback((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: newStatus } : f))
      );
    } catch (err: unknown) {
      const e = err as Error;
      toast.error(e.message || "Failed to update status");
    }
  };

  return (
    <div className="space-y-6 pt-6 px-4 pb-12">      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Feedback</h1>
          <p className="text-muted-foreground mt-1">Review and manage feedback submitted by users.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent-cyan outline-none"
          >
            <option value="pending">Pending</option>
            <option value="reviewed">Under Review</option>
            <option value="resolved">Resolved</option>
            <option value="all">All Statuses</option>
          </select>
          <button
            onClick={() => fetchFeedbackData(1)}
            className="flex items-center gap-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground px-4 py-2 rounded-lg transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent-cyan"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 flex justify-center items-center">
            <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
          </div>
        ) : feedback.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            No feedback found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/30 text-muted-foreground text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">ID / User</th>
                  <th className="px-6 py-4">Content</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {feedback.map((item) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-muted/10 transition-colors"
                  >
                    <td className="px-6 py-4 align-top">
                      <div className="font-mono text-xs text-muted-foreground mb-1">#{item.id}</div>
                      <div className="font-medium">User {item.user_id}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {parseUTC(item.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top max-w-md">
                      <div className="font-semibold text-foreground mb-1">
                        {item.subject || "No Subject"}
                      </div>
                      <div className="text-muted-foreground whitespace-pre-wrap">
                        {item.description}
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          item.status === "resolved"
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : item.status === "reviewed"
                            ? "bg-accent-blue/10 text-accent-blue border border-accent-blue/20"
                            : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                        }`}
                      >
                        {item.status === "resolved" ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : item.status === "reviewed" ? (
                          <Circle className="w-3.5 h-3.5" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-top text-right">
                      <div className="flex gap-2 justify-end">
                        <select
                          className="bg-background border border-border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-accent-cyan outline-none ml-auto"
                          value={item.status}
                          onChange={(e) => handleStatusChange(item.id, e.target.value)}
                        >
                          <option value="pending">Pending</option>
                          <option value="reviewed">Reviewed</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 border border-border rounded text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 border border-border rounded text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
