import { config } from "./config";
import type { Round, Agent, DashboardStats } from "@/types";
import { apiFetch } from "./api-fetch";

const API_URL = config.API.BASE_URL;

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function mapStatus(status: string): Round["status"] {
  if (status === "completed") return "completed";
  if (status === "running") return "in_progress";
  return "failed";
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export const getAdminStats = async (token: string): Promise<DashboardStats> => {
  const res = await apiFetch(`${API_URL}/api/stats`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch stats");
  const json = await res.json();
  const d = json.data ?? json;
  return {
    totalApiCost: d.total_api_cost ?? 0,
    activeAgents: d.active_agents ?? 0,
    totalEmailsScanned: d.total_emails_scanned ?? 0,
    phishingDetected: d.threats_detected ?? 0,
    markedSafe: 0,
    creditsRemaining: 0,
    globalVtLimit: d.global_vt_limit ?? 0,
    globalVtUsed: d.global_vt_used ?? 0,
    globalVtRemaining: d.global_vt_remaining ?? 0,
  };
};

// ---------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------

export const getAdminRounds = async (token: string): Promise<Round[]> => {
  const res = await apiFetch(`${API_URL}/api/rounds`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch rounds");
  const json = await res.json();
  const items: Round["id"] extends string ? unknown[] : unknown[] = json.items ?? json.data ?? [];
  return (items as Record<string, unknown>[]).map((item) => ({
    id: String(item.id),
    date: String(item.started_at ?? ""),
    totalEmails: Number(item.total_emails ?? 0),
    detectionRate: Number((item.detector_accuracy as number | null) ?? 0),
    status: mapStatus(String(item.status ?? "failed")),
    detected: 0,
    emails: [],
    apiCosts: [],
  }));
};

export const createRound = async (
  token: string,
  totalEmails: number
): Promise<{ id: number }> => {
  const res = await apiFetch(`${API_URL}/api/rounds`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ total_emails: totalEmails }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Failed to create round");
  }
  const json = await res.json();
  return { id: (json.data as { id: number }).id };
};

export const runRound = async (
  token: string,
  roundId: number,
  parallelWorkflows = 2
): Promise<void> => {
  const res = await apiFetch(`${API_URL}/api/rounds/${roundId}/run`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ parallel_workflows: parallelWorkflows }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Failed to run round");
  }
};

export const getRound = async (token: string, roundId: number | string): Promise<Round> => {
  const res = await apiFetch(`${API_URL}/api/rounds/${roundId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch round");
  const json = await res.json();
  const item = (json.data ?? json) as Record<string, unknown>;
  return {
    id: String(item.id),
    date: String(item.started_at ?? ""),
    totalEmails: Number(item.total_emails ?? 0),
    detectionRate: Number((item.detector_accuracy as number | null) ?? 0),
    status: mapStatus(String(item.status ?? "failed")),
    detected: 0,
    emails: [],
    apiCosts: [],
  };
};

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export const getAdminAgents = async (token: string): Promise<Agent[]> => {
  const res = await apiFetch(`${API_URL}/api/agents`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch agents");
  const json = await res.json();
  const items = (json.data ?? json) as Record<string, unknown>[];
  return items.map((item) => ({
    id: String(item.id),
    name: String(item.name ?? item.id),
    type: String(item.type ?? "generator") as Agent["type"],
    model: String(item.model ?? ""),
    lastActive: String(item.last_active ?? ""),
    emailsProcessed: Number(item.call_count ?? 0),
    successRate: 100,
    totalCost: Number(item.total_cost ?? 0),
    totalTokens: Number(item.total_tokens ?? 0),
    status: (item.status as Agent["status"]) ?? "active",
  }));
};

// ---------------------------------------------------------------------------
// Cost breakdown (per agent type + model)
// ---------------------------------------------------------------------------

export interface CostBreakdownItem {
  agent_type: string;
  model_name: string;
  calls: number;
  tokens: number;
  cost: number;
}

export interface CostBreakdown {
  items: CostBreakdownItem[];
  total: number;
}

export const getCostBreakdown = async (token: string): Promise<CostBreakdown> => {
  const res = await apiFetch(`${API_URL}/api/stats/costs`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch cost breakdown");
  const json = await res.json();
  return { items: json.items ?? [], total: json.total ?? 0 };
};

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

export interface LogEntry {
  id: number;
  level: string;
  message: string;
  timestamp: string;
  round_id?: number;
}

export const getLogs = async (token: string, limit = 5): Promise<LogEntry[]> => {
  const res = await apiFetch(`${API_URL}/api/logs?per_page=${limit}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch logs");
  const json = await res.json();
  return (json.items ?? json.data ?? []) as LogEntry[];
};

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export interface BackendUser {
  id: number;
  email: string;
  username: string;
  roles: string[];
  created_at: string;
  is_active: boolean;
}

export const getMe = async (token: string): Promise<BackendUser> => {
  const res = await apiFetch(`${API_URL}/api/auth/me`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch profile");
  const json = await res.json();
  return json.user as BackendUser;
};

export const updatePassword = async (
  token: string,
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  const res = await apiFetch(`${API_URL}/api/auth/me/password`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error ?? "Failed to update password"
    );
  }
};

// ---------------------------------------------------------------------------
// Extension instances
// ---------------------------------------------------------------------------

export interface ExtensionInstance {
  id: number;
  user_id: number;
  instance_token: string;
  browser: string | null;
  os_name: string | null;
  last_seen: string | null;
  created_at: string;
  is_active: boolean;
  user?: { id: number; username: string; email: string };
}

export const getExtensionInstances = async (token: string): Promise<ExtensionInstance[]> => {
  const res = await apiFetch(`${API_URL}/api/extension/instances`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch extension instances");
  const json = await res.json();
  return (json.data ?? []) as ExtensionInstance[];
};

export const getAllExtensionInstances = async (
  token: string
): Promise<{ data: ExtensionInstance[]; total: number; active: number }> => {
  const res = await apiFetch(`${API_URL}/api/extension/instances/all`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch all extension instances");
  const json = await res.json();
  return { data: json.data ?? [], total: json.total ?? 0, active: json.active ?? 0 };
};

export const deleteExtensionInstance = async (
  token: string,
  instanceId: number
): Promise<void> => {
  const res = await apiFetch(`${API_URL}/api/extension/instances/${instanceId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Failed to remove instance");
  }
};

// ---------------------------------------------------------------------------
// Users (admin)
// ---------------------------------------------------------------------------

export const getUsers = async (token: string): Promise<BackendUser[]> => {
  const res = await apiFetch(`${API_URL}/api/users`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch users");
  const json = await res.json();
  return (json.items ?? json.data ?? []) as BackendUser[];
};

// ---------------------------------------------------------------------------
// Invite codes (admin)
// ---------------------------------------------------------------------------

export interface InviteCode {
  code: string;
  role_name: string;
  expires_at: string | null;
  used: boolean;
}

export interface EmailOverride {
  id: number;
  email_id: number;
  verdict: string;
  reason?: string;
  overridden_by: number;
}

export const overrideEmailVerdict = async (
  token: string,
  emailId: number,
  verdict: string,
  reason?: string
): Promise<EmailOverride> => {
  const res = await apiFetch(`${API_URL}/api/emails/${emailId}/override`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ verdict, ...(reason ? { reason } : {}) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to submit override");
  }
  const json = await res.json();
  return json.data as EmailOverride;
};

// ---------------------------------------------------------------------------
// Invite Panel API (Sprint 5.6)
// ---------------------------------------------------------------------------

export interface InviteRecord {
  code: string;
  role: string;
  expires_at: string;
  uses_left: number;
}

export async function createInvite(
  token: string,
  role: 'user' | 'admin',
  expiryHours: number
): Promise<{ invite_link: string; code: string }> {
  const expiresInDays = expiryHours / 24;
  const res = await apiFetch(`${API_URL}/api/auth/admin/invite`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ role_name: role, expires_in_days: expiresInDays }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Failed to create invite');
  }
  const json = await res.json();
  const invite = json.invite as { code: string };
  const frontendOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  return {
    code: invite.code,
    invite_link: `${frontendOrigin}/auth/signup?invite=${invite.code}`,
  };
}

export async function listInvites(token: string): Promise<InviteRecord[]> {
  const res = await apiFetch(`${API_URL}/api/auth/invites`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch invites');
  const json = await res.json();
  return (json.data ?? []) as InviteRecord[];
}

export async function revokeInvite(token: string, code: string): Promise<void> {
  const res = await apiFetch(`${API_URL}/api/auth/invites/${encodeURIComponent(code)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Failed to revoke invite');
  }
}

// ---------------------------------------------------------------------------
// Threat Intelligence Panel (Sprint 5.5)
// ---------------------------------------------------------------------------

export interface IntelligenceStats {
  confidence_distribution: { bucket: string; count: number }[];
  accuracy_over_rounds: { round_id: number; accuracy: number; completed_at: string }[];
  fp_fn_rates: { round_id: number; false_positive_rate: number; false_negative_rate: number }[];
  top_phishing_words: { word: string; count: number }[];
}

export async function getIntelligenceStats(token: string): Promise<IntelligenceStats> {
  const res = await apiFetch(`${API_URL}/api/stats/intelligence`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch intelligence stats');
  const json = await res.json();
  return json.data as IntelligenceStats;
}

// ---------------------------------------------------------------------------
// Cache stats (Sprint 7 — R6)
// ---------------------------------------------------------------------------

export interface CacheStats {
  cached_keys: number;
  available: boolean;
}

export async function getCacheStats(token: string): Promise<CacheStats> {
  const res = await apiFetch(`${API_URL}/api/stats/cache`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch cache stats');
  const json = await res.json();
  return json.data as CacheStats;
}

// ---------------------------------------------------------------------------
// Admin recent scans
// ---------------------------------------------------------------------------

export interface AdminScanItem {
  id: number;
  user_id: number;
  user_email: string;
  subject: string | null;
  body_snippet: string | null;
  full_body: string | null;
  verdict: string;
  confidence: number | null;
  scam_score: number | null;
  reasoning: string | null;
  scanned_at: string;
}

export interface AdminScansPage {
  scans: AdminScanItem[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export const getAdminRecentScans = async (
  token: string,
  page = 1,
  perPage = 20
): Promise<AdminScansPage> => {
  const res = await apiFetch(
    `${API_URL}/api/scan/admin/recent?page=${page}&per_page=${perPage}`,
    { headers: authHeaders(token) }
  );
  if (!res.ok) throw new Error('Failed to fetch admin scans');
  const json = await res.json();
  return {
    scans: json.scans ?? [],
    total: json.total ?? 0,
    page: json.page ?? page,
    per_page: json.per_page ?? perPage,
    pages: json.pages ?? 1,
  };
};

export const createInviteCode = async (
  token: string,
  roleName = "user",
  expiresInDays = 7
): Promise<InviteCode> => {
  const res = await apiFetch(`${API_URL}/api/auth/admin/invite`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ role_name: roleName, expires_in_days: expiresInDays }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to create invite code");
  }
  const json = await res.json();
  return json.invite as InviteCode;
};

// --- Feedback ---
export interface FeedbackItem {
  id: number;
  user_id: number;
  subject: string | null;
  description: string;
  status: string;
  created_at: string;
  updated_at: string | null;
}

export interface FeedbackPage {
  items: FeedbackItem[];
  total: number;
  pages: number;
  page: number;
  per_page: number;
}

export const getFeedback = async (
  token: string,
  page = 1,
  limit = 20,
  status?: string
): Promise<FeedbackPage> => {
  const url = new URL(`${API_URL}/api/feedback`);
  url.searchParams.append("page", page.toString());
  url.searchParams.append("per_page", limit.toString());
  if (status) {
    url.searchParams.append("status", status);
  }
  const res = await apiFetch(url.toString(), {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch feedback");
  return res.json();
};

export const updateFeedbackStatus = async (
  token: string,
  feedbackId: number,
  status: string
): Promise<FeedbackItem> => {
  const res = await apiFetch(`${API_URL}/api/feedback/${feedbackId}/status`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update feedback status");
  const json = await res.json();
  return json.feedback;
};
