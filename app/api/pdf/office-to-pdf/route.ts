import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 50 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload a valid file to convert." }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File must be 50MB or smaller." }, { status: 413 });
    }

    return NextResponse.json(
      { error: "Direct Office-to-PDF conversion service is offline. Please use client-side or Adobe PDF Services." },
      { status: 501 }
    );
  } catch (error) {
    console.error("Office to PDF error:", error);
    const message = error instanceof Error ? error.message : "Office to PDF conversion failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
