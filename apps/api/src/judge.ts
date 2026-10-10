export type JudgeLanguage = "python" | "javascript" | "cpp" | "java";
export type Verdict =
  | "Accepted"
  | "Executed"
  | "Wrong Answer"
  | "Time Limit Exceeded"
  | "Runtime Error"
  | "Compilation Error";

interface Judge0Status {
  id?: number;
  description?: string;
}

interface Judge0Response {
  error?: string;
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  time?: string | null;
  memory?: number | null;
  status?: Judge0Status;
}

export interface JudgeExecution {
  status: Verdict;
  stdout: string;
  stderr: string;
  elapsedMs: number;
  memoryBytes: number | null;
}

export class JudgeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JudgeConfigurationError";
  }
}

const judge0Languages: Record<JudgeLanguage, number> = {
  python: 109,
  javascript: 102,
  cpp: 105,
  java: 62
};

export function normalizeOutput(output: string): string {
  return output.replace(/\s+/g, " ").trim();
}

function judge0Url(): URL {
  const configuredUrl = process.env.JUDGE0_API_URL ?? "https://judge0-ce.p.rapidapi.com";
  const url = new URL(configuredUrl);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("JUDGE0_API_URL must use HTTPS.");
  }
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/submissions`;
  url.search = new URLSearchParams({ base64_encoded: "false", wait: "true" }).toString();
  return url;
}

export async function executeWithJudge0(
  code: string,
  language: JudgeLanguage,
  input: string,
  limits: { timeMs: number; memoryMb: number }
): Promise<JudgeExecution> {
  const apiKey = process.env.JUDGE0_API_KEY;
  if (!apiKey) {
    throw new JudgeConfigurationError("Code execution is not configured. Add the JUDGE0_API_KEY secret to the API service.");
  }

  const startedAt = performance.now();
  const response = await fetch(judge0Url(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": new URL(process.env.JUDGE0_API_URL ?? "https://judge0-ce.p.rapidapi.com").host
    },
    body: JSON.stringify({
      source_code: code,
      language_id: judge0Languages[language],
      stdin: input,
      cpu_time_limit: limits.timeMs / 1000,
      wall_time_limit: Math.max(limits.timeMs / 1000 + 1, limits.timeMs / 1000 * 2),
      memory_limit: limits.memoryMb * 1024,
      enable_network: false
    }),
    signal: AbortSignal.timeout(limits.timeMs + 30_000)
  });
  const elapsedMs = Math.round(performance.now() - startedAt);
  const responseBody = await response.json().catch(() => null) as Judge0Response | null;
  if (!response.ok) {
    const details = responseBody?.error ?? responseBody?.message;
    if (response.status === 429) {
      throw new Error("The code execution service is at its request limit. Please try again later.");
    }
    throw new Error(details
      ? `Judge0 execution service error: ${details}`
      : `Judge0 execution service returned HTTP ${response.status}.`);
  }
  if (!responseBody) throw new Error("Judge0 returned an empty execution response.");

  const statusId = responseBody.status?.id;
  if (statusId === 1 || statusId === 2) {
    throw new Error("Judge0 did not finish the submission synchronously. Check the managed API plan and try again.");
  }
  if (statusId === 14) {
    throw new Error(responseBody.message
      ? `Judge0 internal execution error: ${responseBody.message}`
      : "Judge0 reported an internal execution error.");
  }
  if (typeof statusId !== "number") {
    throw new Error(responseBody.error ?? "Judge0 returned an invalid execution response.");
  }

  let status: Verdict;
  if (statusId === 3) {
    status = "Executed";
  } else if (statusId === 4) {
    status = "Wrong Answer";
  } else if (statusId === 5) {
    status = "Time Limit Exceeded";
  } else if (statusId === 6) {
    status = "Compilation Error";
  } else {
    status = "Runtime Error";
  }

  const stderr = (responseBody.compile_output || responseBody.stderr || responseBody.message || "").slice(0, 8_000);
  return {
    status,
    stdout: (responseBody.stdout ?? "").slice(0, 16_000),
    stderr,
    elapsedMs,
    memoryBytes: typeof responseBody.memory === "number" ? Math.round(responseBody.memory * 1024) : null
  };
}
