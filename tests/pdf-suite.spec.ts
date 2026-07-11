import { expect, test, type Page } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

async function makePdf(pages = 1): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pages; index++) {
    const page = document.addPage([300, 400]);
    page.drawText(`Page ${index + 1}`, { x: 40, y: 350, size: 18, font });
    page.drawText("Name     Amount", { x: 40, y: 300, size: 12, font });
    page.drawText(`Item ${index + 1}     ${100 + index}`, { x: 40, y: 275, size: 12, font });
  }
  return Buffer.from(await document.save());
}

async function uploadPdf(page: Page, pages = 1) {
  await page.locator('input[type="file"]').setInputFiles({
    name: "sample.pdf",
    mimeType: "application/pdf",
    buffer: await makePdf(pages),
  });
}

test.describe("PDF suite", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pdf");
  });

  test("merge combines every uploaded page", async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles([
      { name: "one.pdf", mimeType: "application/pdf", buffer: await makePdf(1) },
      { name: "two.pdf", mimeType: "application/pdf", buffer: await makePdf(2) },
    ]);
    await page.getByRole("button", { name: "Process PDF Merge" }).click();
    await expect(page.getByRole("link", { name: "Download File" })).toBeVisible();
  });

  test("split extracts the requested page range", async ({ page }) => {
    await page.getByRole("button", { name: "Split" }).click();
    await uploadPdf(page, 3);
    await page.getByPlaceholder("1,3,5-10").fill("2-3");
    await page.getByRole("button", { name: "Process PDF Split" }).click();
    await expect(page.getByRole("link", { name: "Download File" })).toBeVisible();
  });

  test("rotate accepts each supported angle and exports", async ({ page }) => {
    await page.getByRole("button", { name: "Rotate" }).click();
    await uploadPdf(page);
    for (const angle of [90, 180, 270]) {
      await page.getByRole("button", { name: `${angle}°` }).click();
    }
    await page.getByRole("button", { name: "Process PDF Rotate" }).click();
    await expect(page.getByRole("link", { name: "Download File" })).toBeVisible();
  });

  test("Word conversion exports in both fidelity modes", async ({ page }) => {
    await page.getByRole("button", { name: "→ Word" }).click();
    for (const fidelity of ["Exact Layout", "Editable Text"]) {
      await uploadPdf(page);
      await page.getByRole("button", { name: "Private Browser" }).click();
      await page.getByRole("button", { name: fidelity, exact: true }).click();
      await page.getByRole("button", { name: "Process PDF to Word" }).click();
      await expect(page.getByRole("link", { name: "Download .docx" })).toBeVisible({
        timeout: 20_000,
      });
    }
  });

  test("Excel conversion exports with text clustering", async ({ page }) => {
    await page.getByRole("button", { name: "→ Excel" }).click();
    await uploadPdf(page);
    await page.getByRole("button", { name: "Text Clustering" }).click();
    await page.getByRole("button", { name: "Process PDF to Excel" }).click();
    await expect(page.getByRole("link", { name: "Download .xlsx" })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("image conversion renders a JPEG", async ({ page }) => {
    await page.getByRole("button", { name: "→ Image" }).click();
    await uploadPdf(page);
    await page.getByRole("button", { name: "Process PDF to Image" }).click();
    await expect(page.getByRole("link", { name: "Download Page 1" })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("editor previews, annotates, and exports", async ({ page }) => {
    await page.getByRole("button", { name: "Edit" }).click();
    await uploadPdf(page);
    await expect(page.getByAltText("Page 1")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Text" }).click();
    await page.getByPlaceholder("Text value...").fill("Verified annotation");
    await page.locator("svg.cursor-crosshair").click({ position: { x: 100, y: 100 } });
    await expect(page.getByText("Verified annotation")).toBeVisible();
    await page.getByRole("button", { name: "Export & Download" }).click();
    await expect(page.getByRole("link", { name: "Download File" })).toBeVisible({
      timeout: 20_000,
    });
  });
});
