import { NextResponse } from "next/server";
import { apiError, authenticate, isFile, MAX_BODY_BYTES, preflight } from "@/app/lib/server/apiAuth";
import { csvToObjects } from "@/app/lib/csv";

export const runtime = "nodejs";

// Accepts the CSV as JSON {"csv_data": "..."}, a raw text/csv body, or
// multipart form data with a csv_data field or a file field.
async function readCsv(req: Request): Promise<string | null> {
  const type = (req.headers.get("content-type") || "").toLowerCase();
  if (type.includes("application/json")) {
    const body = await req.json().catch(() => null);
    return typeof body?.csv_data === "string" ? body.csv_data : null;
  }
  if (type.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    const value = form?.get("csv_data") ?? form?.get("file") ?? null;
    if (typeof value === "string") return value;
    return isFile(value) ? value.text() : null;
  }
  if (type.includes("text/csv") || type.includes("text/plain")) return req.text();
  return null;
}

export async function POST(req: Request) {
  const auth = authenticate(req);
  if ("error" in auth) return auth.error;

  const csv = await readCsv(req);
  if (csv === null) {
    return apiError(400, "invalid_request", "Send CSV as JSON {\"csv_data\": \"...\"}, a text/csv body, or a multipart csv_data/file field.", auth.headers);
  }
  if (csv.length > MAX_BODY_BYTES) {
    return apiError(413, "payload_too_large", `CSV must be ${MAX_BODY_BYTES / 1024 / 1024} MB or smaller.`, auth.headers);
  }
  try {
    const data = csvToObjects(csv);
    return NextResponse.json({ rows: data.length, columns: Object.keys(data[0]), data }, { headers: auth.headers });
  } catch (e) {
    return apiError(422, "unprocessable", (e as Error).message, auth.headers);
  }
}

export const OPTIONS = preflight;
