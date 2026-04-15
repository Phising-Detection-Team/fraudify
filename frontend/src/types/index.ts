export type Role = "user" | "admin";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  credits: number;
};

export type AgentType = "generator" | "detector";

export type Agent = {
  id: string;
  name: string;
  type: AgentType;
  model: string;
  lastActive: string;
  emailsProcessed: number;
  successRate: number;
  totalCost?: number;
  totalTokens?: number;
  status: "active" | "training" | "offline";
};

export type ModelCost = {
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
};

export type EmailVerdict = "safe" | "phishing";

export type EmailResult = {
  id: string;
  subject: string;
  generatorResponse: string;
  detectorResponse: string;
  verdict: EmailVerdict;
  confidence: number;
  timestamp: string;
};

export type RoundStatus = "completed" | "in_progress" | "failed";

export type Round = {
  id: string;
  date: string;
  totalEmails: number;
  detected: number;
  detectionRate: number;
  status: RoundStatus;
  emails: EmailResult[];
  apiCosts: ModelCost[];
};

export type DashboardStats = {
  totalEmailsScanned: number;
  phishingDetected: number;
  markedSafe: number;
  creditsRemaining: number;
  totalApiCost?: number; // admin only
  activeAgents?: number; // admin only
  trainingRounds?: number; // admin only
  globalVtLimit?: number; // admin only
  globalVtUsed?: number; // admin only
  globalVtRemaining?: number; // admin only
};
