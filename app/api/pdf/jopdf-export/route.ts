import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";

const execAsync = promisify(exec);

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const SECRET = "6SxpFwYHcPrvdEvH8TGr";
const JAVA_EXE = `"C:\\Users\\jeein\\AppData\\Roaming\\JOPDF\\tools\\pdf_tool\\jdk-17_x64\\bin\\java.exe"`;
const CLASSPATH = `"C:\\Users\\jeein\\AppData\\Roaming\\JOPDF\\tools\\pdf_tool\\*;"`;

function getSignString(outputPath: string): string {
  const hash = crypto.createHash('md5');
  hash.update(SECRET + outputPath + SECRET);
  return hash.digest('hex');
}

function getJOPDFMode(format: string): string {
  if (format === "docx" || format === "doc") return "pdf2word";
  if (format === "xlsx" || format === "xls") return "pdf2office"; // For Excel, pdf2office handles it
  if (format === "pptx" || format === "ppt") return "pdf2ppt";
  if (format === "jpg" || format === "png") return "pdf2image";
  return "pdf2word"; // Default
}

function getJOPDFOptionsString(format: string): string {
  if (format === "xlsx" || format === "xls") return "format=excel;";
  return `format=${format};`;
}

export async function POST(request: Request) {
  let tmpInputPath = "";
  let tmpOutputPath = "";

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const format = formData.get("format") as string || "docx";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload a valid file to convert." }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File must be 50MB or smaller." }, { status: 413 });
    }

    const tmpDir = os.tmpdir();
    const uniquePrefix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    
    tmpInputPath = path.join(tmpDir, `${uniquePrefix}_input.pdf`);
    tmpOutputPath = path.join(tmpDir, `${uniquePrefix}_output.${format}`);

    // Write file to disk
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(tmpInputPath, Buffer.from(arrayBuffer));

    // Base64 encode paths
    const b64Input = Buffer.from(tmpInputPath).toString("base64");
    const b64Output = Buffer.from(tmpOutputPath).toString("base64");

    // Generate Signature
    const sign = getSignString(b64Output);
    
    const jopdfMode = getJOPDFMode(format);
    const jopdfOptions = getJOPDFOptionsString(format);

    // Run JOPDF backend
    const cmd = `${JAVA_EXE} -cp ${CLASSPATH} Main -convert ${jopdfMode} -options "${jopdfOptions}" -i ${b64Input} -o ${b64Output} -sign ${sign}`;
    
    const { stdout, stderr } = await execAsync(cmd);
    
    if (!stdout.includes("isOK: true")) {
      console.error(stdout, stderr);
      throw new Error(`JOPDF local extraction failed: ${stderr || stdout}`);
    }

    // Read the output file
    const outputBuffer = await fs.readFile(tmpOutputPath);

    // Return the converted file
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
  } finally {
    // Cleanup temp files
    if (tmpInputPath) await fs.unlink(tmpInputPath).catch(() => {});
    if (tmpOutputPath) await fs.unlink(tmpOutputPath).catch(() => {});
  }
}
