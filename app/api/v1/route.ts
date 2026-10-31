import { NextResponse } from "next/server";
import { CORS_HEADERS, preflight, REQUESTS_PER_MINUTE, MAX_BODY_BYTES } from "@/app/lib/server/apiAuth";

// Public index: lets clients discover endpoints and check the API is up.
export function GET() {
  return NextResponse.json(
    {
      name: "EasyToConvert API",
      version: "v1",
      docs: "https://www.easytoconvert.in/api-docs",
      authentication: "Authorization: Bearer <api key>",
      limits: { requests_per_minute: REQUESTS_PER_MINUTE, max_body_bytes: MAX_BODY_BYTES },
      endpoints: [
        { method: "POST", path: "/api/v1/keys", description: "Issue a new API key." },
        { method: "POST", path: "/api/v1/image/compress", description: "Compress or convert a PNG, JPEG, WebP or AVIF image." },
        { method: "POST", path: "/api/v1/pdf/merge", description: "Merge 2–20 PDF files into one." },
        { method: "POST", path: "/api/v1/data/csv-to-json", description: "Convert CSV with a header row to JSON." },
      ],
    },
    { headers: CORS_HEADERS },
  );
}

export const OPTIONS = preflight;
