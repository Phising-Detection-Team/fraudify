import { Agent, DashboardStats, EmailResult, Round, User } from "@/types";

export const MOCK_USERS: User[] = [
  { id: "u1", name: "Alice Security", email: "user@sentra.ai", role: "user", credits: 500 },
  { id: "u2", name: "Bob Admin", email: "admin@sentra.ai", role: "admin", credits: 10000 },
];

export const MOCK_STATS_USER: DashboardStats = {
  totalEmailsScanned: 12450,
  phishingDetected: 342,
  markedSafe: 12108,
  creditsRemaining: 450,
};

export const MOCK_STATS_ADMIN: DashboardStats = {
  ...MOCK_STATS_USER,
  totalEmailsScanned: 245000,
  phishingDetected: 4503,
  markedSafe: 240497,
  totalApiCost: 1245.50,
  activeAgents: 5,
  trainingRounds: 12,
};

export const MOCK_AGENTS: Agent[] = [
  { id: "a1", name: "Alpha Gen", type: "generator", model: "gpt-4o", lastActive: "2 mins ago", emailsProcessed: 50000, successRate: 98.2, status: "active" },
  { id: "a2", name: "Beta Det", type: "detector", model: "claude-sonnet-4", lastActive: "1 min ago", emailsProcessed: 45000, successRate: 99.1, status: "active" },
  { id: "a3", name: "Gamma Gen", type: "generator", model: "gemini-1.5-pro", lastActive: "1 hr ago", emailsProcessed: 12000, successRate: 94.5, status: "training" },
];

export const MOCK_ROUNDS: Round[] = [
  {
    id: "r1",
    date: new Date().toISOString(),
    totalEmails: 20,
    detected: 18,
    detectionRate: 90,
    status: "completed",
    apiCosts: [
      { model: "gpt-4o", calls: 40, inputTokens: 12000, outputTokens: 8000, cost: 0.45 },
      { model: "claude-sonnet-4", calls: 20, inputTokens: 5000, outputTokens: 2000, cost: 0.15 },
    ],
    emails: [
      { id: "e1", subject: "Urgent: Update your password", generatorResponse: "Crafted realistic IT memo.", detectorResponse: "Detected urgency keywords and spoofed headers.", verdict: "phishing", confidence: 99, timestamp: new Date().toISOString() },
      { id: "e2", subject: "Weekly Newsletter", generatorResponse: "Standard marketing template.", detectorResponse: "Clean links, valid DKIM.", verdict: "safe", confidence: 95, timestamp: new Date().toISOString() },
    ]
  },
  {
    id: "r2",
    date: new Date(Date.now() - 86400000).toISOString(),
    totalEmails: 50,
    detected: 10,
    detectionRate: 20,
    status: "completed",
    apiCosts: [
      { model: "gpt-4o", calls: 100, inputTokens: 32000, outputTokens: 18000, cost: 1.25 },
    ],
    emails: []
  }
];

export const MOCK_LIVE_FEED: EmailResult[] = [
  { id: "ev1", subject: "Failed Delivery for Package", generatorResponse: "N/A", detectorResponse: "Malicious tracking link spotted.", verdict: "phishing", confidence: 98, timestamp: new Date().toISOString() },
  { id: "ev2", subject: "Meeting Notes - Q3", generatorResponse: "N/A", detectorResponse: "No threats found.", verdict: "safe", confidence: 99, timestamp: new Date(Date.now() - 15000).toISOString() },
  { id: "ev3", subject: "Final Notice: Invoice Overdue", generatorResponse: "N/A", detectorResponse: "Suspicious attachment (PDF).", verdict: "phishing", confidence: 92, timestamp: new Date(Date.now() - 45000).toISOString() },
];
