import { test, expect } from "@playwright/test";
import { isSupportedWordFile } from "../app/lib/wordToMarkdown";

// The full docx→markdown pipeline needs a real browser (mammoth's browser build
// + DOMParser for the GFM table normalisation), so it's verified via live
// browser testing rather than here. These cover the pure file-gating logic that
// decides what the tool accepts before doing any work — a .doc slipping through
// would fail deep inside mammoth with a confusing error instead of the clear
// "save as .docx" message.
test.describe("isSupportedWordFile", () => {
  const asFile = (name: string, type = "") => new File([new Uint8Array([0])], name, { type });

  test("accepts a .docx by extension", () => {
    expect(isSupportedWordFile(asFile("report.docx"))).toBe(true);
    expect(isSupportedWordFile(asFile("REPORT.DOCX"))).toBe(true); // case-insensitive
  });

  test("accepts by the OOXML wordprocessing MIME type even without a clear extension", () => {
    expect(
      isSupportedWordFile(
        asFile("download", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
      )
    ).toBe(true);
  });

  test("rejects the legacy binary .doc", () => {
    expect(isSupportedWordFile(asFile("old.doc"))).toBe(false);
  });

  test("rejects unrelated file types", () => {
    expect(isSupportedWordFile(asFile("data.pdf", "application/pdf"))).toBe(false);
    expect(isSupportedWordFile(asFile("notes.txt", "text/plain"))).toBe(false);
  });
});
