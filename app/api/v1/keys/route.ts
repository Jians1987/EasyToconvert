import { NextResponse } from "next/server";
import { apiError, CORS_HEADERS, issueKey, limitKeyIssuance, preflight } from "@/app/lib/server/apiAuth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const limited = limitKeyIssuance(req);
  if (limited) return limited;
  const key = issueKey();
  if (!key) return apiError(503, "api_not_configured", "The API is not configured on this server.");
  return NextResponse.json({ key, created_at: new Date().toISOString() }, { status: 201, headers: CORS_HEADERS });
}

export const OPTIONS = preflight;
