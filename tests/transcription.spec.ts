import { test, expect } from "@playwright/test";
import { POST } from "../app/api/ai/transcribe/route";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
test.beforeEach(() => {
  Object.assign(process.env, { NODE_ENV: "production", GROQ_API_KEY: "test-key", UPSTASH_REDIS_REST_URL: "https://limiter.invalid", UPSTASH_REDIS_REST_TOKEN: "test-token" });
});
test.afterEach(() => { globalThis.fetch = originalFetch; process.env = { ...originalEnv }; });

function request() {
  const form = new FormData();
  form.append("file", new Blob(["test audio"]), "sample.wav");
  return new Request("http://localhost/api/ai/transcribe", { method: "POST", body: form });
}

test("production refuses uploads when shared limiting is unavailable", async () => {
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("must not call provider"); };
  expect((await POST(request())).status).toBe(503);
  expect(calls).toBe(0);
});

test("per-client budget blocks before contacting transcription provider", async () => {
  globalThis.fetch = async (url) => {
    expect(String(url)).toContain("limiter.invalid");
    return Response.json([{ result: 1000 }, { result: 1 }, { result: 1000 }, { result: 1 }]);
  };
  const response = await POST(request());
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBeTruthy();
});

test("global budget blocks even when the client still has quota", async () => {
  let calls = 0;
  globalThis.fetch = async (url) => {
    expect(String(url)).toContain("limiter.invalid");
    calls++;
    return Response.json(calls === 1 ? [{ result: 1 }, { result: 1 }, { result: 1 }, { result: 1 }] : [{ result: 100000 }, { result: 1 }]);
  };
  expect((await POST(request())).status).toBe(429);
  expect(calls).toBe(2);
});

test("allowed transcription reaches provider with timeout signal", async () => {
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("limiter.invalid")) return Response.json([{ result: 1 }, { result: 1 }, { result: 1 }, { result: 1 }]);
    expect(init?.signal).toBeTruthy();
    return Response.json({ text: "Transcript", language: "en" });
  };
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect((await response.json()).text).toBe("Transcript");
});
