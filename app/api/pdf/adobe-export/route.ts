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

export const runtime = "nodejs";
export const maxDuration = 60;

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
  try {
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
    return NextResponse.json({ error: message }, { status });
  }
}
