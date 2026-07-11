import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

async function makePdf(pages = 2): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pages; index++) {
    const page = document.addPage(index === 0 ? [300, 400] : [400, 300]);
    page.drawRectangle({ x: 35, y: 245, width: 165, height: 85 });
    page.drawText(`PDFium render page ${index + 1}`, { x: 45, y: 290, size: 14, font });
  }
  return Buffer.from(await document.save());
}

test("PDF to image renders through PDFium when PDF.js CDN is unavailable", async ({ page }) => {
  await page.route("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/**", (route) => route.abort());
  await page.goto("/pdf");
  await page.getByRole("button", { name: /Image/i }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "pdfium.pdf",
    mimeType: "application/pdf",
    buffer: await makePdf(2),
  });
  await page.getByRole("button", { name: "Process PDF to Image" }).click();
  await expect(page.getByRole("link", { name: "Download Page 1" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("Rendered PDF pages").getByRole("link", { name: "Page 2" })).toBeVisible();
});
