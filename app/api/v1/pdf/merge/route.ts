import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { apiError, authenticate, isFile, preflight, readForm } from "@/app/lib/server/apiAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILES = 20;

export async function POST(req: Request) {
  const auth = authenticate(req);
  if ("error" in auth) return auth.error;
  const form = await readForm(req, auth.headers);
  if (form instanceof NextResponse) return form;

  const files = [...form.getAll("files"), ...form.getAll("files[]")].filter(isFile);
  if (files.length < 2 || files.length > MAX_FILES) {
    return apiError(400, "invalid_request", `Attach between 2 and ${MAX_FILES} PDFs, each in a 'files' field.`, auth.headers);
  }

  const merged = await PDFDocument.create();
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(bytes.subarray(0, 1024)).indexOf("%PDF-") === -1) {
      return apiError(415, "unsupported_media_type", `'${file.name}' is not a PDF file.`, auth.headers);
    }
    let doc: PDFDocument;
    try {
      doc = await PDFDocument.load(bytes);
    } catch (e) {
      const encrypted = (e as Error)?.name === "EncryptedPDFError" || /encrypt/i.test((e as Error)?.message ?? "");
      return apiError(422, "unprocessable", encrypted
        ? `'${file.name}' is password-protected. Remove the password and try again.`
        : `'${file.name}' could not be read. It may be corrupt.`, auth.headers);
    }
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }

  const output = await merged.save();
  return new NextResponse(new Uint8Array(output), {
    headers: {
      ...auth.headers,
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="merged.pdf"',
      "X-Page-Count": String(merged.getPageCount()),
    },
  });
}

export const OPTIONS = preflight;
