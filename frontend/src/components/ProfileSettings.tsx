"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Eye, EyeOff, CheckCircle2, AlertCircle, Loader2,
  Puzzle, Copy, Check, Wifi, WifiOff, Trash2,
} from "lucide-react";
import {
  getMe, updatePassword, getExtensionInstances, deleteExtensionInstance,
  type BackendUser, type ExtensionInstance,
} from "@/lib/admin-api";
import { parseUTC } from "@/lib/utils";

function Initials({ name }: { name?: string | null }) {
  const initials = (name ?? "?")
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
  return (
    <div className="w-20 h-20 rounded-full bg-accent-cyan/20 border-2 border-accent-cyan/30 flex items-center justify-center text-accent-cyan font-bold text-2xl select-none">
      {initials}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      title="Copy token"
    >
      {copied ? <Check size={14} className="text-accent-green" /> : <Copy size={14} />}
    </button>
  );
}

export function ProfileSettings() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<BackendUser | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Extension instances
  const [instances, setInstances] = useState<ExtensionInstance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.accessToken || !session.user?.fromBackend) {
      setLoadingProfile(false);
      setLoadingInstances(false);
      return;
    }
    getMe(session.accessToken)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoadingProfile(false));

    getExtensionInstances(session.accessToken)
      .then(setInstances)
      .catch(() => setInstances([]))
      .finally(() => setLoadingInstances(false));
  }, [session]);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match." });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: "error", text: "New password must be at least 8 characters." });
      return;
    }
    if (!session?.accessToken) return;
    setSaving(true);
    try {
      await updatePassword(session.accessToken, currentPassword, newPassword);
      setMessage({ type: "success", text: "Password updated successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message ?? "Failed to update password." });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveInstance(instanceId: number) {
    if (!session?.accessToken) return;
    setDeletingId(instanceId);
    setDeleteError(null);
    try {
      await deleteExtensionInstance(session.accessToken, instanceId);
      setInstances((prev) => prev.filter((i) => i.id !== instanceId));
    } catch (err) {
      setDeleteError((err as Error).message ?? "Failed to remove instance.");
    } finally {
      setDeletingId(null);
    }
  }

  const displayName = session?.user?.name ?? profile?.username ?? "User";
  const displayEmail = session?.user?.email ?? profile?.email ?? "";
  const roles = profile?.roles ?? (session?.user?.role ? [session.user.role] : []);
  const memberSince = profile?.created_at
    ? parseUTC(profile.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account information and security.</p>
      </div>

      {/* Account Info */}
      <div className="glass-panel rounded-xl p-6 space-y-6">
        <h2 className="text-lg font-semibold border-b border-border/50 pb-3">Account Information</h2>

        <div className="flex items-center gap-5">
          <Initials name={displayName} />
          <div>
            <p className="font-semibold text-lg">{displayName}</p>
            <p className="text-sm text-muted-foreground">{displayEmail}</p>
          </div>
        </div>

        {loadingProfile ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            Loading profile…
          </div>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Username
              </dt>
              <dd className="text-sm font-medium">{profile?.username ?? displayName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Email
              </dt>
              <dd className="text-sm font-medium">{displayEmail}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Roles
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {roles.map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent-cyan/10 text-accent-cyan"
                  >
                    {role}
                  </span>
                ))}
              </dd>
            </div>
            {memberSince && (
              <div>
                <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Member Since
                </dt>
                <dd className="text-sm font-medium">{memberSince}</dd>
              </div>
            )}
          </dl>
        )}
      </div>

      {/* Change Password */}
      <div className="glass-panel rounded-xl p-6 space-y-5">
        <h2 className="text-lg font-semibold border-b border-border/50 pb-3">Change Password</h2>

        {!session?.user?.fromBackend ? (
          <p className="text-sm text-muted-foreground">
            Password management is only available for backend accounts.
          </p>
        ) : (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label htmlFor="current-password" className="block text-sm font-medium mb-1.5">
                Current Password
              </label>
              <div className="relative">
                <input
                  id="current-password"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-1 focus:ring-accent-cyan"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="new-password" className="block text-sm font-medium mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-1 focus:ring-accent-cyan"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium mb-1.5">
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent-cyan"
                autoComplete="new-password"
              />
            </div>

            {message && (
              <div
                className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 ${
                  message.type === "success"
                    ? "bg-accent-green/10 text-accent-green"
                    : "bg-accent-red/10 text-accent-red"
                }`}
              >
                {message.type === "success" ? (
                  <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                )}
                {message.text}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent-cyan text-black font-semibold text-sm hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Update Password
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Browser Extension */}
      <div className="glass-panel rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2 border-b border-border/50 pb-3">
          <Puzzle size={18} className="text-accent-cyan" />
          <h2 className="text-lg font-semibold">Browser Extension</h2>
        </div>

        {/* How it works callout */}
        <div className="rounded-lg border border-accent-cyan/20 bg-accent-cyan/5 px-4 py-4 space-y-3">
          <p className="text-xs font-semibold text-accent-cyan uppercase tracking-wider">How it works</p>
          <ol className="space-y-2">
            {[
              "Install the Sentra browser extension (Chrome / Edge).",
              "Log in to the Sentra dashboard.",
              "The extension automatically connects — your instance will appear here.",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-accent-cyan/20 text-accent-cyan flex items-center justify-center text-[10px] font-bold mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {!session?.user?.fromBackend ? (
          <p className="text-sm text-muted-foreground">
            Extension tracking is only available for backend accounts.
          </p>
        ) : loadingInstances ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            Loading instances…
          </div>
        ) : instances.length === 0 ? (
          <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-6 text-center space-y-2">
            <WifiOff size={24} className="mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">No instances registered yet</p>
            <p className="text-xs text-muted-foreground">
              Install the extension and log in — your instance will appear here automatically.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {instances.map((inst) => (
              <li
                key={inst.id}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/10 px-4 py-3"
              >
                <div className={`flex-shrink-0 ${inst.is_active ? "text-accent-green" : "text-muted-foreground"}`}>
                  {inst.is_active ? <Wifi size={16} /> : <WifiOff size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {inst.browser ?? "Unknown browser"}
                    </span>
                    {inst.os_name && (
                      <span className="text-xs text-muted-foreground">· {inst.os_name}</span>
                    )}
                    <span
                      className={`ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${
                        inst.is_active
                          ? "bg-accent-green/10 text-accent-green"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {inst.is_active ? "Active" : "Idle — waiting for heartbeat"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="font-mono text-[10px] text-muted-foreground truncate">
                      Token: {inst.instance_token}
                    </span>
                    <CopyButton text={inst.instance_token} />
                  </div>
                  {inst.last_seen ? (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Last heartbeat {parseUTC(inst.last_seen).toLocaleString()}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      No heartbeat received yet — check the extension is installed and you are logged in.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveInstance(inst.id)}
                  disabled={deletingId === inst.id}
                  className="flex-shrink-0 p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-50"
                  title="Remove instance"
                  data-testid={`remove-instance-${inst.id}`}
                >
                  {deletingId === inst.id
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Trash2 size={14} />}
                </button>
              </li>
            ))}
          </ul>
        )}

        {deleteError && (
          <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
            {deleteError}
          </p>
        )}
      </div>
    </div>
  );
}
