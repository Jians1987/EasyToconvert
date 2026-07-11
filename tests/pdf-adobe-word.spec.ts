import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

async function makePdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const page = document.addPage([300, 400]);
  page.drawText("Adobe PDF Services test", { x: 40, y: 340, size: 14, font });
  return Buffer.from(await document.save());
}

test("Adobe High Quality PDF to Word route is used when selected", async ({ page }) => {
  let adobeCalled = false;
  await page.route("**/api/pdf/adobe-export", async (route) => {
    adobeCalled = true;
    await route.fulfill({
      status: 200,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      body: Buffer.from("mock-docx"),
    });
  });

  await page.goto("/pdf");
  await page.getByRole("button", { name: /Word/i }).click();
 await page.locator('input[type="file"]').setInputFiles({
    name: "adobe-source.pdf",
    mimeType: "application/pdf",
    buffer: await makePdf(),
  });
  await expect(page.getByRole("button", { name: /Adobe High Quality/i })).toBeVisible();
  await page.getByRole("button", { name: "Process PDF to Word" }).click();
  await expect(page.getByRole("link", { name: "Download .docx" })).toBeVisible({ timeout: 20_000 });
  expect(adobeCalled).toBe(true);
});
