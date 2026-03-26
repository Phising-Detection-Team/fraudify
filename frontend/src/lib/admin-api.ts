import { config } from "./config";

const API_URL = config.API.BASE_URL;

export const getAdminStats = async (token: string) => {
  const res = await fetch(`${API_URL}/users/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
};

export const getAdminRounds = async (token: string) => {
  const res = await fetch(`${API_URL}/rounds`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch rounds");
  return res.json();
};

export const getAdminAgents = async (token: string) => {
  const res = await fetch(`${API_URL}/agents`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch agents");
  return res.json();
};
