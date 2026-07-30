import { expect, test, type Page } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";

async function makePdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < 2; index++) {
    const page = document.addPage(index === 0 ? [300, 400] : [400, 300]);
    page.drawRectangle({ x: 30, y: 250, width: 160, height: 80 });
    page.drawText(`Source text page ${index + 1}`, { x: 45, y: 290, font, size: 14 });
  }
  return Buffer.from(await document.save());
}

// Current output-mode labels. The Adobe/Private-Browser engine switch these
// tests used to click was removed in 267f34d.
type Fidelity = "Exact Layout (Image)" | "Structured (Editable)";

async function convert(page: Page, mode: Fidelity) {
  await page.goto("/pdf");
  await page.getByRole("button", { name: "→ Word" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "layout.pdf",
    mimeType: "application/pdf",
    buffer: await makePdf(),
  });
  await page.getByRole("button", { name: mode, exact: true }).click();
  await page.getByRole("button", { name: "Process PDF to Word" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download .docx" }).click(),
  ]);
  return JSZip.loadAsync(await readFile((await download.path())!));
}

test("Exact Layout embeds one faithful page image per PDF page", async ({ page }) => {
  const archive = await convert(page, "Exact Layout (Image)");
  const media = Object.keys(archive.files).filter((name) => /^word\/media\/.+/.test(name));
  expect(media).toHaveLength(2);
  const xml = await archive.file("word/document.xml")!.async("text");
  expect(xml).not.toContain("Source text page");
});

test("Editable Text remains selectable and contains no page screenshots", async ({ page }) => {
  const archive = await convert(page, "Structured (Editable)");
  const media = Object.keys(archive.files).filter((name) => /^word\/media\/.+/.test(name));
  expect(media).toHaveLength(0);
  const xml = await archive.file("word/document.xml")!.async("text");
  expect(xml).toContain("Source text page");
});
