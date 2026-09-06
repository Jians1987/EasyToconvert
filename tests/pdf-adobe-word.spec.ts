import { expect, test, type Page } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

async function makePdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const page = document.addPage([300, 400]);
  page.drawText("Adobe PDF Services test", { x: 40, y: 340, size: 14, font });
  return Buffer.from(await document.save());
}

async function openWordTool(page: Page) {
  await page.goto("/pdf");
  await page.getByRole("button", { name: "→ Word", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "adobe-source.pdf",
    mimeType: "application/pdf",
    buffer: await makePdf(),
  });
}

test("in-browser engine is the default and keeps the output modes visible", async ({ page }) => {
  let adobeCalled = false;
  await page.route("**/api/pdf/adobe-export", (route) => {
    adobeCalled = true;
    return route.abort();
  });

  await openWordTool(page);

  await expect(page.getByRole("button", { name: /In Browser/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Adobe High Quality/ })).toBeVisible();
  // Fidelity options belong to the browser engine, so they show by default.
  await expect(page.getByRole("button", { name: "Structured (Editable)" })).toBeVisible();
  await expect(page.getByText(/Runs on your device unless you enable cloud OCR/i)).toBeVisible();

  await page.getByRole("button", { name: "Process PDF to Word" }).click();
  await expect(page.getByRole("link", { name: "Download .docx" })).toBeVisible({ timeout: 20_000 });
  // The default path must not touch Adobe.
  expect(adobeCalled).toBe(false);
});

test("selecting Adobe warns about the upload and hides the browser-only options", async ({ page }) => {
  await openWordTool(page);
  await page.getByRole("button", { name: /Adobe High Quality/ }).click();

  await expect(page.getByText(/uploaded to Adobe PDF Services/i)).toBeVisible();
  // Adobe chooses its own layout strategy, so these must not be offered.
  await expect(page.getByRole("button", { name: "Structured (Editable)" })).toHaveCount(0);
  await expect(page.getByText(/OCR for Scanned Pages/i)).toHaveCount(0);
});

test("Adobe engine routes through /api/pdf/adobe-export and offers the result", async ({ page }) => {
  let adobeCalled = false;
  await page.route("**/api/pdf/adobe-export", async (route) => {
    adobeCalled = true;
    await route.fulfill({
      status: 200,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      body: Buffer.from("mock-docx"),
    });
  });

  await openWordTool(page);
  await page.getByRole("button", { name: /Adobe High Quality/ }).click();
  await page.getByRole("button", { name: "Process PDF to Word" }).click();

  await expect(page.getByRole("link", { name: "Download .docx" })).toBeVisible({ timeout: 20_000 });
  expect(adobeCalled).toBe(true);
});

test("missing Adobe credentials produce an actionable message, not a raw 503", async ({ page }) => {
  await page.route("**/api/pdf/adobe-export", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Adobe PDF Services credentials are not configured." }),
    })
  );

  // This page reports failures through a native alert(), so capture the dialog
  // rather than looking for the text in the DOM.
  const messages: string[] = [];
  page.on("dialog", (dialog) => {
    messages.push(dialog.message());
    return dialog.dismiss();
  });

  await openWordTool(page);
  await page.getByRole("button", { name: /Adobe High Quality/ }).click();
  await page.getByRole("button", { name: "Process PDF to Word" }).click();

  await expect
    .poll(() => messages.join("\n"), { timeout: 20_000 })
    .toMatch(/isn't configured on this server/i);
  // The message must name the env vars, not just relay a bare 503.
  expect(messages.join("\n")).toContain("PDF_SERVICES_CLIENT_ID");
});
