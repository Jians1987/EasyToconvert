import { NextResponse } from "next/server";
import { runJopdfTask } from "../jopdfRunner";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 50 * 1024 * 1024;

function getJOPDFMode(mode: string): string {
  if (mode === "word-to-pdf") return "word2pdf";
  if (mode === "excel-to-pdf") return "excel2pdf";
  if (mode === "ppt-to-pdf") return "ppt2pdf";
  return "word2pdf";
}

function getJOPDFOptionsString(mode: string): string {
  if (mode === "word-to-pdf") return "format=docx;";
  if (mode === "excel-to-pdf") return "format=excel;";
  if (mode === "ppt-to-pdf") return "format=pptx;";
  return "format=docx;";
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const mode = (formData.get("mode") as string) || "word-to-pdf";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload a valid file to convert." }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File must be 50MB or smaller." }, { status: 413 });
    }

    const ext = file.name.split(".").pop() || "docx";
    const jopdfMode = getJOPDFMode(mode);
    const jopdfOptions = getJOPDFOptionsString(mode);

    const outputBuffer = await runJopdfTask({
      file,
      inputExt: ext,
      outputExt: "pdf",
      jopdfMode,
      jopdfOptions,
    });

    const outputFileName = `${file.name.replace(/\.[^/.]+$/, "")}.pdf`;

    return new Response(new Uint8Array(outputBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${outputFileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Office to PDF error:", error);
    const message = error instanceof Error ? error.message : "JOPDF office to PDF conversion failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
