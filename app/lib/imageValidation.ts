/**
 * Provider-independent image validation gate.
 *
 * Runs before any OCR provider sees the image, so pathological inputs
 * (1×1 pixel crops, corrupt bytes, empty uploads) are rejected with a
 * clear 400 rather than reaching cloud APIs that may hallucinate
 * plausible-looking output in response to garbage input.
 *
 * Observed case (2026-07-31, Mistral on a 1×1 px PNG): API returned HTTP
 * 200 with a 19-row financial table that had nothing to do with the input.
 * The validation gate closes this by rejecting below MIN_IMAGE_DIMENSION.
 *
 * Parses PNG IHDR and JPEG SOF markers directly from decoded bytes —
 * no external dependencies, no canvas, no sharp.
 */

export interface ImageValidationResult {
  valid: boolean;
  /** Raw byte length of the image (after base64 decoding). */
  fileBytes?: number;
  width?: number;
  height?: number;
  format?: "png" | "jpeg";
  /** Human-readable rejection reason; absent when valid === true. */
  reason?: string;
}

/**
 * Minimum acceptable dimension on either axis. 32×32 is large enough to
 * reject obviously-garbage crops while comfortably accepting the smallest
 * real document content (stamps, logos, single-cell table crops).
 */
export const MIN_IMAGE_DIMENSION = 32;

/**
 * Validate a raw base64-encoded image. Accepts an optional data-URI prefix
 * ("data:image/png;base64,…") — it is stripped before decoding.
 */
export function validateImageBase64(base64: string): ImageValidationResult {
  if (!base64 || base64.length === 0) {
    return { valid: false, reason: "Image data is empty" };
  }

  const raw = base64.includes(",") ? base64.split(",")[1] : base64;

  let buf: Buffer;
  try {
    buf = Buffer.from(raw, "base64");
  } catch {
    return { valid: false, reason: "Image data could not be decoded from base64" };
  }

  if (buf.length === 0) {
    return { valid: false, reason: "Image is empty (zero bytes after decoding)" };
  }

  const fileBytes = buf.length;

  // ── PNG ────────────────────────────────────────────────────────────────────
  // Signature (8 bytes) followed by IHDR chunk: 4-byte length, 4-byte type,
  // then 13 bytes of IHDR data where width lives at offset 16 and height at 20.
  const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length >= 24 && PNG_SIG.every((b, i) => buf[i] === b)) {
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
      return {
        valid: false,
        fileBytes,
        width,
        height,
        format: "png",
        reason: `Image is too small (${width}×${height} px); minimum is ${MIN_IMAGE_DIMENSION}×${MIN_IMAGE_DIMENSION}`,
      };
    }
    return { valid: true, fileBytes, width, height, format: "png" };
  }

  // ── JPEG ───────────────────────────────────────────────────────────────────
  // SOI marker (ff d8) at the start. Scan for SOF0 (ff c0), SOF1 (ff c1), or
  // SOF2 (ff c2) markers — each carries precision(1), height(2), width(2) at
  // offsets 3 and 5 from the marker start. Inside JPEG entropy-coded data any
  // 0xff byte is stuffed (0xff 0x00) or is a real marker, so scanning for
  // 0xff c0..c2 is reliable across the full buffer.
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) {
    for (let i = 2; i < buf.length - 9; i++) {
      if (buf[i] === 0xff) {
        const m = buf[i + 1];
        if (m === 0xc0 || m === 0xc1 || m === 0xc2) {
          const height = buf.readUInt16BE(i + 5);
          const width = buf.readUInt16BE(i + 7);
          if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
            return {
              valid: false,
              fileBytes,
              width,
              height,
              format: "jpeg",
              reason: `Image is too small (${width}×${height} px); minimum is ${MIN_IMAGE_DIMENSION}×${MIN_IMAGE_DIMENSION}`,
            };
          }
          return { valid: true, fileBytes, width, height, format: "jpeg" };
        }
      }
    }
    // SOI found but no SOF marker — truncated or exotic JPEG. Accept without
    // dimension check rather than falsely rejecting a real (if odd) image.
    return { valid: true, fileBytes, format: "jpeg" };
  }

  // ── Unknown format ─────────────────────────────────────────────────────────
  return {
    valid: false,
    fileBytes,
    reason: "Image format is not recognised (expected PNG or JPEG)",
  };
}
