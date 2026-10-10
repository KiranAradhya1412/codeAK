import assert from "node:assert/strict";
import test from "node:test";
import { executeWithPiston, normalizeOutput } from "./judge";

test("normalizes whitespace when comparing output", () => {
  assert.equal(normalizeOutput("  1 \n 2\t"), "1 2");
});

test("sends bounded JavaScript execution to Piston", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal(request.language, "javascript");
    assert.equal(request.run_timeout, 1200);
    assert.equal(request.run_memory_limit, 32 * 1024 * 1024);
    return new Response(JSON.stringify({ run: { stdout: "ok\n", stderr: "", code: 0, signal: null } }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    const result = await executeWithPiston("console.log('ok')", "javascript", "", { timeMs: 1200, memoryMb: 32 });
    assert.equal(result.status, "Executed");
    assert.equal(result.stdout, "ok\n");
    assert.equal(result.stderr, "");
    assert.ok(result.elapsedMs >= 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reports compilation errors even without a run stage", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    compile: { code: 1, stderr: "Syntax error" }
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    const result = await executeWithPiston("invalid", "cpp", "", { timeMs: 2000, memoryMb: 128 });
    assert.equal(result.status, "Compilation Error");
    assert.equal(result.stderr, "Syntax error");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("maps a sandbox kill to time limit exceeded", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    run: { stdout: "", stderr: "", code: null, signal: "SIGKILL" }
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    const result = await executeWithPiston("while (true) {}", "javascript", "", { timeMs: 500, memoryMb: 64 });
    assert.equal(result.status, "Time Limit Exceeded");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
