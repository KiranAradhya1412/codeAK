export type JudgeLanguage = "python" | "javascript" | "cpp" | "java";
export type Verdict =
  | "Accepted"
  | "Executed"
  | "Wrong Answer"
  | "Time Limit Exceeded"
  | "Runtime Error"
  | "Compilation Error";

interface PistonStage {
  stdout?: string;
  stderr?: string;
  code?: number | null;
  signal?: string | null;
}

interface PistonResponse {
  message?: string;
  compile?: PistonStage;
  run?: PistonStage;
}

export interface JudgeExecution {
  status: Verdict;
  stdout: string;
  stderr: string;
  elapsedMs: number;
}

const pistonLanguages: Record<JudgeLanguage, string> = {
  python: "python",
  javascript: "javascript",
  cpp: "c++",
  java: "java"
};

export function normalizeOutput(output: string): string {
  return output.replace(/\s+/g, " ").trim();
}

export async function executeWithPiston(
  code: string,
  language: JudgeLanguage,
  input: string,
  limits: { timeMs: number; memoryMb: number }
): Promise<JudgeExecution> {
  const startedAt = performance.now();
  const response = await fetch(process.env.PISTON_API_URL ?? "https://emkc.org/api/v2/piston/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: pistonLanguages[language],
      version: "*",
      files: [{ name: language === "java" ? "Main.java" : undefined, content: code }],
      stdin: input,
      args: [],
      compile_timeout: Math.min(limits.timeMs, 10_000),
      run_timeout: limits.timeMs,
      compile_memory_limit: limits.memoryMb * 1024 * 1024,
      run_memory_limit: limits.memoryMb * 1024 * 1024
    }),
    signal: AbortSignal.timeout(limits.timeMs + 15_000)
  });
  const elapsedMs = Math.round(performance.now() - startedAt);
  const responseBody = await response.json().catch(() => null) as PistonResponse | null;
  if (response.status === 408 || response.status === 504) {
    return { status: "Time Limit Exceeded", stdout: "", stderr: "Execution exceeded the configured time limit.", elapsedMs };
  }
  if (!response.ok) {
    const details = responseBody?.message;
    throw new Error(details
      ? `Piston execution service error: ${details}`
      : `Piston execution service returned HTTP ${response.status}.`);
  }
  if (!responseBody) throw new Error("Piston returned an empty execution response.");

  const compile = responseBody.compile;
  if (compile && compile.code !== 0 && !responseBody.run) {
    return {
      status: "Compilation Error",
      stdout: "",
      stderr: (compile.stderr ?? "").slice(0, 8_000),
      elapsedMs
    };
  }
  if (!responseBody.run) throw new Error("Piston returned an invalid execution response.");

  const run = responseBody.run;
  const stdout = (run.stdout ?? "").slice(0, 16_000);
  const stderr = (compile?.stderr || run.stderr || "").slice(0, 8_000);
  let status: Verdict;
  if (compile && compile.code !== 0) {
    status = "Compilation Error";
  } else if (run.signal === "SIGKILL" || /time limit|timed out/i.test(run.stderr ?? "")) {
    status = "Time Limit Exceeded";
  } else if (run.code !== 0 || run.signal) {
    status = "Runtime Error";
  } else {
    status = "Executed";
  }

  return { status, stdout, stderr, elapsedMs };
}
