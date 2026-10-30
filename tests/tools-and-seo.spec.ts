import { test, expect, type Page } from "@playwright/test";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import sharp from "sharp";
import { toolLinks } from "../app/lib/toolLinks";
import { blogPosts } from "../app/lib/blogPosts";

const site = "https://www.easytoconvert.in";

async function fetchBytes(page: Page, href: string): Promise<Buffer> {
  const arr = await page.evaluate(async (u) => Array.from(new Uint8Array(await (await fetch(u)).arrayBuffer())), href);
  return Buffer.from(arr);
}

// A PDF whose pages are large photo-like images — the case compression is for.
async function imageHeavyPdf(pages = 2): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const w = 1200, h = 1600, raw = Buffer.alloc(w * h * 3);
    for (let p = 0; p < raw.length; p++) raw[p] = (p * 2654435761 + i) >>> 24; // noise
    const jpg = await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
    const img = await doc.embedJpg(jpg);
    doc.addPage([600, 800]).drawImage(img, { x: 0, y: 0, width: 600, height: 800 });
  }
  return Buffer.from(await doc.save());
}

async function textPdf(pages = 1): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) doc.addPage([300, 400]).drawText(`Page ${i + 1}`, { x: 40, y: 340, size: 18, font });
  return Buffer.from(await doc.save());
}

test.describe("Dedicated tool pages", () => {
  test("every tool page is indexable with its own title, H1, canonical and structured data", async ({ request }) => {
    const titles = new Set<string>();
    for (const tool of toolLinks) {
      const res = await request.get(`/${tool.slug}`);
      expect(res.status(), tool.slug).toBe(200);
      const html = await res.text();
      const title = /<title>([^<]+)<\/title>/.exec(html)?.[1] ?? "";
      expect(title, tool.slug).toMatch(/ \| EasyToConvert$/);
      expect(title, tool.slug).not.toMatch(/EasyToConvert \| EasyToConvert/);
      expect(titles.has(title), `duplicate title ${title}`).toBeFalsy();
      titles.add(title);
      expect(html, tool.slug).toContain(`<link rel="canonical" href="${site}/${tool.slug}"/>`);
      expect(html.match(/<h1[\s>]/g)?.length, `${tool.slug} has exactly one h1`).toBe(1);
      expect(html, tool.slug).toContain('"@type":"FAQPage"');
      expect(html, tool.slug).toContain('"@type":"WebApplication"');
      expect(html, tool.slug).toMatch(/How to use the .+ tool/);
    }
  });

  test("tool pages open the hub in the right mode", async ({ page }) => {
    await page.goto("/split-pdf");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Split a PDF and extract the pages you need");
    await page.locator("input[type=file]").setInputFiles({ name: "s.pdf", mimeType: "application/pdf", buffer: await textPdf(2) });
    await expect(page.getByText(/Pages to Extract/i)).toBeVisible();

    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#fff" } }).png().toBuffer();
    await page.goto("/png-to-jpg");
    await page.locator("input[type=file]").setInputFiles({ name: "a.png", mimeType: "image/png", buffer: png });
    await expect(page.locator("select")).toHaveValue("image/jpeg");
    await page.goto("/svg-to-png");
    await page.locator("input[type=file]").setInputFiles({ name: "a.png", mimeType: "image/png", buffer: png });
    await expect(page.locator("select")).toHaveValue("image/png");

    await page.goto("/password-generator");
    await expect(page.getByRole("button", { name: /Generate Password/ })).toBeVisible();

    await page.goto("/json-formatter");
    await expect(page.getByRole("button", { name: "Beautify JSON" })).toBeVisible();
    // Breadcrumb names the tool and links to its category hub
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("JSON Formatter");
  });

  test("hub sidebars link to every tool page in the category", async ({ page }) => {
    await page.goto("/pdf");
    const nav = page.getByRole("navigation", { name: "PDF Tools tools" });
    for (const tool of toolLinks.filter((t) => t.hub === "pdf")) {
      await expect(nav.getByRole("link", { name: tool.name, exact: true })).toHaveAttribute("href", `/${tool.slug}`);
    }
  });
});

test.describe("Technical SEO", () => {
  test("sitemap lists tool pages and articles but not private pages", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    for (const tool of toolLinks) expect(xml).toContain(`<loc>${site}/${tool.slug}</loc>`);
    for (const post of blogPosts) expect(xml).toContain(`<loc>${site}/blog/${post.slug}</loc>`);
    expect(xml).toContain(`<loc>${site}/table-detect</loc>`);
    expect(xml).not.toContain("/dashboard");
    expect(xml).not.toContain("/mobil");
    expect(xml).toContain("<lastmod>2026-10-30</lastmod>");
  });

  test("robots.txt lets crawlers fetch JS and CSS", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).not.toContain("Disallow: /_next/");
    expect(robots).toContain("Disallow: /dashboard");
  });

  test("hub titles are not duplicated and private pages are noindex", async ({ request }) => {
    const pdf = await (await request.get("/pdf")).text();
    expect(/<title>([^<]+)<\/title>/.exec(pdf)?.[1]).toBe("Free PDF Tools – Merge, Split, Edit, Convert PDF Online | EasyToConvert");
    const table = await (await request.get("/table-detect")).text();
    expect(table).toContain("<title>Extract Tables from PDF &amp; Images to Excel or CSV – Free | EasyToConvert</title>");
    const mobil = await (await request.get("/mobil")).text();
    expect(mobil).toContain('<meta name="robots" content="noindex, nofollow"/>');
  });

  test("icons, manifest and share image are real files", async ({ request }) => {
    for (const path of ["/favicon.ico", "/apple-touch-icon.png", "/icon-192.png", "/icon-512.png"]) {
      expect((await request.get(path)).status(), path).toBe(200);
    }
    const og = await (await request.get("/og-image.png")).body();
    const meta = await sharp(og).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["png", 1200, 630]);
    const manifest = await (await request.get("/manifest.json")).json();
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toContain("512x512");
  });

  test("Google Search Console verification file is served unchanged", async ({ request }) => {
    const res = await request.get("/google03ee45c3264fc91e.html");
    expect(res.status()).toBe(200);
    expect(await res.text()).toBe("google-site-verification: google03ee45c3264fc91e.html");
  });

  test("blog articles have Article structured data", async ({ request }) => {
    const html = await (await request.get(`/blog/${blogPosts[0].slug}`)).text();
    expect(html).toContain('"@type":"Article"');
    expect(html).toContain(`<link rel="canonical" href="${site}/blog/${blogPosts[0].slug}"/>`);
    expect((await request.get("/blog/no-such-article")).status()).toBe(404);
  });
});

test.describe("Compress PDF", () => {
  test("shrinks an image-heavy PDF and reports the saving", async ({ page }) => {
    const input = await imageHeavyPdf(2);
    await page.goto("/compress-pdf");
    await page.locator("input[type=file]").setInputFiles({ name: "scan.pdf", mimeType: "application/pdf", buffer: input });
    await page.getByRole("radio", { name: /Strong/ }).click();
    await page.getByRole("button", { name: /Process PDF Compress/i }).click();
    const link = page.getByRole("link", { name: /Download File/i });
    await expect(link).toBeVisible({ timeout: 30000 });
    await expect(link).toHaveAttribute("download", "scan-compressed.pdf");
    await expect(page.getByText(/→ .*\(−\d+%\)/)).toBeVisible();
    const output = await fetchBytes(page, (await link.getAttribute("href"))!);
    expect(output.length).toBeLessThan(input.length / 2);
    const doc = await PDFDocument.load(output);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getSize()).toEqual({ width: 600, height: 800 });
  });

  test("keeps the original when compression would not help", async ({ page }) => {
    const input = await textPdf(1);
    await page.goto("/compress-pdf");
    await page.locator("input[type=file]").setInputFiles({ name: "notes.pdf", mimeType: "application/pdf", buffer: input });
    await page.getByRole("button", { name: /Process PDF Compress/i }).click();
    await expect(page.getByText(/already compact \(/)).toBeVisible({ timeout: 30000 });
    const output = await fetchBytes(page, (await page.getByRole("link", { name: /Download File/i }).getAttribute("href"))!);
    expect(output.equals(input)).toBeTruthy();
  });
});

test.describe("PDF fixes", () => {
  test("PDF to JPG offers a download for every page", async ({ page }) => {
    await page.goto("/pdf-to-jpg");
    await page.locator("input[type=file]").setInputFiles({ name: "deck.pdf", mimeType: "application/pdf", buffer: await textPdf(3) });
    await page.getByRole("button", { name: /Process PDF to Image/i }).click();
    const links = page.getByRole("link", { name: "Download JPG" });
    await expect(links).toHaveCount(3, { timeout: 30000 });
    await expect(links.nth(2)).toHaveAttribute("download", "deck-page-3.jpg");
  });

  test("rotation adds to a page's existing rotation", async ({ page }) => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 400]).setRotation(degrees(90));
    doc.addPage([300, 400]);
    await page.goto("/rotate-pdf");
    await page.locator("input[type=file]").setInputFiles({ name: "r.pdf", mimeType: "application/pdf", buffer: Buffer.from(await doc.save()) });
    await page.getByRole("button", { name: /Process PDF Rotate/i }).click();
    const link = page.getByRole("link", { name: /Download File/i });
    await expect(link).toBeVisible({ timeout: 15000 });
    const out = await PDFDocument.load(await fetchBytes(page, (await link.getAttribute("href"))!));
    expect(out.getPages().map((p) => p.getRotation().angle)).toEqual([180, 90]);
  });

  test("Add Text to PDF supports undo", async ({ page }) => {
    await page.goto("/add-text-to-pdf");
    await page.locator("input[type=file]").setInputFiles({ name: "f.pdf", mimeType: "application/pdf", buffer: await textPdf(1) });
    await page.locator('img[alt="Page 1"]').waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: "Text", exact: true }).click();
    const canvas = page.locator('svg[viewBox="0 0 1000 1000"]').first();
    await canvas.click({ position: { x: 40, y: 40 } });
    await canvas.click({ position: { x: 80, y: 80 } });
    await expect(canvas.locator("text")).toHaveCount(2);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(canvas.locator("text")).toHaveCount(1);
  });
});

test.describe("Image fixes", () => {
  test("compressing a photo-like PNG produces a smaller WebP and explains why", async ({ page }) => {
    // Smooth gradients plus mild noise, like a photo: PNG stores this poorly, lossy WebP well.
    const w = 400, h = 300, raw = Buffer.alloc(w * h * 3);
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
      raw[(y * w + x) * 3 + c] = Math.min(255, Math.round((x + y * (c + 1)) % 256 * 0.8 + rand() * 40));
    }
    const png = await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
    await page.goto("/compress-image");
    await page.locator("input[type=file]").setInputFiles({ name: "shot.png", mimeType: "image/png", buffer: png });
    await page.getByRole("button", { name: /Apply Image compress/i }).click();
    const link = page.getByRole("link", { name: "Download Image" });
    await expect(link).toHaveAttribute("download", "shot.webp");
    await expect(page.getByText(/compressed to WebP/)).toBeVisible();
    const out = await fetchBytes(page, (await link.getAttribute("href"))!);
    expect((await sharp(out).metadata()).format).toBe("webp");
    expect(out.length).toBeLessThan(png.length);
  });

  test("compressing never returns a bigger file", async ({ page }) => {
    // A repeating hard-edged pattern: PNG stores it compactly, lossy WebP doesn't (≈26 KB vs ≈68 KB).
    const w = 400, h = 300, raw = Buffer.alloc(w * h * 4);
    for (let i = 0; i < raw.length; i++) raw[i] = i % 4 === 3 ? 255 : (i * 2654435761) >>> 24;
    const flat = await sharp(raw, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
    await page.goto("/compress-image");
    await page.locator("input[type=file]").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: flat });
    await page.getByRole("button", { name: /Apply Image compress/i }).click();
    const link = page.getByRole("link", { name: "Download Image" });
    await expect(link).toHaveAttribute("download", "logo.png");
    await expect(page.getByText(/already well optimised/)).toBeVisible();
    expect((await fetchBytes(page, (await link.getAttribute("href"))!)).equals(flat)).toBeTruthy();
  });

  test("PNG to JPG turns transparency white, not black", async ({ page }) => {
    const transparent = await sharp({ create: { width: 20, height: 20, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    await page.goto("/png-to-jpg");
    await page.locator("input[type=file]").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: transparent });
    await page.getByRole("button", { name: /Apply Image convert/i }).click();
    const link = page.getByRole("link", { name: "Download Image" });
    await expect(link).toHaveAttribute("download", "logo.jpg");
    const { data } = await sharp(await fetchBytes(page, (await link.getAttribute("href"))!)).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(240);
  });
});
