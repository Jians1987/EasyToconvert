// Best-effort rate limiting for the paid API routes (OCR + chat + Adobe export).
//
// Two backends, chosen at call time:
//   1. Upstash Redis REST  (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
//      Shared across every serverless instance — the ONLY backend that actually
//      limits abuse on Vercel, where each invocation may be a fresh process.
//      Manually verified against a real Upstash database: two independent
//      `next dev` processes on different ports, both configured with the same
//      credentials, correctly shared one counter — a second process's request
//      pushed the first process over budget on ITS OWN next call, which is
//      only possible if the count came from Redis, not process memory.
//   2. In-memory sliding window (fallback)
//      Correct only within one long-lived process (self-host / `next start` on a
//      single box). On serverless it degrades to per-instance, so treat it as a
//      speed bump, not a guarantee. Deploy Upstash for real protection.
//
// Fail-open: if the store errors we allow the request. A rate limiter must never
// take the whole API down.

export interface RateLimitRule {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

/** Human-readable label for the breached window — lets the UI say "try again
 *  tomorrow" vs "try again in a minute" without re-deriving it from seconds. */
export type LimitKind = "minute" | "hourly" | "daily" | "custom";

function windowToKind(windowSeconds: number): LimitKind {
  if (windowSeconds === 60) return "minute";
  if (windowSeconds === 3_600) return "hourly";
  if (windowSeconds === 86_400) return "daily";
  return "custom";
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  limit: number;
  /** Seconds until the (breached) window resets — used for Retry-After. */
  retryAfterSeconds: number;
  /** Which window was breached; absent when ok === true. */
  limitKind?: LimitKind;
}

// key -> ascending request timestamps (ms). One entry per (client, window).
const memory = new Map<string, number[]>();

function memoryCheck(memKey: string, rule: RateLimitRule, now: number): RateLimitResult {
  const windowMs = rule.windowSeconds * 1000;
  const cutoff = now - windowMs;
  const hits = (memory.get(memKey) ?? []).filter((t) => t > cutoff);
  const ok = hits.length < rule.limit;
  if (ok) hits.push(now);
  memory.set(memKey, hits);

  // Opportunistic cleanup so the map can't grow without bound.
  if (memory.size > 5000) {
    for (const k of Array.from(memory.keys())) {
      const kept = (memory.get(k) ?? []).filter((t) => t > cutoff);
      if (kept.length === 0) memory.delete(k);
      else memory.set(k, kept);
    }
  }

  return {
    ok,
    remaining: Math.max(0, rule.limit - hits.length),
    limit: rule.limit,
    retryAfterSeconds: ok ? 0 : rule.windowSeconds,
    limitKind: windowToKind(rule.windowSeconds),
  };
}

/**
 * Fixed-window counters for ALL rules in a single Upstash pipeline call.
 *
 * Prior design made one round-trip per rule (sequential). For the OCR bucket
 * (2 rules: per-minute + per-day) that was two sequential Upstash calls, each
 * up to the 1 500 ms timeout — 3 s worst-case overhead per OCR request. Now
 * it is one call regardless of how many rules are in play.
 *
 * Returns an array of the same length as `rules`. Each element is a result
 * for that rule, or null (Upstash not configured / unreachable → caller falls
 * back to the in-memory backend for that rule).
 */
async function upstashCheckBatch(key: string, rules: RateLimitRule[]): Promise<(RateLimitResult | null)[]> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return rules.map(() => null);

  const nowSec = Math.floor(Date.now() / 1000);
  const pipeline: unknown[] = [];
  const redisKeys: string[] = [];

  for (const rule of rules) {
    const bucket = Math.floor(nowSec / rule.windowSeconds);
    const rk = `rl:${key}:${rule.windowSeconds}:${bucket}`;
    redisKeys.push(rk);
    pipeline.push(["INCR", rk]);
    pipeline.push(["EXPIRE", rk, rule.windowSeconds]);
  }

  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(pipeline),
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return rules.map(() => null);
    const data = await res.json();

    return rules.map((rule, i) => {
      // Pipeline returns [INCR-result, EXPIRE-result, INCR-result, EXPIRE-result, …]
      // INCR result is at index i*2; EXPIRE result at i*2+1 (not needed here).
      const count = Number(data?.[i * 2]?.result ?? 0);
      if (!Number.isFinite(count) || count <= 0) return null;
      return {
        ok: count <= rule.limit,
        remaining: Math.max(0, rule.limit - count),
        limit: rule.limit,
        retryAfterSeconds: count <= rule.limit ? 0 : rule.windowSeconds,
        limitKind: windowToKind(rule.windowSeconds),
      };
    });
  } catch {
    return rules.map(() => null); // network/timeout → fall back to in-memory
  }
}

/**
 * Check every rule for a client key. The first breached window blocks the
 * request; otherwise the tightest remaining budget is returned (for headers).
 */
export async function rateLimit(key: string, rules: RateLimitRule[]): Promise<RateLimitResult> {
  const now = Date.now();
  const upstashResults = await upstashCheckBatch(key, rules);
  let tightest: RateLimitResult | null = null;

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const result = upstashResults[i] ?? memoryCheck(`${key}:${rule.windowSeconds}`, rule, now);
    if (!result.ok) return result;
    if (!tightest || result.remaining < tightest.remaining) tightest = result;
  }

  return tightest ?? { ok: true, remaining: 0, limit: 0, retryAfterSeconds: 0 };
}

/** Derive a stable client identifier from proxy headers (Vercel sets these). */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = (forwarded ? forwarded.split(",")[0] : req.headers.get("x-real-ip"))?.trim();
  return ip || "local";
}

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Per-request-type limits, env-tunable. Defaults are sized for a free anonymous
 * tier: generous enough that a multi-page document (one OCR call per page) is
 * not normally blocked, tight enough to cap a scripted abuser. A very large
 * document can still hit the per-minute cap — raise OCR_RATELIMIT_PER_MIN or run
 * self-hosted with your own key.
 */
export function ocrRules(): RateLimitRule[] {
  return [
    { limit: readIntEnv("OCR_RATELIMIT_PER_MIN", 60), windowSeconds: 60 },
    { limit: readIntEnv("OCR_RATELIMIT_PER_DAY", 600), windowSeconds: 86_400 },
  ];
}

export function chatRules(): RateLimitRule[] {
  return [
    { limit: readIntEnv("AI_RATELIMIT_PER_MIN", 20), windowSeconds: 60 },
    { limit: readIntEnv("AI_RATELIMIT_PER_DAY", 300), windowSeconds: 86_400 },
  ];
}

/**
 * Adobe PDF Services bills per document conversion, not per page/request like
 * OCR — so this budget is intentionally much tighter. A real person converting
 * documents by hand rarely submits more than one or two a minute; the daily
 * cap bounds worst-case exposure from a single anonymous client.
 */
export function adobeRules(): RateLimitRule[] {
  return [
    { limit: readIntEnv("ADOBE_RATELIMIT_PER_MIN", 3), windowSeconds: 60 },
    { limit: readIntEnv("ADOBE_RATELIMIT_PER_DAY", 15), windowSeconds: 86_400 },
  ];
}
