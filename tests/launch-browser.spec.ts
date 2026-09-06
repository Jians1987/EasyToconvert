import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

test("HTML minifier preserves text and preformatted whitespace in the browser", async ({ page }) => {
  await page.goto("/javascript");
  await page.getByRole("button", { name: "Minifier", exact: true }).click();
  await page.getByRole("button", { name: "HTML", exact: true }).click();
  const html = '<!-- remove --><pre>a  b\n c</pre><span>a</span> <span>b</span><script>const s = "a  b";</script>';
  await page.locator("textarea:not([readonly])").fill(html);
  await page.getByRole("button", { name: "Apply HTML Minification" }).click();
  await expect(page.locator("textarea[readonly]")).toHaveValue(html.replace('<!-- remove -->', ''));
});

test("cloud OCR starts disabled in PDF and table detection", async ({ page }) => {
  await page.goto("/table-detect");
  await expect(page.getByRole("checkbox", { name: /Allow cloud OCR/ })).not.toBeChecked();
  await page.goto("/pdf");
  await page.getByRole("button", { name: "→ Word", exact: true }).click();
  const pdf = await PDFDocument.create();
  pdf.addPage();
  await page.locator('input[type="file"]').setInputFiles({ name: "scan.pdf", mimeType: "application/pdf", buffer: Buffer.from(await pdf.save()) });
  await expect(page.getByRole("checkbox", { name: "Allow cloud OCR for scanned pages" })).not.toBeChecked();
});

test("privacy page is linked and explains uploads", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Privacy & Data Handling" }).click();
  await expect(page.getByRole("heading", { name: "Privacy & Data Handling" })).toBeVisible();
  await expect(page.getByText("PDF compression uploads the complete PDF to our server for processing.")).toBeVisible();
});
