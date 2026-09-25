import { describe, it, expect } from "vitest";
import { looksScanned } from "@/app/lib/ocr";

describe("looksScanned", () => {
  it("returns true for empty string", () => {
    expect(looksScanned("")).toBe(true);
  });

  it("returns true for whitespace-only string", () => {
    expect(looksScanned("   \n\t  ")).toBe(true);
  });

  it("returns true when non-whitespace characters are fewer than 10", () => {
    expect(looksScanned("abc def")).toBe(true); // 6 non-whitespace chars
  });

  it("returns false when non-whitespace characters are 10 or more", () => {
    expect(looksScanned("Hello World!!")).toBe(false); // 12 non-whitespace chars
  });

  it("returns false for normal extracted text", () => {
    const text = "This is a normal PDF with plenty of extracted text content.";
    expect(looksScanned(text)).toBe(false);
  });
});
