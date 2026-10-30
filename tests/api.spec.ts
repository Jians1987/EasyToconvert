import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { PDFDocument, StandardFonts } from "pdf-lib";

// The server must run with API_KEY_SECRET set (see playwright.config.ts).

// Uncompressed 64x64 PNG with a gradient pattern, so compression has something to do.
function noisyPng(): Promise<Buffer> {
  const w = 64, h = 64;
  const raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 7 + Math.floor(i / (w * 3)) * 13) % 256;
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
}

async function pdf(pages: number, label: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) doc.addPage([300, 400]).drawText(`${label} ${i + 1}`, { x: 50, y: 350, font });
  return Buffer.from(await doc.save());
}

let key: string;

test.beforeAll(async ({ request }) => {
  const res = await request.post("/api/v1/keys");
  expect(res.status()).toBe(201);
  key = (await res.json()).key;
  expect(key).toMatch(/^etc_[0-9a-f]{56}$/);
});

const auth = () => ({ Authorization: `Bearer ${key}` });

test.describe("API v1", () => {
  test("index lists the endpoints without auth", async ({ request }) => {
    const res = await request.get("/api/v1");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.endpoints.map((e: { path: string }) => e.path)).toContain("/api/v1/pdf/merge");
  });

  test("rejects missing, malformed and forged keys", async ({ request }) => {
    const missing = await request.post("/api/v1/data/csv-to-json", { data: { csv_data: "a\n1" } });
    expect(missing.status()).toBe(401);
    expect((await missing.json()).error.code).toBe("missing_api_key");

    const forged = key.slice(0, -1) + (key.endsWith("0") ? "1" : "0");
    for (const bad of ["nope", forged, "ehp_abc123"]) {
      const res = await request.post("/api/v1/data/csv-to-json", { headers: { Authorization: `Bearer ${bad}` }, data: { csv_data: "a\n1" } });
      expect(res.status()).toBe(401);
      expect((await res.json()).error.code).toBe("invalid_api_key");
    }
  });

  test("csv-to-json handles JSON, raw text/csv, quoted commas and line breaks", async ({ request }) => {
    const res = await request.post("/api/v1/data/csv-to-json", {
      headers: auth(),
      data: { csv_data: 'name,note\r\nAlice,"likes, commas"\r\nBob,"two\nlines"' },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["x-ratelimit-limit"]).toBeTruthy();
    expect(await res.json()).toEqual({
      rows: 2,
      columns: ["name", "note"],
      data: [{ name: "Alice", note: "likes, commas" }, { name: "Bob", note: "two\nlines" }],
    });

    const raw = await request.post("/api/v1/data/csv-to-json", {
      headers: { ...auth(), "Content-Type": "text/csv" },
      data: "a,b\n1,2",
    });
    expect((await raw.json()).data).toEqual([{ a: "1", b: "2" }]);

    const bad = await request.post("/api/v1/data/csv-to-json", { headers: auth(), data: { csv_data: "only-a-header" } });
    expect(bad.status()).toBe(422);
  });

  test("image/compress returns a smaller image and converts formats", async ({ request }) => {
    const png = await noisyPng();
    const res = await request.post("/api/v1/image/compress", {
      headers: auth(),
      multipart: { file: { name: "noise.png", mimeType: "image/png", buffer: png }, quality: "60", format: "webp" },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/webp");
    expect(res.headers()["content-disposition"]).toContain('filename="noise.webp"');
    const out = await res.body();
    expect(out.subarray(8, 12).toString()).toBe("WEBP");
    expect(out.length).toBeLessThan(png.length);
    expect(Number(res.headers()["x-original-size"])).toBe(png.length);
  });

  test("image/compress validates its input", async ({ request }) => {
    const notImage = await request.post("/api/v1/image/compress", {
      headers: auth(),
      multipart: { file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("not an image") } },
    });
    expect(notImage.status()).toBe(415);

    const badQuality = await request.post("/api/v1/image/compress", {
      headers: auth(),
      multipart: { file: { name: "x.png", mimeType: "image/png", buffer: await noisyPng() }, quality: "500" },
    });
    expect(badQuality.status()).toBe(400);

    const notMultipart = await request.post("/api/v1/image/compress", { headers: auth(), data: { file: "x" } });
    expect(notMultipart.status()).toBe(415);
  });

  test("pdf/merge combines PDFs in order", async ({ request }) => {
    const res = await request.post("/api/v1/pdf/merge", {
      headers: auth(),
      multipart: {
        files: { name: "a.pdf", mimeType: "application/pdf", buffer: await pdf(2, "A") },
        // Playwright's multipart helper takes one value per name, so send the second as files[]
        "files[]": { name: "b.pdf", mimeType: "application/pdf", buffer: await pdf(1, "B") },
      },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");
    expect(res.headers()["x-page-count"]).toBe("3");
    const merged = await PDFDocument.load(await res.body());
    expect(merged.getPageCount()).toBe(3);
  });

  test("pdf/merge rejects a single file and non-PDF files", async ({ request }) => {
    const one = await request.post("/api/v1/pdf/merge", {
      headers: auth(),
      multipart: { files: { name: "a.pdf", mimeType: "application/pdf", buffer: await pdf(1, "A") } },
    });
    expect(one.status()).toBe(400);

    const fake = await request.post("/api/v1/pdf/merge", {
      headers: auth(),
      multipart: {
        files: { name: "a.pdf", mimeType: "application/pdf", buffer: await pdf(1, "A") },
        "files[]": { name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("hello") },
      },
    });
    expect(fake.status()).toBe(415);
    expect((await fake.json()).error.message).toContain("fake.pdf");
  });

  test("CORS preflight is answered", async ({ request }) => {
    const res = await request.fetch("/api/v1/pdf/merge", { method: "OPTIONS" });
    expect(res.status()).toBe(204);
    expect(res.headers()["access-control-allow-headers"]).toContain("Authorization");
  });
});
