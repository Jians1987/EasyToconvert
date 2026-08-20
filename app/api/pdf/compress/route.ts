import { NextResponse } from "next/server";
import { PDFDocument, PDFName, PDFRawStream, PDFArray } from "pdf-lib";
import sharp from "sharp";
import { rateLimit, clientKey, compressRules } from "@/app/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 50 * 1024 * 1024;

/**
 * Compression presets. The real savings on scanned / photo-heavy PDFs come from
 * re-encoding embedded JPEGs, not from re-packing the object table — so each
 * level maps to a JPEG quality and an optional longest-edge pixel cap
 * (downsampling). "low" only re-encodes quality (near-lossless); "high"
 * downsamples aggressively.
 */
const LEVELS = {
  low: { quality: 82, maxEdge: 0 }, // 0 = no downsample
  medium: { quality: 65, maxEdge: 2000 },
  high: { quality: 50, maxEdge: 1500 },
} as const;

type Level = keyof typeof LEVELS;

function parseLevel(value: FormDataEntryValue | null): Level {
  return value === "low" || value === "high" ? value : "medium";
}

/** Structured log line — never the filename or content, only sizes/outcome. */
function logCompress(entry: {
  outcome: "success" | "rate_limited" | "noop" | "failure";
  level?: Level;
  originalBytes?: number;
  compressedBytes?: number;
  imagesReencoded?: number;
  imagesSeen?: number;
  latencyMs?: number;
  error?: string;
}) {
  const line = JSON.stringify({ event: "pdf_compress_request", ...entry });
  if (entry.outcome === "failure") console.error(line);
  else console.log(line);
}

/**
 * Re-encode every DCTDecode (JPEG) image XObject in the document with sharp.
 * Returns how many images were actually replaced.
 *
 * Deliberately conservative: only single-filter DCTDecode streams are touched
 * (never FlateDecode raw pixels, JPXDecode/JPEG2000, or multi-filter chains),
 * and a per-image guard keeps the original bytes whenever sharp fails or the
 * re-encoded result isn't smaller. Worst case for any image is "left as-is" —
 * never corruption, never a larger image.
 */
async function reencodeImages(
  pdfDoc: PDFDocument,
  level: Level
): Promise<{ reencoded: number; seen: number }> {
  const { quality, maxEdge } = LEVELS[level];
  let reencoded = 0;
  let seen = 0;

  const indirectObjects = pdfDoc.context.enumerateIndirectObjects();
  for (const [ref, obj] of indirectObjects) {
    if (!(obj instanceof PDFRawStream)) continue;

    const dict = obj.dict;
    const subtype = dict.get(PDFName.of("Subtype"));
    if (subtype !== PDFName.of("Image")) continue;

    const filter = dict.get(PDFName.of("Filter"));
    // Only plain single-filter JPEG. An array filter means a chain we don't
    // want to rewrite; anything but DCTDecode is not a baseline JPEG.
    if (filter instanceof PDFArray) continue;
    if (filter !== PDFName.of("DCTDecode")) continue;

    seen++;
    const original = obj.contents; // raw JPEG bytes

    try {
      let pipeline = sharp(Buffer.from(original), { failOn: "none" });
      const meta = await pipeline.metadata();

      // CMYK JPEGs re-encode to different colour without a matching PDF
      // /ColorSpace update — skip to avoid colour shifts.
      if (meta.space === "cmyk") continue;

      const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
      let targetW = meta.width ?? 0;
      let targetH = meta.height ?? 0;
      if (maxEdge > 0 && longest > maxEdge) {
        const scale = maxEdge / longest;
        targetW = Math.max(1, Math.round((meta.width ?? 0) * scale));
        targetH = Math.max(1, Math.round((meta.height ?? 0) * scale));
        pipeline = pipeline.resize(targetW, targetH, { fit: "fill" });
      }

      const reencodedBytes = await pipeline
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();

      // Never replace with something equal or larger — the point is to shrink.
      if (reencodedBytes.length >= original.length) continue;

      const newStream = PDFRawStream.of(dict, new Uint8Array(reencodedBytes));
      const newDict = newStream.dict;
      newDict.set(PDFName.of("Length"), pdfDoc.context.obj(reencodedBytes.length));
      // If we downsampled, the stored pixel dimensions must follow.
      newDict.set(PDFName.of("Width"), pdfDoc.context.obj(targetW));
      newDict.set(PDFName.of("Height"), pdfDoc.context.obj(targetH));
      pdfDoc.context.assign(ref, newStream);
      reencoded++;
    } catch {
      // Undecodable / unexpected shape — leave this image untouched.
      continue;
    }
  }

  return { reencoded, seen };
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    // CPU-bound work on the server — gate it before reading the body.
    const verdict = await rateLimit(clientKey(request), compressRules());
    if (!verdict.ok) {
      logCompress({ outcome: "rate_limited" });
      const kind = verdict.limitKind ?? "custom";
      const humanWindow =
        kind === "daily" ? "tomorrow" : kind === "hourly" ? "in an hour" : `in about ${verdict.retryAfterSeconds}s`;
      return NextResponse.json(
        {
          code: "RATE_LIMITED",
          limit: kind,
          retryAfterSeconds: verdict.retryAfterSeconds,
          error: `Compression limit reached — try again ${humanWindow}. Run self-hosted for unlimited use.`,
        },
        { status: 429, headers: { "Retry-After": String(verdict.retryAfterSeconds) } }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const level = parseLevel(formData.get("level"));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload a valid file to compress." }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File must be 50MB or smaller." }, { status: 413 });
    }

    const inputBuffer = await file.arrayBuffer();
    const originalBytes = inputBuffer.byteLength;
    const pdfDoc = await PDFDocument.load(inputBuffer, { ignoreEncryption: true });

    const { reencoded, seen } = await reencodeImages(pdfDoc, level);

    // Object streams re-pack the cross-reference table — a few % on their own,
    // and the only lever for text-only PDFs where there are no images to shrink.
    const outputBytes = await pdfDoc.save({ useObjectStreams: true });

    // Never hand back a file bigger than what came in. pdf-lib's re-save can
    // occasionally inflate an already-optimised PDF; return the original bytes
    // in that case so "Compress" never makes a file worse.
    const grewOrTied = outputBytes.byteLength >= originalBytes;
    const finalBytes = grewOrTied ? new Uint8Array(inputBuffer) : outputBytes;

    logCompress({
      outcome: grewOrTied && reencoded === 0 ? "noop" : "success",
      level,
      originalBytes,
      compressedBytes: finalBytes.byteLength,
      imagesReencoded: reencoded,
      imagesSeen: seen,
      latencyMs: Date.now() - startedAt,
    });

    return new Response(Buffer.from(finalBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="compressed_${file.name}"`,
        "Cache-Control": "no-store",
        // Let the UI report the real reduction instead of guessing.
        "X-Original-Size": String(originalBytes),
        "X-Compressed-Size": String(finalBytes.byteLength),
        "X-Images-Reencoded": String(reencoded),
      },
    });
  } catch (error) {
    console.error("Compression error:", error);
    logCompress({ outcome: "failure", error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "PDF compression failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
