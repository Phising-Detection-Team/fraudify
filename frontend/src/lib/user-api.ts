import { config } from "./config";
import { apiFetch } from "./api-fetch";

const API_URL = config.API.BASE_URL;

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export interface UserStats {
  totalEmailsScanned: number;
  phishingDetected: number;
  markedSafe: number;
  creditsRemaining: number;
}

export const getUserStats = async (token: string): Promise<UserStats> => {
  const res = await apiFetch(`${API_URL}/api/stats`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch stats");
  const json = await res.json();
  const d = json.data ?? json;
  return {
    totalEmailsScanned: d.total_emails_scanned ?? 0,
    phishingDetected: d.threats_detected ?? 0,
    markedSafe: 0,
    creditsRemaining: 1000,
  };
};

export const getUserRounds = async (token: string) => {
  const res = await apiFetch(`${API_URL}/api/rounds`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch rounds");
  const json = await res.json();
  return json.items ?? json.data ?? [];
};

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

export type ScanVerdict = "phishing" | "likely_phishing" | "suspicious" | "likely_legitimate" | "legitimate";

export interface ScanResult {
  id: number;
  verdict: ScanVerdict;
  verdict_label: string;
  confidence: number;
  scam_score: number;
  reasoning: string;
  scanned_at: string;
}

export interface ScanHistoryItem {
  id: number;
  user_id: number;
  subject: string | null;
  body_snippet: string | null;
  verdict: ScanVerdict;
  confidence: number | null;
  scam_score: number | null;
  reasoning: string | null;
  scanned_at: string;
}

export const scanEmail = async (
  token: string,
  subject: string,
  body: string
): Promise<ScanResult> => {
  const res = await apiFetch(`${API_URL}/api/scan`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ subject, body }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? "Scan failed");
  }
  return json as ScanResult;
};

export const getScanHistory = async (
  token: string,
  page = 1,
  perPage = 20
): Promise<{ scans: ScanHistoryItem[]; total: number; pages: number }> => {
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  const res = await apiFetch(`${API_URL}/api/scan/history?${params}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch scan history");
  const json = await res.json();
  return {
    scans: json.scans ?? [],
    total: json.total ?? 0,
    pages: json.pages ?? 1,
  };
};
