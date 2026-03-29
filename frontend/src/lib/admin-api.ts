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

export const registerExtensionInstance = async (
  token: string,
  browser?: string,
  osName?: string
): Promise<ExtensionInstance> => {
  const res = await apiFetch(`${API_URL}/api/extension/register`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ browser, os_name: osName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Failed to register instance");
  }
  const json = await res.json();
  return json.data as ExtensionInstance;
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
