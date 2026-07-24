import { NextResponse } from "next/server";
import { runJopdfTask } from "../jopdfRunner";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 50 * 1024 * 1024;

function getJOPDFMode(format: string): string {
  if (format === "docx" || format === "doc") return "pdf2word";
  if (format === "xlsx" || format === "xls") return "pdf2office";
  if (format === "pptx" || format === "ppt") return "pdf2ppt";
  if (format === "jpg" || format === "png") return "pdf2image";
  return "pdf2word";
}

function getJOPDFOptionsString(format: string): string {
  if (format === "xlsx" || format === "xls") return "format=excel;";
  return `format=${format};`;
}

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

    const jopdfMode = getJOPDFMode(format);
    const jopdfOptions = getJOPDFOptionsString(format);

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
