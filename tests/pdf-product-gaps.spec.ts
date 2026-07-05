import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { readFile } from "node:fs/promises";

async function makePdf(pages: number): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pages; index++) {
    const page = document.addPage([300, 400]);
    page.drawText(`Page ${index + 1}`, { x: 40, y: 350, font });
  }
  return Buffer.from(await document.save());
}

async function upload(page: import("@playwright/test").Page, pages: number) {
  await page.locator('input[type="file"]').setInputFiles({
    name: "pages.pdf",
    mimeType: "application/pdf",
    buffer: await makePdf(pages),
  });
}

test.describe("PDF product-gap fixes", () => {
  test("rotates only the selected pages", async ({ page }) => {
    await page.goto("/pdf");
    await page.getByRole("button", { name: "Rotate" }).click();
    await upload(page, 3);
    await page.getByLabel("Pages to rotate").fill("2");
    await page.getByRole("button", { name: "180°" }).click();
    await page.getByRole("button", { name: "Process PDF Rotate" }).click();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Download File" }).click(),
    ]);
    const path = await download.path();
    expect(path).not.toBeNull();
    const output = await PDFDocument.load(await readFile(path!));
    expect(output.getPages().map((item) => item.getRotation().angle)).toEqual([0, 180, 0]);
  });

  test("offers a download for every rendered image page", async ({ page }) => {
    await page.goto("/pdf");
    await page.getByRole("button", { name: "→ Image" }).click();
    await upload(page, 3);
    await page.getByRole("button", { name: "Process PDF to Image" }).click();
    const downloads = page.getByLabel("Rendered PDF pages").getByRole("link");
    await expect(downloads).toHaveCount(3);
    await expect(page.getByRole("link", { name: "Page 3" })).toBeVisible();
  });

  test("exposes advanced annotations and page organization", async ({ page }) => {
    await page.goto("/pdf");
    await page.getByRole("button", { name: "Edit" }).click();
    await upload(page, 2);
    await expect(page.getByRole("button", { name: "Editor draw" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Editor highlight" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Editor rect" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add signature" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add image" })).toBeVisible();

    await page.getByRole("button", { name: "Rotate page 1" }).click();
    await expect(page.getByText("90°")).toBeVisible();
    await page.getByRole("button", { name: "Add blank page after 1" }).click();
    await expect(page.getByText("Page 3")).toBeVisible();
    await page.getByRole("button", { name: "Delete page 2" }).click();

    await page.getByRole("button", { name: "Add signature" }).click();
    await page.getByRole("button", { name: "Type" }).click();
    await page.getByLabel("Typed signature").fill("Jane Doe");
    await page.getByRole("dialog").getByRole("button", { name: "Add signature" }).click();
    await expect(page.getByText("Jane Doe")).toBeVisible();
  });
});
