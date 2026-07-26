import { NextResponse } from "next/server";
import { runJopdfTask } from "../jopdfRunner";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 50 * 1024 * 1024;

// Allowlist of accepted output formats → their JOPDF mode and options string.
// Both values are fixed literals here so no user input is ever interpolated
// into the shell command built by the runner.
const FORMAT_CONFIG: Record<string, { mode: string; options: string }> = {
  docx: { mode: "pdf2word", options: "format=docx;" },
  doc: { mode: "pdf2word", options: "format=doc;" },
  xlsx: { mode: "pdf2office", options: "format=excel;" },
  xls: { mode: "pdf2office", options: "format=excel;" },
  pptx: { mode: "pdf2ppt", options: "format=pptx;" },
  ppt: { mode: "pdf2ppt", options: "format=ppt;" },
  jpg: { mode: "pdf2image", options: "format=jpg;" },
  png: { mode: "pdf2image", options: "format=png;" },
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const format = (formData.get("format") as string) || "docx";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload a valid file to convert." }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File must be 50MB or smaller." }, { status: 413 });
    }

    const config = FORMAT_CONFIG[format];
    if (!config) {
      return NextResponse.json(
        { error: `Unsupported output format. Allowed: ${Object.keys(FORMAT_CONFIG).join(", ")}.` },
        { status: 400 }
      );
    }
    const { mode: jopdfMode, options: jopdfOptions } = config;

    const outputBuffer = await runJopdfTask({
      file,
      inputExt: "pdf",
      outputExt: format,
      jopdfMode,
      jopdfOptions,
    });

    let contentType = "application/octet-stream";
    if (format === "docx") contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (format === "xlsx") contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (format === "pptx") contentType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    if (format === "jpg") contentType = "image/jpeg";

    return new Response(new Uint8Array(outputBuffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="jopdf_converted.${format}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("JOPDF-export error:", error);
    const message = error instanceof Error ? error.message : "JOPDF PDF conversion failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
