import { test, expect } from "@playwright/test";
import { rateLimit, clientKey } from "../app/lib/rateLimit";

// Pure unit tests of the in-memory backend (no Upstash env → memory path).
test.describe("rateLimit (in-memory backend)", () => {
  test("allows up to the limit, then blocks within the window", async () => {
    const key = `unit-${Date.now()}-${Math.random()}`;
    const rules = [{ limit: 3, windowSeconds: 60 }];
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit(key, rules));
    expect(results.slice(0, 3).every((r) => r.ok)).toBe(true);
    expect(results[3].ok).toBe(false);
    expect(results[3].retryAfterSeconds).toBeGreaterThan(0);
  });

  test("tracks each client key independently", async () => {
    const rules = [{ limit: 1, windowSeconds: 60 }];
    const a = `a-${Date.now()}-${Math.random()}`;
    const b = `b-${Date.now()}-${Math.random()}`;
    expect((await rateLimit(a, rules)).ok).toBe(true);
    expect((await rateLimit(a, rules)).ok).toBe(false); // a exhausted
    expect((await rateLimit(b, rules)).ok).toBe(true); // b independent
  });

  test("the tightest of multiple windows blocks first", async () => {
    const key = `multi-${Date.now()}-${Math.random()}`;
    const rules = [
      { limit: 100, windowSeconds: 60 },
      { limit: 2, windowSeconds: 86_400 },
    ];
    expect((await rateLimit(key, rules)).ok).toBe(true);
    expect((await rateLimit(key, rules)).ok).toBe(true);
    expect((await rateLimit(key, rules)).ok).toBe(false); // daily cap of 2 hit
  });

  test("clientKey uses the first x-forwarded-for hop, else local", () => {
    const withIp = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(clientKey(withIp)).toBe("1.2.3.4");
    expect(clientKey(new Request("http://x"))).toBe("local");
  });
});

// End-to-end: the /api/ai route actually enforces a limit. Default OCR budget is
// 60/min per client, so a burst past that must start returning 429. Uses the OCR
// bucket (action "ocr"); no other test hits the real OCR route, so this can't
// starve them.
test.describe("/api/ai rate limiting", () => {
  test("returns 429 once the OCR budget is exhausted", async ({ request }) => {
    let sawLimit = false;
    for (let i = 0; i < 80; i++) {
      const res = await request.post("/api/ai", { data: { action: "ocr" } });
      if (res.status() === 429) {
        expect(res.headers()["retry-after"]).toBeTruthy();
        sawLimit = true;
        break;
      }
    }
    expect(sawLimit).toBe(true);
  });
});
