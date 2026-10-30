import { NextResponse } from "next/server";
import sharp from "sharp";
import { apiError, authenticate, isFile, preflight, readForm } from "@/app/lib/server/apiAuth";

export const runtime = "nodejs";

const FORMATS = ["jpeg", "png", "webp", "avif"] as const;
type Format = (typeof FORMATS)[number];
const EXTENSIONS: Record<Format, string> = { jpeg: "jpg", png: "png", webp: "webp", avif: "avif" };
const MAX_PIXELS = 50_000_000; // guards against decompression bombs

function encode(image: sharp.Sharp, format: Format, quality: number) {
  switch (format) {
    case "jpeg": return image.jpeg({ quality, mozjpeg: true });
    case "png": return image.png({ quality, compressionLevel: 9, palette: quality < 100 });
    case "webp": return image.webp({ quality });
    case "avif": return image.avif({ quality });
  }
}

const baseName = (name: string) => (name.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_").slice(0, 100) || "image");

export async function POST(req: Request) {
  const auth = authenticate(req);
  if ("error" in auth) return auth.error;
  const form = await readForm(req, auth.headers);
  if (form instanceof NextResponse) return form;

  const file = form.get("file");
  if (!isFile(file) || file.size === 0) {
    return apiError(400, "invalid_request", "Attach an image in the 'file' field.", auth.headers);
  }

  const qualityField = form.get("quality");
  const quality = qualityField === null || qualityField === "" ? 80 : Number(qualityField);
  if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
    return apiError(400, "invalid_request", "'quality' must be a whole number from 1 to 100.", auth.headers);
  }

  const formatField = String(form.get("format") ?? "original").toLowerCase().replace("jpg", "jpeg");
  if (formatField !== "original" && !FORMATS.includes(formatField as Format)) {
    return apiError(400, "invalid_request", "'format' must be one of: original, jpeg, png, webp, avif.", auth.headers);
  }

  const input = Buffer.from(await file.arrayBuffer());
  let source: Format;
  try {
    const meta = await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata();
    const detected = meta.format === "heif" && meta.compression === "av1" ? "avif" : meta.format;
    if (!FORMATS.includes(detected as Format)) throw new Error("unsupported");
    source = detected as Format;
  } catch {
    return apiError(415, "unsupported_media_type", "The file must be a PNG, JPEG, WebP or AVIF image.", auth.headers);
  }

  const target = formatField === "original" ? source : (formatField as Format);
  let output: Buffer;
  try {
    // rotate() applies EXIF orientation; metadata (EXIF, GPS) is stripped by default.
    output = await encode(sharp(input, { limitInputPixels: MAX_PIXELS }).rotate(), target, quality).toBuffer();
  } catch {
    return apiError(422, "unprocessable", "The image could not be processed. It may be corrupt or too large.", auth.headers);
  }
  // Never hand back a bigger file than the one we were given in the same format.
  const keptOriginal = target === source && output.length >= input.length;
  if (keptOriginal) output = input;

  return new NextResponse(new Uint8Array(output), {
    headers: {
      ...auth.headers,
      "Content-Type": `image/${target}`,
      "Content-Disposition": `attachment; filename="${baseName(file.name)}.${EXTENSIONS[target]}"`,
      "X-Original-Size": String(input.length),
      "X-Output-Size": String(output.length),
      ...(keptOriginal ? { "X-Compression": "original-kept" } : {}),
    },
  });
}

export const OPTIONS = preflight;
