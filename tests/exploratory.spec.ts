import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

const PNG_1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const inputArea = "textarea:not([readonly])";

async function makePdf(pages = 1): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([300, 400]);
  return Buffer.from(await doc.save());
}

// ── Invalid-input handling ──
test.describe("Edge: invalid input handling", () => {
  test("PDF split with non-numeric range warns instead of silently extracting page 1", async ({ page }) => {
    await page.goto("/pdf");
    await page.getByRole("button", { name: "Split PDF" }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: "x.pdf",
      mimeType: "application/pdf",
      buffer: await makePdf(3),
    });
    await page.getByPlaceholder(/1-3, 5, 7-9/).fill("abc");

    let dialogMsg = "";
    page.on("dialog", (d) => { dialogMsg = d.message(); d.dismiss(); });
    await page.getByRole("button", { name: /Convert & Apply/i }).click();
    await expect.poll(() => dialogMsg).toMatch(/No valid pages/i);
  });

  test("Image resize to 0px is rejected (exploratory fix)", async ({ page }) => {
    await page.goto("/image");
    await page.getByRole("button", { name: "resize" }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: "test.png",
      mimeType: "image/png",
      buffer: Buffer.from(PNG_1x1, "base64"),
    });
    await page.getByRole("button", { name: /Apply Image resize/i }).waitFor();
    // Width input is the first number field
    await page.locator('input[type=number]').first().fill("0");

    let dialogMsg = "";
    page.on("dialog", (d) => { dialogMsg = d.message(); d.dismiss(); });
    await page.getByRole("button", { name: /Apply Image resize/i }).click();
    await expect.poll(() => dialogMsg).toMatch(/greater than 0/i);
  });

  test("Base64 decode of invalid data shows an error", async ({ page }) => {
    await page.goto("/developer");
    await page.locator(inputArea).fill("!!!not-valid-base64!!!");
    await page.getByRole("button", { name: "Base64 Decode" }).click();
    await expect(page.getByText(/Failed to process Base64/i)).toBeVisible();
  });

  test("JSON beautify of malformed JSON shows an error", async ({ page }) => {
    await page.goto("/data");
    await page.locator(inputArea).fill("{ bad json");
    await page.getByRole("button", { name: "Beautify JSON" }).click();
    await expect(page.locator(".text-red-600, .text-red-400").first()).toBeVisible();
  });
});

// ── Navbar quick search ──
test.describe("Edge: navbar quick search", () => {
  test("no-match query is kept (not silently swallowed)", async ({ page }) => {
    await page.goto("/");
    const box = page.getByPlaceholder("Quick find tool...");
    await box.fill("zzzznope");
    await box.press("Enter");
    await expect(box).toHaveValue("zzzznope");
    await expect(page.getByText(/No tools match your query/i)).toBeVisible();
  });

  test("matching query navigates to the tool", async ({ page }) => {
    await page.goto("/");
    const box = page.getByPlaceholder("Quick find tool...");
    await box.fill("Merge");
    await box.press("Enter");
    await expect(page).toHaveURL(/\/pdf$/);
  });
});

// ── 'Coming soon' & safety messaging ──
test.describe("Edge: messaging & safety", () => {
  test("Media page exposes the working FFmpeg tools (engine banner + dropzone)", async ({ page }) => {
    await page.goto("/media");
    await expect(page.getByText(/Coming Soon/i)).toHaveCount(0);
    await expect(page.getByText(/FFmpeg WebAssembly Engine/i)).toBeVisible();
    await expect(page.locator('input[type=file]')).toHaveCount(1);
  });

  test("PDF Protect shows the no-encryption warning and a text (not password) field", async ({ page }) => {
    await page.goto("/pdf");
    await page.getByRole("button", { name: "Protect PDF" }).click();
    await expect(page.getByText(/No Real Encryption/i)).toBeVisible();
    await page.locator('input[type=file]').setInputFiles({
      name: "x.pdf",
      mimeType: "application/pdf",
      buffer: await makePdf(1),
    });
    const field = page.getByPlaceholder(/Password tag/i);
    await expect(field).toBeVisible();
    await expect(field).toHaveAttribute("type", "text");
  });

  test("Sign-in CTA is relabelled to Dashboard (no fake auth)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Sign In" })).toHaveCount(0);
  });
});

// ── Storage resilience (bug fix) ──
test.describe("Edge: localStorage quota resilience", () => {
  test("conversion still works when localStorage.setItem throws (quota/private mode)", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    // Force every write to fail, like a full quota or Safari private mode
    await page.addInitScript(() => {
      const proto = Object.getPrototypeOf(window.localStorage);
      proto.setItem = () => {
        throw new DOMException("QuotaExceededError", "QuotaExceededError");
      };
    });

    await page.goto("/data");
    await page.locator(inputArea).fill('{"a":1}');
    await page.getByRole("button", { name: "Beautify JSON" }).click();

    // Output still produced, app did not crash
    await expect(page.locator("textarea[readonly]")).toHaveValue(/"a": 1/);
    expect(pageErrors).toEqual([]);
  });
});
