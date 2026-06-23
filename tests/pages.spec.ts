import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

const PNG_1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const inputArea = "textarea:not([readonly])";
const outputArea = "textarea[readonly]";
const png = () => ({ name: "test.png", mimeType: "image/png", buffer: Buffer.from(PNG_1x1, "base64") });
async function pdf(pages = 1): Promise<Buffer> {
  const d = await PDFDocument.create();
  for (let i = 0; i < pages; i++) d.addPage([300, 400]);
  return Buffer.from(await d.save());
}

// ───────────── Smoke: every route renders without crashing ─────────────
test.describe("All routes load", () => {
  const routes = [
    ["/", /Smart File Conversion/i],
    ["/pdf", /PDF Suite Tools/i],
    ["/image", /Image Studio Tools/i],
    ["/data", /Data Hub Converters/i],
    ["/developer", /Developer Utilities Core/i],
    ["/javascript", /Code & Styling Utilities/i],
    ["/ai", /AI Productivity Suite/i],
    ["/media", /Video & Audio Studio/i],
    ["/dashboard", /User Dashboard/i],
    ["/about", /About Easytoconvert/i],
    ["/contact", /Contact Us/i],
    ["/blog", /Articles & Guides/i],
    ["/api-docs", /Developer API/i],
  ] as const;

  for (const [route, heading] of routes) {
    test(`${route} renders its heading with no console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(route);
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
      expect(errors, errors.join("\n")).toEqual([]);
    });
  }
});

// ───────────── Navbar ─────────────
test.describe("Navbar", () => {
  test("desktop nav links navigate", async ({ page }) => {
    await page.goto("/");
    // The top navbar is the fixed <nav>; ToolLayout also renders a sidebar <nav>.
    const topnav = page.locator("nav.fixed");
    await topnav.getByRole("link", { name: "PDF", exact: true }).click();
    await expect(page).toHaveURL(/\/pdf$/);
    await topnav.getByRole("link", { name: "Data", exact: true }).click();
    await expect(page).toHaveURL(/\/data$/);
  });

  test("quick-search dropdown lists matches", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("Quick find tool...").fill("base64");
    await expect(page.getByRole("link", { name: /Base64 Encoder/i })).toBeVisible();
  });

  test("mobile menu opens and navigates", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/");
    // hamburger is the only icon button without a label in the mobile bar
    await page.locator("nav button").last().click();
    const link = page.getByRole("link", { name: "Image Tools" });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/image$/);
  });
});

// ───────────── Footer ─────────────
test.describe("Footer", () => {
  test("platform links navigate", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "About Us" }).click();
    await expect(page).toHaveURL(/\/about$/);
    await page.getByRole("link", { name: "API Documentation" }).click();
    await expect(page).toHaveURL(/\/api-docs$/);
    await page.getByRole("link", { name: "Blog" }).click();
    await expect(page).toHaveURL(/\/blog$/);
  });
});

// ───────────── Home ─────────────
test.describe("Home", () => {
  test("tool chips now navigate to their hub (dead-control fix)", async ({ page }) => {
    await page.goto("/");
    // the category chip appears before the footer link of the same name
    await page.getByRole("link", { name: "JSON Formatter", exact: true }).first().click();
    await expect(page).toHaveURL(/\/data$/);
  });

  test("Launch buttons + CTA links work", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Launch PDF Utilities/i }).click();
    await expect(page).toHaveURL(/\/pdf$/);
    await page.goto("/");
    await page.getByRole("link", { name: "Go to Dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("no longer advertises the missing Background Remover", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Background Remover")).toHaveCount(0);
  });

  test("landing copy lists only shipped tools (no aspirational names)", async ({ page }) => {
    await page.goto("/");
    for (const gone of [
      "AI OCR Extractor",
      "AI Resume Analyzer",
      "JWT Decoder",
      "Hash Generator",
      "JSON Diff Checker",
    ]) {
      await expect(page.getByText(gone, { exact: true })).toHaveCount(0);
    }
    // shipped replacements are present and clickable
    for (const shipped of ["URL Encoder", "Password Maker", "Document Translator", "JSON Minifier", "Box Shadow"]) {
      await expect(page.getByRole("link", { name: shipped, exact: true })).toBeVisible();
    }
  });

  test("Video & Audio is live (no Coming Soon badge)", async ({ page }) => {
    await page.goto("/");
    const card = page.locator("div").filter({ hasText: /^Video & Audio/ }).first();
    await expect(card.getByText("Soon", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Extract Audio", exact: true }).first()).toBeVisible();
  });
});

// ───────────── Contact form ─────────────
test.describe("Contact", () => {
  test("valid submission shows success state", async ({ page }) => {
    await page.goto("/contact");
    await page.getByPlaceholder("Jane Doe").fill("Test User");
    await page.getByPlaceholder("jane@company.com").fill("test@example.com");
    await page.getByPlaceholder("How can we help?").fill("This is a test message.");
    await page.getByRole("button", { name: /Submit Message/i }).click();
    await expect(page.getByText(/Message Received/i)).toBeVisible();
  });
});

// ───────────── Blog ─────────────
test.describe("Blog", () => {
  test("Read Article navigates (dead-control fix)", async ({ page }) => {
    await page.goto("/blog");
    await page.getByRole("link", { name: /Read Article/i }).first().click();
    await expect(page).toHaveURL(/\/image$/);
  });
});

// ───────────── API docs ─────────────
test.describe("API docs", () => {
  test("language tabs swap the snippet and copy works", async ({ page }) => {
    await page.goto("/api-docs");
    await expect(page.locator("pre")).toContainText("curl");
    await page.getByRole("button", { name: "NodeJS" }).click();
    await expect(page.locator("pre")).toContainText("axios");
    await page.getByRole("button", { name: "python" }).click();
    await expect(page.locator("pre")).toContainText("requests");
    await page.locator("pre ~ button, .relative > button").first().click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain("requests");
  });
});

// ───────────── AI tools (SafeMarkdown render) ─────────────
test.describe("AI tools", () => {
  test("code explainer renders analysis output", async ({ page }) => {
    await page.goto("/ai");
    await page.getByRole("button", { name: "AI Code Explainer" }).click();
    await page.locator(inputArea).fill("function add(a,b){ return a+b; }");
    await page.getByRole("button", { name: /Run AI explain/i }).click();
    await expect(page.getByText(/Code Analysis/i)).toBeVisible();
    await expect(page.getByText(/Total Lines/i)).toBeVisible();
  });

  test("translator renders translation preview", async ({ page }) => {
    await page.goto("/ai");
    await page.getByRole("button", { name: "Document Translator" }).click();
    await page.locator(inputArea).fill("Hello world");
    await page.getByRole("button", { name: /Run AI translate/i }).click();
    // scope to the output panel — the engine banner also mentions "translation previews"
    await expect(page.locator(".prose").getByText(/Translation Preview/i)).toBeVisible();
  });

  test("summarize button is disabled until a file is chosen", async ({ page }) => {
    await page.goto("/ai");
    await expect(page.getByRole("button", { name: /Run AI summarize/i })).toBeDisabled();
  });

  test("Image OCR extracts text from an image on-device (Tesseract.js)", async ({ page }) => {
    test.setTimeout(200000); // first run downloads the OCR model from CDN
    await page.goto("/ai");
    await page.getByRole("button", { name: "Image OCR" }).click();
    // draw a clear text image and feed it to the dropzone's file input
    await page.evaluate(async () => {
      const c = document.createElement("canvas"); c.width = 640; c.height = 200;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 640, 200);
      ctx.fillStyle = "#000000"; ctx.font = "bold 72px Arial";
      ctx.fillText("HELLO WORLD", 30, 130);
      const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
      const file = new File([blob], "text.png", { type: "image/png" });
      const dt = new DataTransfer(); dt.items.add(file);
      const input = document.querySelector('input[type=file]') as HTMLInputElement;
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.getByRole("button", { name: /Extract Text \(OCR\)/i }).click();
    await page.getByText(/Extracted Text/i).waitFor({ timeout: 180000 });
    const out = (await page.locator(".prose").innerText()).toUpperCase();
    expect(out).toContain("HELLO");
  });
});

// ───────────── Media (FFmpeg WebAssembly) ─────────────
function makeWav(seconds = 1, freq = 440, rate = 8000): Buffer {
  const samples = seconds * rate, dataSize = samples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + dataSize, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 30000), 44 + i * 2);
  return buf;
}

test.describe("Media (FFmpeg)", () => {
  test("tabs switch, engine banner + dropzone present (no more Coming Soon)", async ({ page }) => {
    await page.goto("/media");
    await expect(page.getByText(/Coming Soon/i)).toHaveCount(0);
    await expect(page.getByText(/FFmpeg WebAssembly Engine/i)).toBeVisible();
    await expect(page.locator('input[type=file]')).toHaveCount(1);
    await page.getByRole("button", { name: "Extract Audio" }).click();
    await page.getByRole("button", { name: "Audio Cutter" }).click();
    await expect(page.getByRole("button", { name: "Media Compressor" })).toBeVisible();
  });

  test("compresses a WAV to a real MP3 via FFmpeg.wasm", async ({ page }) => {
    test.setTimeout(200000); // first run downloads the ~25MB engine from CDN
    await page.goto("/media");
    await page.locator('input[type=file]').setInputFiles({ name: "tone.wav", mimeType: "audio/wav", buffer: makeWav(1) });
    await page.getByRole("button", { name: /Compress Media/i }).click();
    const dl = page.getByRole("link", { name: /Download/i });
    await dl.waitFor({ timeout: 180000 });
    const href = await dl.getAttribute("href");
    const info = await page.evaluate(async (url) => {
      const r = await fetch(url!); const u = new Uint8Array(await r.arrayBuffer());
      return { size: u.length, id3: u[0] === 0x49 && u[1] === 0x44 && u[2] === 0x33, frame: u[0] === 0xff && (u[1] & 0xe0) === 0xe0 };
    }, href);
    expect(info.size).toBeGreaterThan(0);
    expect(info.id3 || info.frame).toBe(true); // valid MP3 bitstream
  });
});

// ───────────── Dashboard ─────────────
test.describe("Dashboard", () => {
  test("API key generate → reveal → regenerate", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /Create API Developer Token/i }).click();
    await expect(page.getByText(/^•+$/)).toBeVisible(); // masked
    await page.locator("div.font-mono button").first().click(); // reveal (Eye)
    await expect(page.getByText(/^ehp_/)).toBeVisible();
    await page.getByRole("button", { name: /Regenerate/i }).click();
    await expect(page.getByText(/^ehp_/)).toBeVisible();
  });

  test("clear history empties the table", async ({ page }) => {
    // create one history entry
    await page.goto("/data");
    await page.locator(inputArea).fill('{"a":1}');
    await page.getByRole("button", { name: "Beautify JSON" }).click();
    await expect(page.locator(outputArea)).not.toHaveValue("");
    await page.goto("/dashboard");
    await expect(page.getByText(/Local Download History/i)).toBeVisible();
    await page.getByRole("button", { name: /Clear History/i }).click();
    await expect(page.getByText(/No downloads in history/i)).toBeVisible();
  });

  test("quick conversion hub links navigate", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: /Image Studio/i }).click();
    await expect(page).toHaveURL(/\/image$/);
  });
});

// ───────────── Image: remaining modes ─────────────
test.describe("Image modes", () => {
  test("compress produces a download", async ({ page }) => {
    await page.goto("/image");
    await page.getByRole("button", { name: "compress" }).click();
    await page.locator('input[type=file]').setInputFiles(png());
    await page.getByRole("button", { name: /Apply Image compress/i }).click();
    await expect(page.getByRole("link", { name: /Download Image/i })).toBeVisible();
  });

  test("resize with explicit dimensions produces a download", async ({ page }) => {
    await page.goto("/image");
    await page.getByRole("button", { name: "resize" }).click();
    await page.locator('input[type=file]').setInputFiles(png());
    await page.locator('input[type=number]').first().fill("50");
    await page.getByRole("button", { name: /Apply Image resize/i }).click();
    await expect(page.getByRole("link", { name: /Download Image/i })).toBeVisible();
  });
});

// ───────────── PDF: remaining modes (pure pdf-lib, no CDN) ─────────────
test.describe("PDF modes", () => {
  test("rotate produces a download", async ({ page }) => {
    await page.goto("/pdf");
    await page.getByRole("button", { name: "Rotate PDF" }).click();
    await page.locator('input[type=file]').setInputFiles({ name: "r.pdf", mimeType: "application/pdf", buffer: await pdf(1) });
    await page.getByRole("button", { name: /Apply PDF rotate/i }).click();
    await expect(page.getByRole("link", { name: /Download File/i })).toBeVisible({ timeout: 15000 });
  });

  test("split produces a download", async ({ page }) => {
    await page.goto("/pdf");
    await page.getByRole("button", { name: "Split PDF" }).click();
    await page.locator('input[type=file]').setInputFiles({ name: "s.pdf", mimeType: "application/pdf", buffer: await pdf(3) });
    await page.getByRole("button", { name: /Apply PDF split/i }).click();
    await expect(page.getByRole("link", { name: /Download File/i })).toBeVisible({ timeout: 15000 });
  });

  test("PDF Editor stamps text and produces a download", async ({ page }) => {
    await page.goto("/pdf");
    await page.getByRole("button", { name: "PDF Editor" }).click();
    await page.locator('input[type=file]').setInputFiles({ name: "e.pdf", mimeType: "application/pdf", buffer: await pdf(1) });
    const preview = page.locator('img[alt="Page 1"]');
    await preview.waitFor({ timeout: 30000 });
    await page.getByPlaceholder(/Type the text to stamp/i).fill("Approved");
    await preview.click({ position: { x: 50, y: 60 } });
    // a removable marker appears for the placed text
    await expect(page.locator('button[title="Click to remove this text"]')).toHaveCount(1);
    await page.getByRole("button", { name: /Apply Edits & Download/i }).click();
    await expect(page.getByRole("link", { name: /Download File/i })).toBeVisible({ timeout: 15000 });
  });

  test("protect requires a label then produces a download", async ({ page }) => {
    await page.goto("/pdf");
    await page.getByRole("button", { name: "Protect PDF" }).click();
    await page.locator('input[type=file]').setInputFiles({ name: "p.pdf", mimeType: "application/pdf", buffer: await pdf(1) });
    const apply = page.getByRole("button", { name: /Apply PDF protect/i });
    await expect(apply).toBeDisabled(); // disabled without a label
    await page.getByPlaceholder(/Confidential/i).fill("Internal");
    await apply.click();
    await expect(page.getByRole("link", { name: /Download File/i })).toBeVisible({ timeout: 15000 });
  });
});

// ───────────── JavaScript: remaining modes ─────────────
test.describe("JS/CSS modes", () => {
  test("box-shadow generator outputs css", async ({ page }) => {
    await page.goto("/javascript");
    await page.getByRole("button", { name: "Box Shadow" }).click();
    await expect(page.getByText(/box-shadow:/)).toBeVisible();
  });

  test("CSS minify collapses whitespace", async ({ page }) => {
    await page.goto("/javascript");
    await page.getByRole("button", { name: "Minifier" }).click();
    await page.getByRole("button", { name: "CSS", exact: true }).click();
    await page.locator(inputArea).fill("a {\n  color: red;\n}");
    await page.getByRole("button", { name: /Apply CSS Minification/i }).click();
    // valid minified CSS; the trailing ';' is harmless and may be kept
    expect(await page.locator(outputArea).inputValue()).toMatch(/^a\{color:red;?\}$/);
  });
});
