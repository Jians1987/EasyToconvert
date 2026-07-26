import { NextResponse } from "next/server";
import { runJopdfTask } from "../jopdfRunner";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 50 * 1024 * 1024;

// Allowlist of conversion modes → fixed JOPDF mode, options, and the input
// extension to hand the runner. The input extension is chosen from this table
// rather than derived from the uploaded filename, so no user-controlled string
// can flow into the temp file path the runner constructs.
const MODE_CONFIG: Record<string, { mode: string; options: string; inputExt: string }> = {
  "word-to-pdf": { mode: "word2pdf", options: "format=docx;", inputExt: "docx" },
  "excel-to-pdf": { mode: "excel2pdf", options: "format=excel;", inputExt: "xlsx" },
  "ppt-to-pdf": { mode: "ppt2pdf", options: "format=pptx;", inputExt: "pptx" },
};

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

    const config = MODE_CONFIG[mode];
    if (!config) {
      return NextResponse.json(
        { error: `Unsupported conversion mode. Allowed: ${Object.keys(MODE_CONFIG).join(", ")}.` },
        { status: 400 }
      );
    }

    const outputBuffer = await runJopdfTask({
      file,
      inputExt: config.inputExt,
      outputExt: "pdf",
      jopdfMode: config.mode,
      jopdfOptions: config.options,
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
