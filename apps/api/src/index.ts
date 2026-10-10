import "dotenv/config";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { createClient, type User } from "@supabase/supabase-js";
import { executeWithJudge0, JudgeConfigurationError, normalizeOutput, type JudgeLanguage, type Verdict } from "./judge";

const requiredEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
for (const key of requiredEnv) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const app = express();
const port = Number(process.env.PORT ?? 4000);
const origins = (process.env.WEB_ORIGIN ?? "http://localhost:3000").split(",").map((origin) => origin.trim());

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(cors({ origin: origins }));
app.use(express.json({ limit: "48kb" }));
app.use(rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a minute before trying again." }
}));

interface AuthenticatedRequest extends Request {
  user?: User;
}

interface ProblemRow {
  id: string;
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  category: string;
  description: string;
  input_format: string;
  output_format: string;
  starter_code: Record<JudgeLanguage, string>;
  time_limit: number;
  memory_limit: number;
}

interface TestCase {
  input: string;
  expected_output: string;
}

interface SubmissionPayload {
  problemId: string;
  code: string;
  language: JudgeLanguage;
  mode: "sample" | "submit";
}

const executionRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 10,
  keyGenerator: (request) => (request as AuthenticatedRequest).user?.id ?? "unauthenticated",
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Execution limit reached. Please wait a minute before trying again." }
});

function asyncRoute(handler: (req: AuthenticatedRequest, res: Response) => Promise<void>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    void handler(req, res).catch(next);
  };
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    res.status(401).json({ error: "Sign in to run or submit code." });
    return;
  }
  void supabase.auth.getUser(token).then(({ data, error }) => {
    if (error || !data.user) {
      res.status(401).json({ error: "Your session has expired. Please sign in again." });
      return;
    }
    req.user = data.user;
    next();
  }).catch(next);
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  void Promise.resolve(supabase.from("profiles").select("role").eq("id", req.user!.id).maybeSingle())
    .then(({ data, error }) => {
      if (error) {
        next(new Error(`Could not verify administrator access: ${error.message}`));
        return;
      }
      if (data?.role !== "admin") {
        res.status(404).json({ error: "Not found." });
        return;
      }
      next();
    }).catch(next);
}

function validatePayload(body: unknown): SubmissionPayload | null {
  if (typeof body !== "object" || body === null) return null;
  const value = body as Record<string, unknown>;
  const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  if (typeof value.problemId !== "string" || !uuidPattern.test(value.problemId)) return null;
  if (typeof value.code !== "string" || value.code.trim().length === 0 || value.code.length > 30_000) return null;
  if (value.language !== "python" && value.language !== "javascript" && value.language !== "cpp" && value.language !== "java") return null;
  if (value.mode !== "sample" && value.mode !== "submit") return null;
  return { problemId: value.problemId, code: value.code, language: value.language, mode: value.mode };
}

function verdictFor(status: Verdict, expected: string, actual: string): Verdict {
  if (status !== "Executed") return status;
  return normalizeOutput(actual) === normalizeOutput(expected) ? "Accepted" : "Wrong Answer";
}

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.post("/api/visits", requireAuth, asyncRoute(async (req, res) => {
  const { error } = await supabase.from("site_visits").upsert({
    user_id: req.user!.id,
    visit_date: new Date().toISOString().slice(0, 10)
  }, { onConflict: "user_id,visit_date", ignoreDuplicates: true });
  if (error) throw new Error(`Could not record visit: ${error.message}`);
  res.status(204).end();
}));

app.get("/api/admin/dashboard", requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const requestedPage = Number(req.query.page ?? 1);
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1 || requestedPage > 10_000) {
    res.status(400).json({ error: "Invalid page number." });
    return;
  }
  const perPage = 50;
  const [{ data: authUsers, error: usersError }, { data: metrics, error: metricsError }] = await Promise.all([
    supabase.auth.admin.listUsers({ page: requestedPage, perPage }),
    supabase.rpc("get_admin_site_metrics")
  ]);
  if (usersError) throw new Error(`Could not load user accounts: ${usersError.message}`);
  if (metricsError) throw new Error(`Could not load site metrics: ${metricsError.message}`);
  if (!metrics || typeof metrics !== "object") throw new Error("Site metrics returned an invalid response.");

  const userIds = authUsers.users.map((user) => user.id);
  const { data: profiles, error: profilesError } = userIds.length
    ? await supabase.from("profiles").select("id,full_name,username,role,created_at").in("id", userIds)
    : { data: [], error: null };
  if (profilesError) throw new Error(`Could not load user profiles: ${profilesError.message}`);

  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const accounts = authUsers.users.map((user) => {
    const profile = profilesById.get(user.id);
    return {
      id: user.id,
      email: user.email ?? null,
      fullName: profile?.full_name ?? null,
      username: profile?.username ?? null,
      role: profile?.role ?? "user",
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null
    };
  });

  res.json({
    metrics,
    accounts,
    page: requestedPage,
    perPage,
    hasMore: requestedPage * perPage < Number(metrics.totalUsers)
  });
}));

app.get("/api/leaderboard", requireAuth, asyncRoute(async (_req, res) => {
  const { data, error } = await supabase.rpc("get_leaderboard");
  if (error) throw new Error(`Could not load leaderboard: ${error.message}`);
  res.json(data ?? []);
}));

app.get("/api/problems", requireAuth, asyncRoute(async (_req, res) => {
  const { data, error } = await supabase.from("problems")
    .select("id,slug,title,difficulty,category,description,input_format,output_format,starter_code,time_limit,memory_limit")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Could not load problems: ${error.message}`);
  res.json(data as ProblemRow[]);
}));

app.get("/api/problems/:slug", requireAuth, asyncRoute(async (req, res) => {
  const { data, error } = await supabase.from("problems")
    .select("id,slug,title,difficulty,category,description,input_format,output_format,starter_code,time_limit,memory_limit")
    .eq("slug", req.params.slug)
    .maybeSingle();
  if (error) throw new Error(`Could not load problem: ${error.message}`);
  if (!data) {
    res.status(404).json({ error: "Problem not found." });
    return;
  }

  const { data: samples, error: sampleError } = await supabase.from("test_cases")
    .select("input,expected_output")
    .eq("problem_id", data.id)
    .eq("is_sample", true)
    .order("position", { ascending: true });
  if (sampleError) throw new Error(`Could not load sample cases: ${sampleError.message}`);
  res.json({ ...data, examples: (samples ?? []).map((testCase) => ({ input: testCase.input, output: testCase.expected_output })) });
}));

app.get("/api/submissions/status", requireAuth, asyncRoute(async (req, res) => {
  const { data, error } = await supabase.from("submissions")
    .select("problem_id")
    .eq("user_id", req.user!.id)
    .eq("status", "Accepted");
  if (error) throw new Error(`Could not load solved problems: ${error.message}`);
  res.json({ solvedProblemIds: [...new Set((data ?? []).map((submission) => submission.problem_id))] });
}));

app.post("/api/submissions", requireAuth, executionRateLimit, asyncRoute(async (req, res) => {
  const payload = validatePayload(req.body);
  if (!payload) {
    res.status(400).json({ error: "Invalid submission. Check the problem, source code, language, and mode." });
    return;
  }

  const { data: problem, error: problemError } = await supabase.from("problems")
    .select("id,time_limit,memory_limit")
    .eq("id", payload.problemId)
    .maybeSingle();
  if (problemError) throw new Error(`Could not load problem limits: ${problemError.message}`);
  if (!problem) {
    res.status(404).json({ error: "Problem not found." });
    return;
  }

  const caseLimit = payload.mode === "sample" ? 10 : 30;
  const { data: cases, error: casesError } = await supabase.from("test_cases")
    .select("input,expected_output")
    .eq("problem_id", payload.problemId)
    .eq("is_sample", payload.mode === "sample")
    .order("position", { ascending: true })
    .limit(caseLimit + 1);
  if (casesError) throw new Error(`Could not load test cases: ${casesError.message}`);
  if (cases && cases.length > caseLimit) {
    res.status(422).json({ error: `This problem exceeds the ${caseLimit}-case ${payload.mode} execution limit.` });
    return;
  }
  if (!cases?.length) {
    res.status(422).json({ error: payload.mode === "sample" ? "No sample cases are configured for this problem." : "No hidden test cases are configured for this problem." });
    return;
  }

  let passed = 0;
  let elapsedMs = 0;
  let memoryBytes: number | null = null;
  let finalStatus: Verdict = "Accepted";
  let failureMessage: string | undefined;
  const sampleResults: { status: Verdict; stdout: string; expectedOutput: string }[] = [];
  for (const testCase of cases as TestCase[]) {
    let execution;
    try {
      execution = await executeWithJudge0(payload.code, payload.language, testCase.input, {
        timeMs: problem.time_limit,
        memoryMb: problem.memory_limit
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        finalStatus = "Time Limit Exceeded";
        failureMessage = "Execution exceeded the configured time limit.";
        break;
      }
      throw error;
    }

    elapsedMs = Math.max(elapsedMs, execution.elapsedMs);
    if (execution.memoryBytes !== null) {
      memoryBytes = memoryBytes === null ? execution.memoryBytes : Math.max(memoryBytes, execution.memoryBytes);
    }
    const status = verdictFor(execution.status, testCase.expected_output, execution.stdout);
    if (payload.mode === "sample") {
      sampleResults.push({
        status,
        stdout: execution.stdout,
        expectedOutput: testCase.expected_output
      });
    }
    if (status !== "Accepted" && status !== "Executed") {
      finalStatus = status;
      failureMessage = execution.stderr || undefined;
      break;
    }
    passed += 1;
  }

  if (payload.mode === "submit") {
    const { error: saveError } = await supabase.from("submissions").insert({
      user_id: req.user!.id,
      problem_id: payload.problemId,
      language: payload.language,
      code: payload.code,
      status: finalStatus,
      execution_time: elapsedMs,
      memory_used: memoryBytes,
      passed_tests: passed,
      total_tests: cases.length
    });
    if (saveError) throw new Error(`Could not save submission: ${saveError.message}`);
  }

  res.json({
    status: finalStatus,
    mode: payload.mode,
    passed,
    total: cases.length,
    timeMs: elapsedMs,
    memoryBytes,
    message: failureMessage,
    sampleResults: payload.mode === "sample" ? sampleResults : undefined
  });
}));

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  console.error("[api]", error);
  res.status(error instanceof JudgeConfigurationError ? 503 : 502).json({ error: message });
});

app.listen(port, () => {
  console.log(`codeAK API listening on port ${port}`);
});
