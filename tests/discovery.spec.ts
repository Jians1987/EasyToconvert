import { test, expect } from "@playwright/test";

test("palette supports shortcuts, fuzzy search, navigation, focus restoration and empty results", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Search tools", exact: true });
  await trigger.focus();
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog");
  const search = dialog.getByRole("combobox");
  await expect(search).toBeFocused();
  await search.fill("jfmt");
  await expect(dialog.getByRole("option", { name: /JSON Format/ })).toBeVisible();
  await search.fill("no-such-tool-987654");
  await expect(dialog.getByText(/No tools found/)).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Meta+k");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Meta+k");
  await expect(dialog).not.toBeVisible();
  await trigger.click();
  await search.fill("uuid");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/developer#uuid$/);
  await expect(page.getByRole("button", { name: /Generate 5 UUIDs/ })).toBeVisible();
  // Selecting a second tool in the same route must change its mode as well.
  await page.keyboard.press("Control+k");
  await search.fill("password");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/developer#password$/);
  await expect(page.getByRole("button", { name: /Generate Password/ })).toBeVisible();
});

test("file type fallback and unsupported files are announced", async ({ page }) => {
  await page.goto("/");
  const input = page.getByLabel("Choose a file to convert");
  await input.setInputFiles({ name: "CONTRACT.PDF", mimeType: "", buffer: Buffer.from("%PDF-1.7") });
  await expect(page.getByRole("button", { name: /Extract Tables/ })).toBeVisible();
  await input.setInputFiles({ name: "archive.zip", mimeType: "application/zip", buffer: Buffer.from("zip") });
  await expect(page.getByRole("status").getByText(/isn’t supported/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Extract Tables/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Clear selected file" }).click();
  await expect(page.getByText("archive.zip", { exact: false })).toHaveCount(0);
});

test("dropping JSON keeps the file in memory and opens the formatter", async ({ page }) => {
  await page.goto("/");
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(new File(['{"answer":42}'], "sample.json", { type: "application/json" }));
    return data;
  });
  const zone = page.getByRole("button", { name: /Drop any file/ });
  await zone.dispatchEvent("dragenter", { dataTransfer: transfer });
  await expect(page.getByRole("button", { name: "Format & Beautify" })).toBeDisabled();
  await zone.dispatchEvent("drop", { dataTransfer: transfer });
  await page.getByRole("button", { name: "Format & Beautify" }).click();
  await expect(page).toHaveURL(/\/data#json-format$/);
  await expect(page.locator("textarea").first()).toHaveValue('{"answer":42}');
  await page.getByRole("button", { name: "Beautify JSON" }).click();
  await expect(page.locator("textarea").last()).toHaveValue('{\n  "answer": 42\n}');
});

test("image handoff selects the intended mode and mobile palette fits", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.screenshot({ path: "test-results/home-mobile.png", fullPage: false });
  await page.getByLabel("Choose a file to convert").setInputFiles({ name: "pixel.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64") });
  await page.getByRole("button", { name: "Resize", exact: true }).click();
  await expect(page).toHaveURL(/\/image#resize$/);
  await expect(page.getByText("pixel.png", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Search tools", exact: true }).click();
  await expect(page.getByRole("combobox")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Close tool search" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("combobox")).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
