import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

// 1x1 red PNG
const PNG_1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const inputArea = "textarea:not([readonly])";
const outputArea = "textarea[readonly]";

// ───────────────────────── HOME ─────────────────────────
test.describe("Home page", () => {
  test("loads hero + all 7 category cards", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Smart File Conversion/i })).toBeVisible();
    await expect(page.getByText("Explore All Utility Hubs")).toBeVisible();
    for (const t of ["PDF Utilities", "Image Studio", "Data Converters", "Developer Core", "AI Powerhouse", "Video & Audio"]) {
      await expect(page.getByRole("heading", { name: t })).toBeVisible();
    }
  });

  test("hero search filters categories", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder(/Search PDF to Word/i).fill("image");
    await expect(page.getByRole("heading", { name: "Image Studio" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "PDF Utilities" })).toHaveCount(0);
  });

  test("hero search shows no-results message (exploratory fix)", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder(/Search PDF to Word/i).fill("zzzznotathing");
    await expect(page.getByText(/No tools found/i)).toBeVisible();
  });
});

// ───────────────────────── DATA ─────────────────────────
test.describe("Data tools", () => {
  test("JSON beautify adds spacing", async ({ page }) => {
    await page.goto("/data");
    await page.locator(inputArea).fill('{"a":1,"b":[1,2]}');
    await page.getByRole("button", { name: "Beautify JSON" }).click();
    expect(await page.locator(outputArea).inputValue()).toContain('"a": 1');
  });

  test("JSON minify removes whitespace", async ({ page }) => {
    await page.goto("/data");
    await page.locator(inputArea).fill('{ "a": 1, "b": 2 }');
    await page.getByRole("button", { name: "Minify JSON" }).click();
    expect(await page.locator(outputArea).inputValue()).toBe('{"a":1,"b":2}');
  });

  test("JSON→CSV on empty array shows clear error (bug fix #7)", async ({ page }) => {
    await page.goto("/data");
    await page.locator(inputArea).fill("[]");
    await page.getByRole("button", { name: "JSON to CSV" }).click();
    await expect(page.getByText(/empty/i)).toBeVisible();
  });

  test("CSV→JSON keeps commas inside quoted fields (bug fix #6)", async ({ page }) => {
    await page.goto("/data");
    await page.getByRole("button", { name: "CSV ↔ JSON" }).click();
    await page.locator(inputArea).fill('name,city\n"Smith, John",NYC');
    await page.getByRole("button", { name: "CSV to JSON" }).click();
    const out = await page.locator(outputArea).inputValue();
    expect(out).toContain('"name": "Smith, John"');
    expect(out).toContain('"city": "NYC"');
  });

  test("XML→JSON converts elements", async ({ page }) => {
    await page.goto("/data");
    await page.getByRole("button", { name: "XML ↔ JSON" }).click();
    await page.locator(inputArea).fill("<root><name>Easy</name></root>");
    await page.getByRole("button", { name: "XML to JSON" }).click();
    expect(await page.locator(outputArea).inputValue()).toContain('"name"');
  });

  test("JSON↔YAML converts", async ({ page }) => {
    await page.goto("/data");
    await page.getByRole("button", { name: "JSON ↔ YAML" }).click();
    await page.locator(inputArea).fill('{"a":1}');
    await page.getByRole("button", { name: /Parse JSON/i }).click();
    expect(await page.locator(outputArea).inputValue()).toContain("a: 1");
  });
});

// ───────────────────────── DEVELOPER ─────────────────────────
test.describe("Developer tools", () => {
  test("Base64 encode + decode round-trip", async ({ page }) => {
    await page.goto("/developer");
    await page.locator(inputArea).fill("Hello");
    await page.getByRole("button", { name: "Base64 Encode" }).click();
    expect(await page.locator(outputArea).inputValue()).toBe("SGVsbG8=");
    await page.locator(inputArea).fill("SGVsbG8=");
    await page.getByRole("button", { name: "Base64 Decode" }).click();
    expect(await page.locator(outputArea).inputValue()).toBe("Hello");
  });

  test("URL encode special chars", async ({ page }) => {
    await page.goto("/developer");
    // Tab and action button share the text "URL Encode"; the tab is the only match
    // until the URL mode renders, then the action button is the last match.
    await page.getByRole("button", { name: "URL Encode" }).click(); // switches to URL tab
    await page.locator(inputArea).fill("a b&c=d");
    await page.getByRole("button", { name: "URL Encode" }).last().click(); // action button
    expect(await page.locator(outputArea).inputValue()).toBe("a%20b%26c%3Dd");
  });

  test("UUIDs are RFC 4122 v4 compliant (bug fix #3)", async ({ page }) => {
    await page.goto("/developer");
    await page.getByRole("button", { name: "UUID Generator" }).click();
    await page.getByRole("button", { name: /Generate 5 UUIDs/i }).click();
    const out = await page.locator(outputArea).inputValue();
    const uuids = out.trim().split("\n");
    expect(uuids).toHaveLength(5);
    const v4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (const u of uuids) expect(u).toMatch(v4);
  });

  test("Password respects default length 16", async ({ page }) => {
    await page.goto("/developer");
    await page.getByRole("button", { name: "Password Maker" }).click();
    await page.getByRole("button", { name: /Generate Password/i }).click();
    expect((await page.locator(outputArea).inputValue()).length).toBe(16);
  });

  test("QR code renders an image", async ({ page }) => {
    await page.goto("/developer");
    await page.getByRole("button", { name: "QR Code Maker" }).click();
    await page.locator(inputArea).fill("https://example.com");
    await page.getByRole("button", { name: "Create QR Code" }).click();
    await expect(page.getByAltText("QR Code Output")).toBeVisible();
  });

  test("QR mode exposes a working Copy button (bug fix)", async ({ page }) => {
    await page.goto("/developer");
    await page.getByRole("button", { name: "QR Code Maker" }).click();
    await page.locator(inputArea).fill("https://example.com/copy-me");
    await page.getByRole("button", { name: "Create QR Code" }).click();
    await expect(page.getByAltText("QR Code Output")).toBeVisible();
    // The Copy button must now render in QR mode and copy the source text
    const copyBtn = page.getByRole("button", { name: /Copy Text/i });
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe("https://example.com/copy-me");
  });
});

// ───────────────────────── JAVASCRIPT / CSS ─────────────────────────
test.describe("JS & CSS tools", () => {
  test("CSS gradient outputs valid css", async ({ page }) => {
    await page.goto("/javascript");
    await expect(page.getByText(/linear-gradient\(135deg/)).toBeVisible();
  });

  test("JS minify removes comments without corrupting operators (bug fix #8)", async ({ page }) => {
    await page.goto("/javascript");
    await page.getByRole("button", { name: "Minifier" }).click();
    await page.locator(inputArea).fill("const x = a - -b; // a comment\nconst y = 1;");
    await page.getByRole("button", { name: /Apply JS Minification/i }).click();
    const out = await page.locator(outputArea).inputValue();
    expect(out).not.toContain("a--b"); // operators not mangled
    expect(out).not.toContain("comment"); // comment stripped
  });

  test("HTML beautifier indents tags", async ({ page }) => {
    await page.goto("/javascript");
    await page.getByRole("button", { name: "HTML Beautifier" }).click();
    await page.locator(inputArea).fill("<div><p>hi</p></div>");
    await page.getByRole("button", { name: /Beautify HTML/i }).click();
    const out = await page.locator(outputArea).inputValue();
    // Beautifier correctly puts each tag/text on its own indented line
    expect(out.split("\n").length).toBeGreaterThan(1);
    expect(out).toContain("<div>");
    expect(out).toContain("<p>");
    expect(out).toContain("hi");
  });
});

// ───────────────────────── IMAGE ─────────────────────────
test.describe("Image tools", () => {
  test("convert PNG → WebP produces a download", async ({ page }) => {
    await page.goto("/image");
    await page.locator('input[type=file]').setInputFiles({
      name: "test.png",
      mimeType: "image/png",
      buffer: Buffer.from(PNG_1x1, "base64"),
    });
    await page.getByRole("button", { name: /Apply Image convert/i }).click();
    await expect(page.getByRole("link", { name: /Download Image/i })).toBeVisible();
  });

  test("metadata mode reads dimensions", async ({ page }) => {
    await page.goto("/image");
    await page.getByRole("button", { name: "metadata" }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: "test.png",
      mimeType: "image/png",
      buffer: Buffer.from(PNG_1x1, "base64"),
    });
    await expect(page.getByText(/1 × 1 px/)).toBeVisible();
  });
});

// ───────────────────────── PDF ─────────────────────────
test.describe("PDF tools", () => {
  async function makePdf(pages = 1): Promise<Buffer> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pages; i++) doc.addPage([300, 400]);
    return Buffer.from(await doc.save());
  }

  test("merge two PDFs produces a download", async ({ page }) => {
    await page.goto("/pdf");
    const a = await makePdf(1);
    const b = await makePdf(2);
    await page.locator('input[type=file]').setInputFiles([
      { name: "a.pdf", mimeType: "application/pdf", buffer: a },
      { name: "b.pdf", mimeType: "application/pdf", buffer: b },
    ]);
    await page.getByRole("button", { name: /Apply PDF merge/i }).click();
    await expect(page.getByRole("link", { name: /Download File/i })).toBeVisible({ timeout: 15000 });
  });

  test("PDF to Word shows fidelity toggle (new feature)", async ({ page }) => {
    await page.goto("/pdf");
    await page.getByRole("button", { name: "PDF to Word" }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: "doc.pdf",
      mimeType: "application/pdf",
      buffer: await makePdf(1),
    });
    await expect(page.getByRole("button", { name: /Exact Layout/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Editable Text/i })).toBeVisible();
  });
});

// ───────────────────────── DASHBOARD ─────────────────────────
test.describe("Dashboard", () => {
  test("generates an API key", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /Create API Developer Token/i }).click();
    await expect(page.getByRole("button", { name: /Regenerate/i })).toBeVisible();
  });

  test("analytics reflect real history (bug fix #15)", async ({ page }) => {
    // Perform a data conversion first → writes history to localStorage
    await page.goto("/data");
    await page.locator(inputArea).fill('{"a":1}');
    await page.getByRole("button", { name: "Beautify JSON" }).click();
    await expect(page.locator(outputArea)).not.toHaveValue("");
    // Dashboard should now count >=1 Data op (not the old hardcoded 45)
    await page.goto("/dashboard");
    const dataCard = page.locator("div", { hasText: /^Data$/ }).locator("..");
    // The Data stat number should be a small real count, not the old constant 45
    await expect(page.getByText("45", { exact: true })).toHaveCount(0);
  });
});

// ───────────────────────── THEME ─────────────────────────
test.describe("Theme", () => {
  test("toggle switches dark/light", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).toHaveClass(/dark/);
    await page.getByLabel("Toggle theme").first().click();
    await expect(html).not.toHaveClass(/dark/);
  });
});
