import { test, expect } from "@playwright/test";
import { validateImageBase64, MIN_IMAGE_DIMENSION } from "../app/lib/imageValidation";

// Build the first 24 bytes of a PNG (sufficient for the validator to extract
// width/height from IHDR). No valid CRC, IDAT, or IEND — the validator only
// reads the header bytes. Do not try to use these as real images.
function makePngHeader(width: number, height: number): Buffer {
  const buf = Buffer.alloc(24);
  // PNG signature (8 bytes)
  buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4e; buf[3] = 0x47;
  buf[4] = 0x0d; buf[5] = 0x0a; buf[6] = 0x1a; buf[7] = 0x0a;
  // IHDR chunk: 4-byte length, 4-byte "IHDR"
  buf.writeUInt32BE(13, 8);
  buf[12] = 0x49; buf[13] = 0x48; buf[14] = 0x44; buf[15] = 0x52;
  // Width at offset 16, height at offset 20
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

// Minimal JPEG with an SOF0 marker (ff c0) carrying the given dimensions.
// Encodes: SOI + APP0 stub + SOF0. No actual image data — validator only needs
// to find the SOF0 marker for dimensions.
function makeJpegWithDimensions(width: number, height: number): Buffer {
  // SOI
  const soi = Buffer.from([0xff, 0xd8]);
  // Minimal APP0 segment: marker(2) + length(2) + 5 bytes JFIF signature
  const app0Data = Buffer.from([0x4a, 0x46, 0x49, 0x46, 0x00]); // "JFIF\0"
  const app0Len = Buffer.alloc(2);
  app0Len.writeUInt16BE(2 + app0Data.length, 0);
  const app0 = Buffer.concat([Buffer.from([0xff, 0xe0]), app0Len, app0Data]);
  // SOF0: marker(2) + length(2) + precision(1) + height(2) + width(2) + ncomp(1)
  const sof0 = Buffer.alloc(11);
  sof0[0] = 0xff; sof0[1] = 0xc0;
  sof0.writeUInt16BE(11 - 2, 2); // length field = 9 (not counting the 2-byte marker)
  sof0[4] = 8; // precision
  sof0.writeUInt16BE(height, 5);
  sof0.writeUInt16BE(width, 7);
  sof0[9] = 3; // number of components
  return Buffer.concat([soi, app0, sof0]);
}

test.describe("validateImageBase64 — PNG", () => {
  test("rejects a 1×1 PNG", () => {
    const b64 = makePngHeader(1, 1).toString("base64");
    const result = validateImageBase64(b64);
    expect(result.valid).toBe(false);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(result.format).toBe("png");
    expect(result.reason).toMatch(/too small/i);
  });

  test(`rejects ${MIN_IMAGE_DIMENSION - 1}×${MIN_IMAGE_DIMENSION - 1} (just below minimum)`, () => {
    const b64 = makePngHeader(MIN_IMAGE_DIMENSION - 1, MIN_IMAGE_DIMENSION - 1).toString("base64");
    const result = validateImageBase64(b64);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/too small/i);
  });

  test(`accepts exactly ${MIN_IMAGE_DIMENSION}×${MIN_IMAGE_DIMENSION}`, () => {
    const b64 = makePngHeader(MIN_IMAGE_DIMENSION, MIN_IMAGE_DIMENSION).toString("base64");
    const result = validateImageBase64(b64);
    expect(result.valid).toBe(true);
    expect(result.width).toBe(MIN_IMAGE_DIMENSION);
    expect(result.height).toBe(MIN_IMAGE_DIMENSION);
    expect(result.format).toBe("png");
    expect(result.fileBytes).toBeGreaterThan(0);
  });

  test("accepts a normal document-sized PNG (A4 at 150 dpi)", () => {
    const b64 = makePngHeader(1240, 1754).toString("base64");
    const result = validateImageBase64(b64);
    expect(result.valid).toBe(true);
    expect(result.width).toBe(1240);
    expect(result.height).toBe(1754);
  });

  test("accepts a data-URI-prefixed base64 string", () => {
    const b64 = `data:image/png;base64,${makePngHeader(100, 100).toString("base64")}`;
    expect(validateImageBase64(b64).valid).toBe(true);
  });
});

test.describe("validateImageBase64 — JPEG", () => {
  test("rejects a 1×1 JPEG", () => {
    const b64 = makeJpegWithDimensions(1, 1).toString("base64");
    const result = validateImageBase64(b64);
    expect(result.valid).toBe(false);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(result.format).toBe("jpeg");
  });

  test("accepts a normal JPEG", () => {
    const b64 = makeJpegWithDimensions(800, 600).toString("base64");
    const result = validateImageBase64(b64);
    expect(result.valid).toBe(true);
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(result.format).toBe("jpeg");
  });
});

test.describe("validateImageBase64 — invalid input", () => {
  test("rejects empty string", () => {
    const result = validateImageBase64("");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/empty/i);
  });

  test("rejects zero-length decoded data", () => {
    const result = validateImageBase64(Buffer.alloc(0).toString("base64"));
    expect(result.valid).toBe(false);
  });

  test("rejects corrupted / non-image bytes", () => {
    const b64 = Buffer.from("this is definitely not an image").toString("base64");
    const result = validateImageBase64(b64);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/not recognised/i);
  });

  test("reports fileBytes on rejection (for logging)", () => {
    const b64 = makePngHeader(1, 1).toString("base64");
    const result = validateImageBase64(b64);
    expect(result.fileBytes).toBeGreaterThan(0);
  });
});

// Note on multi-page documents: each call to /api/ai receives one page at a
// time (the client renders PDF pages to images individually before sending).
// There is no multi-page variant of the API — validate one image per call.
