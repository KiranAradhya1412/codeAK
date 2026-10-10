import type { ExecutionResult, Language, Problem } from "./types";
import { getSupabase } from "./supabase";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface AdminDashboard {
  metrics: {
    totalUsers: number;
    totalVisits: number;
    uniqueVisitors: number;
  };
  accounts: {
    id: string;
    email: string | null;
    fullName: string | null;
    username: string | null;
    role: string;
    createdAt: string;
    lastSignInAt: string | null;
  }[];
  page: number;
  perPage: number;
  hasMore: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  points: number;
  solved_challenges: number;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error("Sign in to run code.");
  return { Authorization: `Bearer ${data.session.access_token}` };
}

async function readError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => ({})) as { error?: string };
  return body.error ?? fallback;
}

export async function listProblems(): Promise<Problem[]> {
  const response = await fetch(`${apiUrl}/api/problems`, { headers: await authHeaders(), cache: "no-store" });
  if (!response.ok) throw new Error(await readError(response, "Could not load problems."));
  return response.json() as Promise<Problem[]>;
}

export async function getProblem(slug: string): Promise<Problem> {
  const response = await fetch(`${apiUrl}/api/problems/${encodeURIComponent(slug)}`, {
    headers: await authHeaders(),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(await readError(response, response.status === 404 ? "Problem not found." : "Could not load problem."));
  return response.json() as Promise<Problem>;
}

export async function getSolvedProblemIds(): Promise<string[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return [];
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw new Error(error.message);
  if (!data.session) return [];
  const response = await fetch(`${apiUrl}/api/submissions/status`, {
    headers: { Authorization: `Bearer ${data.session.access_token}` },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(await readError(response, "Could not load submission status."));
  const body = await response.json() as { solvedProblemIds: string[] };
  return body.solvedProblemIds;
}

export async function executeSubmission(
  problemId: string,
  code: string,
  language: Language,
  mode: "sample" | "submit"
): Promise<ExecutionResult> {
  const headers = await authHeaders();
  const response = await fetch(`${apiUrl}/api/submissions`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ problemId, code, language, mode })
  });
  if (!response.ok) throw new Error(await readError(response, "Could not execute submission."));
  return response.json() as Promise<ExecutionResult>;
}

export async function recordSiteVisit(accessToken: string): Promise<void> {
  const response = await fetch(`${apiUrl}/api/visits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(await readError(response, "Could not record this visit."));
}

export async function getAdminDashboard(page: number): Promise<AdminDashboard> {
  const response = await fetch(`${apiUrl}/api/admin/dashboard?page=${page}`, {
    headers: await authHeaders(),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(await readError(response, "Could not load dashboard."));
  return response.json() as Promise<AdminDashboard>;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const response = await fetch(`${apiUrl}/api/leaderboard`, {
    headers: await authHeaders(),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(await readError(response, "Could not load leaderboard."));
  return response.json() as Promise<LeaderboardEntry[]>;
}
