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
import { useLanguage } from "@/components/LanguageProvider";
import type { Locale } from "@/lib/i18n";

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

function CopyButton({ text, title }: { text: string; title: string }) {
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
      title={title}
    >
      {copied ? <Check size={14} className="text-accent-green" /> : <Copy size={14} />}
    </button>
  );
}

export function ProfileSettings() {
  const { data: session } = useSession();
  const { locale, setLocaleAndPersist, tr } = useLanguage();
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
  const [languageMessage, setLanguageMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
      setMessage({ type: "error", text: tr("profile.passwordMismatch") });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: "error", text: tr("profile.passwordMinLength") });
      return;
    }
    if (!session?.accessToken) return;
    setSaving(true);
    try {
      await updatePassword(session.accessToken, currentPassword, newPassword);
      setMessage({ type: "success", text: tr("profile.passwordUpdated") });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message ?? tr("profile.passwordUpdateFailed") });
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
      setDeleteError((err as Error).message ?? tr("profile.removeInstanceFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleLanguageChange(nextLocale: Locale) {
    const success = await setLocaleAndPersist(nextLocale);
    if (success) {
      setLanguageMessage({ type: "success", text: tr("profile.languageSaved") });
      return;
    }
    setLanguageMessage({ type: "error", text: tr("profile.languageSaveFailed") });
  }

  const displayName = session?.user?.name ?? profile?.username ?? tr("nav.user");
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
        <h1 className="text-3xl font-bold tracking-tight">{tr("profile.title")}</h1>
        <p className="text-muted-foreground mt-1">{tr("profile.subtitle")}</p>
      </div>

      {/* Account Info */}
      <div className="glass-panel rounded-xl p-6 space-y-6">
        <h2 className="text-lg font-semibold border-b border-border/50 pb-3">{tr("profile.accountInformation")}</h2>

        <div className="rounded-lg border border-border/50 bg-background/30 p-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
            <label className="text-sm font-medium whitespace-nowrap">{tr("profile.languagePreference")}</label>
          <select
            value={locale}
            onChange={(e) => void handleLanguageChange(e.target.value as Locale)}
              className="w-full sm:w-auto sm:min-w-[180px] bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent-cyan"
          >
            <option value="en">{tr("common.english")}</option>
            <option value="vi">{tr("common.vietnamese")}</option>
          </select>
          </div>
          {languageMessage && (
            <p
              className={`text-xs mt-2 ${
                languageMessage.type === "success" ? "text-accent-green" : "text-accent-red"
              }`}
            >
              {languageMessage.text}
            </p>
          )}
        </div>

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
            {tr("profile.loadingProfile")}
          </div>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {tr("profile.username")}
              </dt>
              <dd className="text-sm font-medium">{profile?.username ?? displayName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {tr("profile.email")}
              </dt>
              <dd className="text-sm font-medium">{displayEmail}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {tr("profile.roles")}
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {roles.map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent-cyan/10 text-accent-cyan"
                  >
                    {role === "admin" ? tr("nav.admin") : role === "user" ? tr("nav.user") : role}
                  </span>
                ))}
              </dd>
            </div>
            {memberSince && (
              <div>
                <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  {tr("profile.memberSince")}
                </dt>
                <dd className="text-sm font-medium">{memberSince}</dd>
              </div>
            )}
          </dl>
        )}
      </div>

      {/* Change Password */}
      <div className="glass-panel rounded-xl p-6 space-y-5">
        <h2 className="text-lg font-semibold border-b border-border/50 pb-3">{tr("profile.changePassword")}</h2>

        {!session?.user?.fromBackend ? (
          <p className="text-sm text-muted-foreground">
            {tr("profile.backendOnlyPassword")}
          </p>
        ) : (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label htmlFor="current-password" className="block text-sm font-medium mb-1.5">
                {tr("profile.currentPassword")}
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
                {tr("profile.newPassword")}
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
                {tr("profile.confirmNewPassword")}
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
                {tr("profile.updatePassword")}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Browser Extension */}
      <div className="glass-panel rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2 border-b border-border/50 pb-3">
          <Puzzle size={18} className="text-accent-cyan" />
          <h2 className="text-lg font-semibold">{tr("profile.browserExtension")}</h2>
        </div>

        {/* How it works callout */}
        <div className="rounded-lg border border-accent-cyan/20 bg-accent-cyan/5 px-4 py-4 space-y-3">
          <p className="text-xs font-semibold text-accent-cyan uppercase tracking-wider">{tr("profile.howItWorks")}</p>
          <ol className="space-y-2">
            {[
              tr("profile.extensionStep1"),
              tr("profile.extensionStep2"),
              tr("profile.extensionStep3"),
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
            {tr("profile.backendOnlyExtension")}
          </p>
        ) : loadingInstances ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            {tr("profile.loadingInstances")}
          </div>
        ) : instances.length === 0 ? (
          <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-6 text-center space-y-2">
            <WifiOff size={24} className="mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">{tr("profile.noInstances")}</p>
            <p className="text-xs text-muted-foreground">
              {tr("profile.noInstancesHint")}
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
                      {inst.browser ?? tr("profile.unknownBrowser")}
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
                      {inst.is_active ? tr("profile.active") : tr("profile.idleWaitingHeartbeat")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="font-mono text-[10px] text-muted-foreground truncate">
                      {tr("profile.token")}: {inst.instance_token}
                    </span>
                    <CopyButton text={inst.instance_token} title={tr("profile.copyToken")} />
                  </div>
                  {inst.last_seen ? (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {tr("profile.lastHeartbeat")} {parseUTC(inst.last_seen).toLocaleString()}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {tr("profile.noHeartbeatYet")}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveInstance(inst.id)}
                  disabled={deletingId === inst.id}
                  className="flex-shrink-0 p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-50"
                  title={tr("profile.removeInstance")}
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
