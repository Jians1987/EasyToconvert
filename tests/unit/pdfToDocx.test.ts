import { describe, it, expect } from "vitest";
import { convertPdfToDocx } from "@/app/lib/pdfToDocx";

describe("convertPdfToDocx", () => {
  it("is a function", () => {
    expect(typeof convertPdfToDocx).toBe("function");
  });
});
