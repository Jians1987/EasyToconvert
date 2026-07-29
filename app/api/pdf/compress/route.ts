import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 50 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload a valid file to compress." }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File must be 50MB or smaller." }, { status: 413 });
    }

    const inputBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(inputBuffer, { ignoreEncryption: true });

    // Re-save with object streams enabled for maximum size optimization
    const outputBytes = await pdfDoc.save({ useObjectStreams: true });

    return new Response(Buffer.from(outputBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="compressed_${file.name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Compression error:", error);
    const message = error instanceof Error ? error.message : "PDF compression failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
