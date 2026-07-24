import { NextResponse } from "next/server";
import { runJopdfTask } from "../jopdfRunner";

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

    const outputBuffer = await runJopdfTask({
      file,
      inputExt: "pdf",
      outputExt: "pdf",
      jopdfMode: "compress",
      jopdfOptions: "level=high;",
    });

    return new Response(new Uint8Array(outputBuffer), {
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
