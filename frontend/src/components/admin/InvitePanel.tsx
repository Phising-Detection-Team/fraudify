"use client";

import { useEffect, useState } from "react";
import { Loader2, Copy, Check, Trash2, Link2 } from "lucide-react";
import { createInvite, listInvites, revokeInvite } from "@/lib/admin-api";
import type { InviteRecord } from "@/lib/admin-api";
import { useLanguage } from "@/components/LanguageProvider";

interface InvitePanelProps {
  token: string;
}

const ROLE_OPTIONS = [
  { value: "user" as const, label: "User" },
  { value: "admin" as const, label: "Admin" },
];

const EXPIRY_OPTIONS = [
  { value: 24,  label: "24 hours" },
  { value: 168, label: "7 days"   },
  { value: 720, label: "30 days"  },
];

const ROLE_BADGE: Record<string, string> = {
  admin:       "bg-accent-cyan/10 text-accent-cyan",
  super_admin: "bg-purple-500/10 text-purple-400",
  user:        "bg-muted text-muted-foreground",
};

export default function InvitePanel({ token }: InvitePanelProps) {
  const { tr } = useLanguage();
  const [role, setRole]         = useState<"user" | "admin">("user");
  const [expiry, setExpiry]     = useState<number>(24);
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied]     = useState(false);
  const [invites, setInvites]   = useState<InviteRecord[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);

  useEffect(() => {
    setLoadingInvites(true);
    listInvites(token)
      .then(setInvites)
      .catch(() => setInvites([]))
      .finally(() => setLoadingInvites(false));
  }, [token]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGeneratedLink(null);
    try {
      const result = await createInvite(token, role, expiry);
      setGeneratedLink(result.invite_link);
      // Refresh table
      listInvites(token).then(setInvites).catch(() => {});
    } catch {
      // Error silently caught; button re-enables
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRevoke = async (code: string) => {
    // Optimistic remove
    setInvites((prev) => prev.filter((inv) => inv.code !== code));
    try {
      await revokeInvite(token, code);
    } catch {
      // On failure, re-fetch to restore truth
      listInvites(token).then(setInvites).catch(() => {});
    }
  };

  return (
    <div className="glass-panel rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link2 size={16} className="text-accent-cyan" />
        <h3 className="font-semibold">{tr("invite.links")}</h3>
      </div>

      {/* Generate form */}
      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs text-muted-foreground font-medium">{tr("invite.role")}</label>
          <select
            data-testid="invite-role-select"
            value={role}
            onChange={(e) => setRole(e.target.value as "user" | "admin")}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent-cyan"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.value === "admin" ? tr("nav.admin") : tr("nav.user")}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs text-muted-foreground font-medium">{tr("invite.expiry")}</label>
          <select
            data-testid="invite-expiry-select"
            value={expiry}
            onChange={(e) => setExpiry(Number(e.target.value))}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent-cyan"
          >
            {EXPIRY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.value === 24 ? tr("invite.expiry24h") : opt.value === 168 ? tr("invite.expiry7d") : tr("invite.expiry30d")}
              </option>
            ))}
          </select>
        </div>

        <button
          data-testid="invite-generate-btn"
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan text-sm font-medium hover:bg-accent-cyan/20 transition-colors disabled:opacity-60"
        >
          {generating ? <Loader2 size={14} className="animate-spin" data-testid="loader-icon" /> : null}
          {tr("invite.generate")}
        </button>
      </div>

      {/* Generated link display */}
      {generatedLink && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-background/60 border border-border/50">
          <span
            data-testid="generated-link"
            className="flex-1 text-xs font-mono truncate text-accent-cyan"
          >
            {generatedLink}
          </span>
          <button
            data-testid="invite-copy-btn"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs hover:bg-muted/30 transition-colors flex-shrink-0"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? tr("teamAdmin.copied") : tr("scan.copy")}
          </button>
        </div>
      )}

      {/* Active invites table */}
      <div data-testid="invites-table">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3">
          {tr("invite.active")}
        </p>

        {loadingInvites ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Loader2 size={14} className="animate-spin" />
            {tr("common.loading")}
          </div>
        ) : invites.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{tr("invite.empty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-background/50 border-b border-border/50">
                <tr>
                  <th className="px-4 py-3 font-medium">{tr("invite.code")}</th>
                  <th className="px-4 py-3 font-medium">{tr("invite.role")}</th>
                  <th className="px-4 py-3 font-medium">{tr("invite.expires")}</th>
                  <th className="px-4 py-3 font-medium sr-only">{tr("rounds.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {invites.map((inv) => (
                  <tr key={inv.code} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">
                      {inv.code.slice(0, 8)}&hellip;
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          ROLE_BADGE[inv.role] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {inv.role === "admin" ? tr("nav.admin") : inv.role === "user" ? tr("nav.user") : inv.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(inv.expires_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        data-testid={`revoke-btn-${inv.code}`}
                        onClick={() => handleRevoke(inv.code)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={12} />
                        {tr("invite.revoke")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
