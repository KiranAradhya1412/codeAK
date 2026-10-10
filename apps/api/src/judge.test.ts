import assert from "node:assert/strict";
import test from "node:test";
import { executeWithJudge0, normalizeOutput } from "./judge";

async function withJudge0(fetchMock: typeof fetch, run: () => Promise<void>) {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.JUDGE0_API_KEY;
  const originalUrl = process.env.JUDGE0_API_URL;
  globalThis.fetch = fetchMock;
  process.env.JUDGE0_API_KEY = "test-key";
  delete process.env.JUDGE0_API_URL;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.JUDGE0_API_KEY;
    else process.env.JUDGE0_API_KEY = originalKey;
    if (originalUrl === undefined) delete process.env.JUDGE0_API_URL;
    else process.env.JUDGE0_API_URL = originalUrl;
  }
}

test("normalizes whitespace when comparing output", () => {
  assert.equal(normalizeOutput("  1 \n 2\t"), "1 2");
});

test("sends bounded JavaScript execution to Judge0 and returns its metrics", async () => {
  await withJudge0(async (input, init) => {
    const request = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal(String(input), "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true");
    assert.equal(request.source_code, "console.log('ok')");
    assert.equal(request.language_id, 102);
    assert.equal(request.stdin, "sample");
    assert.equal(request.cpu_time_limit, 1.2);
    assert.equal(request.memory_limit, 32 * 1024);
    assert.equal(request.enable_network, false);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("X-RapidAPI-Key"), "test-key");
    assert.equal(headers.get("X-RapidAPI-Host"), "judge0-ce.p.rapidapi.com");
    return new Response(JSON.stringify({
      stdout: "ok\n",
      stderr: null,
      time: "0.003",
      memory: 1280,
      status: { id: 3, description: "Accepted" }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }, async () => {
    const result = await executeWithJudge0("console.log('ok')", "javascript", "sample", { timeMs: 1200, memoryMb: 32 });
    assert.equal(result.status, "Executed");
    assert.equal(result.stdout, "ok\n");
    assert.equal(result.stderr, "");
    assert.equal(result.memoryBytes, 1280 * 1024);
    assert.ok(result.elapsedMs >= 0);
  });
});

test("maps Judge0 compilation errors to Compilation Error", async () => {
  await withJudge0(async () => new Response(JSON.stringify({
    compile_output: "Syntax error",
    status: { id: 6, description: "Compilation Error" }
  }), { status: 200, headers: { "Content-Type": "application/json" } }), async () => {
    const result = await executeWithJudge0("invalid", "cpp", "", { timeMs: 2000, memoryMb: 128 });
    assert.equal(result.status, "Compilation Error");
    assert.equal(result.stderr, "Syntax error");
  });
});

test("maps Judge0 time limit status", async () => {
  await withJudge0(async () => new Response(JSON.stringify({
    status: { id: 5, description: "Time Limit Exceeded" }
  }), { status: 200, headers: { "Content-Type": "application/json" } }), async () => {
    const result = await executeWithJudge0("while (true) {}", "javascript", "", { timeMs: 500, memoryMb: 64 });
    assert.equal(result.status, "Time Limit Exceeded");
  });
});

test("reports Judge0 rate limits clearly", async () => {
  await withJudge0(async () => new Response(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: { "Content-Type": "application/json" }
  }), async () => {
    await assert.rejects(
      executeWithJudge0("print(1)", "python", "", { timeMs: 2000, memoryMb: 128 }),
      /at its request limit/
    );
  });
});

test("requires the managed Judge0 API key", async () => {
  const originalKey = process.env.JUDGE0_API_KEY;
  delete process.env.JUDGE0_API_KEY;
  try {
    await assert.rejects(
      executeWithJudge0("print(1)", "python", "", { timeMs: 2000, memoryMb: 128 }),
      /JUDGE0_API_KEY/
    );
  } finally {
    if (originalKey !== undefined) process.env.JUDGE0_API_KEY = originalKey;
  }
});
