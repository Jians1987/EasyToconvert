import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import {
  ExportOCRLocale,
  ExportPDFJob,
  ExportPDFParams,
  ExportPDFResult,
  ExportPDFTargetFormat,
  MimeType,
  PDFServices,
  ServicePrincipalCredentials,
} from "@adobe/pdfservices-node-sdk";
import { rateLimit, clientKey, adobeRules } from "@/app/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Operational log line for a billed Adobe conversion. Never include the
 *  filename, file content, or credentials — only what happened and how long
 *  it took, so real usage can be correlated against the Adobe invoice. */
function logAdobeExport(entry: {
  outcome: "success" | "rate_limited" | "failure";
  fileSizeBytes?: number;
  latencyMs?: number;
  error?: string;
}) {
  const line = JSON.stringify({ event: "adobe_export_request", ...entry });
  if (entry.outcome === "failure") console.error(line);
  else console.log(line);
}

const MAX_PDF_BYTES = 50 * 1024 * 1024;

function getAdobeCredentials() {
  const clientId = process.env.PDF_SERVICES_CLIENT_ID || process.env.ADOBE_PDF_SERVICES_CLIENT_ID;
  const clientSecret = process.env.PDF_SERVICES_CLIENT_SECRET || process.env.ADOBE_PDF_SERVICES_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Adobe PDF Services credentials are not configured.");
  }

  return new ServicePrincipalCredentials({ clientId, clientSecret });
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function parseOcrLocale(value: FormDataEntryValue | null): ExportOCRLocale {
  const requested = typeof value === "string" ? value : "";
  return Object.values(ExportOCRLocale).includes(requested as ExportOCRLocale)
    ? (requested as ExportOCRLocale)
    : ExportOCRLocale.EN_US;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    // Checked before touching the body or Adobe at all — this is the only
    // billed-per-document endpoint in the app, so a blocked request should
    // cost nothing.
    const verdict = await rateLimit(clientKey(request), adobeRules());
    if (!verdict.ok) {
      logAdobeExport({ outcome: "rate_limited" });
      return NextResponse.json(
        {
          error: `Rate limit reached for Adobe High Quality conversion — try again in about ${verdict.retryAfterSeconds}s. Switch to the In Browser engine for unlimited conversions, or run self-hosted with your own Adobe key.`,
        },
        { status: 429, headers: { "Retry-After": String(verdict.retryAfterSeconds) } }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload a PDF file to convert." }, { status: 400 });
    }

    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "PDF must be 50MB or smaller." }, { status: 413 });
    }

    const credentials = getAdobeCredentials();
    const pdfServices = new PDFServices({ credentials });
    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const inputAsset = await pdfServices.upload({
      readStream: Readable.from(inputBuffer),
      mimeType: MimeType.PDF,
    });

    const params = new ExportPDFParams({
      targetFormat: ExportPDFTargetFormat.DOCX,
      ocrLocale: parseOcrLocale(formData.get("ocrLocale")),
    });
    const job = new ExportPDFJob({ inputAsset, params });
    const pollingURL = await pdfServices.submit({ job });
    const response = await pdfServices.getJobResult({
      pollingURL,
      resultType: ExportPDFResult,
    });
    if (!response.result) {
      throw new Error("Adobe PDF Services did not return a converted document.");
    }
    const streamAsset = await pdfServices.getContent({ asset: response.result.asset });
    const outputBuffer = await streamToBuffer(streamAsset.readStream);

    logAdobeExport({ outcome: "success", fileSizeBytes: file.size, latencyMs: Date.now() - startedAt });

    return new Response(new Uint8Array(outputBuffer), {
      headers: {
        "Content-Type": MimeType.DOCX,
        "Content-Disposition": `attachment; filename="${file.name.replace(/\.pdf$/i, "") || "document"}.docx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Adobe PDF conversion failed.";
    const status = message.includes("credentials") ? 503 : 502;
    logAdobeExport({ outcome: "failure", latencyMs: Date.now() - startedAt, error: message.slice(0, 300) });
    return NextResponse.json({ error: message }, { status });
  }
}
