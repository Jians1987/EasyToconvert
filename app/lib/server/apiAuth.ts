// Authentication, rate limiting and error helpers for the public /api/v1 API.
//
// API keys are stateless signed tokens: `etc_<id><signature>` where the
// signature is an HMAC of the id under API_KEY_SECRET. The server can verify a
// key without a database; a leaked key is revoked by adding its id (or the full
// key) to API_KEY_REVOKED (comma-separated).
//
// Rate limits are kept in memory per server instance — a best-effort guard
// against abuse, not a billing-grade quota.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

const PREFIX = "etc_";
const ID_LENGTH = 24; // hex chars
const SIG_LENGTH = 32; // hex chars
const KEY_PATTERN = new RegExp(`^${PREFIX}([0-9a-f]{${ID_LENGTH}})([0-9a-f]{${SIG_LENGTH}})$`);

export const REQUESTS_PER_MINUTE = Number(process.env.API_RATE_LIMIT_PER_MINUTE) || 60;
export const KEYS_PER_HOUR_PER_IP = Number(process.env.API_KEY_ISSUE_LIMIT_PER_HOUR) || 10;
// Vercel rejects request bodies over 4.5 MB before they reach the function.
export const MAX_BODY_BYTES = 4 * 1024 * 1024;

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Expose-Headers":
    "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Original-Size, X-Output-Size, X-Compression, X-Page-Count, Content-Disposition",
};

export type ErrorCode =
  | "api_not_configured"
  | "missing_api_key"
  | "invalid_api_key"
  | "rate_limited"
  | "payload_too_large"
  | "invalid_request"
  | "unsupported_media_type"
  | "unprocessable"
  | "internal_error";

export function apiError(status: number, code: ErrorCode, message: string, headers: Record<string, string> = {}) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { ...CORS_HEADERS, ...headers } });
}

export function preflight() {
  return new NextResponse(null, { status: 204, headers: { ...CORS_HEADERS, "Access-Control-Max-Age": "86400" } });
}

function secret(): string | null {
  const value = process.env.API_KEY_SECRET;
  return value && value.length >= 32 ? value : null;
}

const sign = (key: string, id: string) => createHmac("sha256", key).update(id).digest("hex").slice(0, SIG_LENGTH);

export function issueKey(): string | null {
  const key = secret();
  if (!key) return null;
  const id = randomBytes(ID_LENGTH / 2).toString("hex");
  return `${PREFIX}${id}${sign(key, id)}`;
}

function verifyKey(token: string): string | null {
  const key = secret();
  const match = key && KEY_PATTERN.exec(token);
  if (!key || !match) return null;
  const [, id, sig] = match;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(sign(key, id)))) return null;
  const revoked = (process.env.API_KEY_REVOKED || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (revoked.some((r) => r === id || r === token)) return null;
  return id;
}

// ─── Fixed-window rate limiter ───────────────────────────────────────────────

const windows = new Map<string, { count: number; resetAt: number }>();

function hit(bucket: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (windows.size > 10_000) {
    windows.forEach((w, k) => { if (w.resetAt <= now) windows.delete(k); });
  }
  let w = windows.get(bucket);
  if (!w || w.resetAt <= now) {
    w = { count: 0, resetAt: now + windowMs };
    windows.set(bucket, w);
  }
  w.count++;
  const headers = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, limit - w.count)),
    "X-RateLimit-Reset": String(Math.ceil(w.resetAt / 1000)),
  };
  return { allowed: w.count <= limit, headers, retryAfter: Math.ceil((w.resetAt - now) / 1000) };
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

export function limitKeyIssuance(req: Request) {
  const result = hit(`issue:${clientIp(req)}`, KEYS_PER_HOUR_PER_IP, 60 * 60 * 1000);
  if (result.allowed) return null;
  return apiError(429, "rate_limited", "Too many API keys requested from this network. Try again later.", {
    ...result.headers,
    "Retry-After": String(result.retryAfter),
  });
}

/**
 * Validates the Bearer key and applies the per-key rate limit.
 * Returns either an error response, or the headers to attach to the success response.
 */
export function authenticate(req: Request): { error: NextResponse } | { headers: Record<string, string> } {
  if (!secret()) {
    return { error: apiError(503, "api_not_configured", "The API is not configured on this server.") };
  }
  const header = req.headers.get("authorization") || "";
  const token = /^Bearer\s+(\S+)$/i.exec(header)?.[1];
  if (!token) {
    return { error: apiError(401, "missing_api_key", "Send your API key as 'Authorization: Bearer <key>'. Create one at /dashboard.") };
  }
  const id = verifyKey(token);
  if (!id) return { error: apiError(401, "invalid_api_key", "This API key is invalid or has been revoked.") };

  const result = hit(`key:${id}`, REQUESTS_PER_MINUTE, 60 * 1000);
  if (!result.allowed) {
    return {
      error: apiError(429, "rate_limited", `Rate limit of ${REQUESTS_PER_MINUTE} requests per minute exceeded.`, {
        ...result.headers,
        "Retry-After": String(result.retryAfter),
      }),
    };
  }
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return { error: apiError(413, "payload_too_large", `Request body must be ${MAX_BODY_BYTES / 1024 / 1024} MB or smaller.`, result.headers) };
  }
  return { headers: { ...CORS_HEADERS, ...result.headers } };
}

/** Reads a multipart body, turning malformed input into a 400 instead of a 500. */
export async function readForm(req: Request, headers: Record<string, string>): Promise<FormData | NextResponse> {
  const type = req.headers.get("content-type") || "";
  if (!type.includes("multipart/form-data")) {
    return apiError(415, "unsupported_media_type", "Send the request as multipart/form-data.", headers);
  }
  try {
    return await req.formData();
  } catch {
    return apiError(400, "invalid_request", "The multipart body could not be parsed.", headers);
  }
}

export const isFile = (value: FormDataEntryValue | null): value is File =>
  typeof value === "object" && value !== null && typeof (value as File).arrayBuffer === "function";
