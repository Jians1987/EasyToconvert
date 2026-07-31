import { test, expect } from "@playwright/test";
import { ocrProviderLabel, looksScanned } from "../app/lib/ocr";

// Pure unit tests — no server, no network. These guard the copy-facing bits of
// the OCR client directly, since a stale/wrong label here means the UI lies
// about which service actually processed the user's document.
test.describe("ocrProviderLabel", () => {
  test("maps known provider ids to their vendor label", () => {
    expect(ocrProviderLabel("kimi")).toBe("Kimi Vision (Moonshot AI)");
    expect(ocrProviderLabel("local")).toBe("Unlimited-OCR (self-hosted)");
    expect(ocrProviderLabel("mistral")).toBe("Mistral OCR");
  });

  test("falls back to a generic label for unknown or missing providers", () => {
    expect(ocrProviderLabel(undefined)).toBe("Cloud OCR");
    expect(ocrProviderLabel("some-future-provider")).toBe("Cloud OCR");
  });
});

test.describe("looksScanned", () => {
  test("flags empty or near-empty text as scanned", () => {
    expect(looksScanned("")).toBe(true);
    expect(looksScanned("   \n\t  ")).toBe(true);
    expect(looksScanned("a b")).toBe(true); // 2 non-space chars < 10
  });

  test("does not flag a normal page of text as scanned", () => {
    expect(looksScanned("This is a real paragraph of extracted PDF text.")).toBe(false);
  });
});
