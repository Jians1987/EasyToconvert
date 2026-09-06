import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { convertMarkdownToPdf } from "../app/lib/markdownToPdf";

// markdownToPdf.ts has zero DOM dependencies (only pdf-lib + marked, both
// Node-compatible), unlike wordToMarkdown.ts (needs mammoth's browser build +
// DOMParser) or pdfToMarkdown.ts (needs a real PDF.js Worker parse) — so
// unlike those two, the FULL pipeline is testable here directly, not just its
// pure helper functions. We lean on pdfjs-dist's legacy Node build to extract
// real text back out of the generated PDF and assert on actual content,
// rather than only checking "it didn't throw".
async function extractAllText(bytes: Uint8Array): Promise<{ pageCount: number; pageTexts: string[] }> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Each word is drawn as its own text-item (see drawWrappedWords), so
    // pdf.js sometimes reports the inter-word gap as more than one literal
    // space character even though it renders as a normal single space
    // on-page. Collapse runs of whitespace before asserting on content —
    // this is exactly what a real search/copy-paste over the PDF would see.
    const raw = content.items.map((it: any) => it.str).join(" ");
    pageTexts.push(raw.replace(/\s+/g, " ").trim());
  }
  return { pageCount: pdf.numPages, pageTexts };
}

test.describe("convertMarkdownToPdf", () => {
  test("renders a heading, paragraph, and inline formatting", async () => {
    const md = "# Title\n\nA paragraph with **bold** and *italic* and `code`.";
    const bytes = await convertMarkdownToPdf(md);
    const { pageCount, pageTexts } = await extractAllText(bytes);
    expect(pageCount).toBe(1);
    expect(pageTexts[0]).toContain("Title");
    expect(pageTexts[0]).toContain("bold");
    expect(pageTexts[0]).toContain("italic");
    expect(pageTexts[0]).toContain("code");
  });

  test("renders a GFM table with every cell present", async () => {
    const md = "| Item | Price |\n| --- | --- |\n| Widget | $15.00 |\n| Gadget | $22.50 |";
    const bytes = await convertMarkdownToPdf(md);
    const { pageTexts } = await extractAllText(bytes);
    const text = pageTexts.join(" ");
    expect(text).toContain("Item");
    expect(text).toContain("Price");
    expect(text).toContain("Widget");
    expect(text).toContain("$15.00");
    expect(text).toContain("Gadget");
    expect(text).toContain("$22.50");
  });

  test("renders bullet and ordered lists, including task-list checkboxes", async () => {
    const md = "- First item\n- Second item\n\n1. Step one\n2. Step two\n\n- [ ] Todo\n- [x] Done";
    const bytes = await convertMarkdownToPdf(md);
    const { pageTexts } = await extractAllText(bytes);
    const text = pageTexts.join(" ");
    expect(text).toContain("First item");
    expect(text).toContain("Second item");
    expect(text).toContain("Step one");
    expect(text).toContain("[ ]");
    expect(text).toContain("[x]");
  });

  test("renders a fenced code block's content verbatim", async () => {
    const md = "```\nfunction hello() {\n  return 42;\n}\n```";
    const bytes = await convertMarkdownToPdf(md);
    const { pageTexts } = await extractAllText(bytes);
    expect(pageTexts[0]).toContain("function hello()");
    expect(pageTexts[0]).toContain("return 42;");
  });

  test("renders a blockquote's text and a link as text followed by its URL", async () => {
    const md = "> A quoted line.\n\nSee [the docs](https://example.com/docs) for more.";
    const bytes = await convertMarkdownToPdf(md);
    const { pageTexts } = await extractAllText(bytes);
    const text = pageTexts.join(" ");
    expect(text).toContain("A quoted line.");
    expect(text).toContain("the docs");
    expect(text).toContain("https://example.com/docs");
  });

  test("paginates a long document across multiple pages without losing content", async () => {
    const sections = Array.from(
      { length: 30 },
      (_, i) =>
        `## Section ${i + 1}\n\nParagraph content for section ${i + 1}, long enough to wrap across several lines and contribute meaningfully to the total page height so the document is forced past a single page.`
    ).join("\n\n");
    const bytes = await convertMarkdownToPdf(sections);
    const { pageCount, pageTexts } = await extractAllText(bytes);
    expect(pageCount).toBeGreaterThan(1);
    const allText = pageTexts.join(" ");
    // First and last sections must both be present — proves no content was
    // dropped or overwritten across the page-break boundary.
    expect(allText).toContain("Section 1");
    expect(allText).toContain("Section 30");
  });

  test("honours the page-size option (A4 vs Letter produce different dimensions)", async () => {
    const md = "# Sizing Test";
    const a4Bytes = await convertMarkdownToPdf(md, { pageSize: "a4" });
    const letterBytes = await convertMarkdownToPdf(md, { pageSize: "letter" });

    const a4Doc = await PDFDocument.load(a4Bytes);
    const letterDoc = await PDFDocument.load(letterBytes);
    const a4Size = a4Doc.getPage(0).getSize();
    const letterSize = letterDoc.getPage(0).getSize();

    expect(Math.round(a4Size.width)).toBe(595);
    expect(Math.round(letterSize.width)).toBe(612);
    expect(a4Size.width).not.toBe(letterSize.width);
  });

  test("produces a valid, openable PDF for empty or whitespace-only input", async () => {
    const bytes = await convertMarkdownToPdf("   \n\n  ");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  test("defaults to A4 when no page size is specified", async () => {
    const bytes = await convertMarkdownToPdf("# Default size");
    const doc = await PDFDocument.load(bytes);
    expect(Math.round(doc.getPage(0).getSize().width)).toBe(595);
  });
});
