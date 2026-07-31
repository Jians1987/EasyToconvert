// Best-effort rate limiting for the paid API routes (OCR + chat).
//
// Two backends, chosen at call time:
//   1. Upstash Redis REST  (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
//      Shared across every serverless instance — the ONLY backend that actually
//      limits abuse on Vercel, where each invocation may be a fresh process.
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

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  limit: number;
  /** Seconds until the (breached) window resets — used for Retry-After. */
  retryAfterSeconds: number;
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
  };
}

/**
 * Fixed-window counter in Upstash via INCR + EXPIRE. Coarser than a sliding
 * window, but shared across instances, which is the property that matters.
 * Returns null when Upstash isn't configured or is unreachable (→ fall back).
 */
async function upstashCheck(key: string, rule: RateLimitRule): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const bucket = Math.floor(Date.now() / 1000 / rule.windowSeconds);
  const redisKey = `rl:${key}:${rule.windowSeconds}:${bucket}`;
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, rule.windowSeconds],
      ]),
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const count = Number(data?.[0]?.result ?? 0);
    if (!Number.isFinite(count) || count <= 0) return null;
    return {
      ok: count <= rule.limit,
      remaining: Math.max(0, rule.limit - count),
      limit: rule.limit,
      retryAfterSeconds: count <= rule.limit ? 0 : rule.windowSeconds,
    };
  } catch {
    return null; // network/timeout → fail over to in-memory
  }
}

/**
 * Check every rule for a client key. The first breached window blocks the
 * request; otherwise the tightest remaining budget is returned (for headers).
 */
export async function rateLimit(key: string, rules: RateLimitRule[]): Promise<RateLimitResult> {
  const now = Date.now();
  let tightest: RateLimitResult | null = null;

  for (const rule of rules) {
    const viaUpstash = await upstashCheck(key, rule);
    const result = viaUpstash ?? memoryCheck(`${key}:${rule.windowSeconds}`, rule, now);
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
