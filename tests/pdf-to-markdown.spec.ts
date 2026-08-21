import { test, expect } from "@playwright/test";
import { blockToMarkdown, escapeTableCell } from "../app/lib/pdfToMarkdown";
import type { PdfTextBlock, PdfTextItem, PdfTextLine } from "../app/lib/pdfTextExtractor";

// The full PDF-to-Markdown pipeline needs a real PDF.js parse (loading a
// document, extracting per-page text, rendering scanned pages to a canvas for
// OCR), so it's verified live in a browser rather than here — see the session
// notes for the end-to-end checks (heading detection, GFM tables, multi-page
// joining with "---", and the fix for pdf.js's spurious zero-width EOL marker
// item that was corrupting table-gap detection).
//
// What IS practical to unit test without a browser is blockToMarkdown/
// blockToMarkdownTable — pure functions that render an already-classified
// PdfTextBlock (the shared type pdfTextExtractor.ts produces for PDF → Word
// too) into Markdown text. Fixtures are built directly rather than going
// through groupIntoBlocks, to test the rendering step in isolation from the
// heading/table classification heuristics.

function makeItem(str: string, x: number, width: number, overrides: Partial<PdfTextItem> = {}): PdfTextItem {
  return { str, x, y: 100, width, height: 12, fontName: "Helvetica", fontSize: 12, hasEOL: false, ...overrides };
}

function makeLine(items: PdfTextItem[]): PdfTextLine {
  return { items, y: items[0]?.y ?? 100, height: Math.max(...items.map((i) => i.height), 12) };
}

function makeBlock(lines: PdfTextLine[], overrides: Partial<PdfTextBlock> = {}): PdfTextBlock {
  return {
    lines,
    y: lines[0]?.y ?? 100,
    height: 12,
    fontSize: 12,
    fontName: "Helvetica",
    isBold: false,
    isItalic: false,
    isHeading: false,
    isTableRow: false,
    ...overrides,
  };
}

test.describe("escapeTableCell", () => {
  test("escapes a literal pipe so it doesn't break the table syntax", () => {
    expect(escapeTableCell("A | B")).toBe("A \\| B");
  });

  test("trims surrounding whitespace", () => {
    expect(escapeTableCell("  hello  ")).toBe("hello");
  });

  test("passes plain text through unchanged", () => {
    expect(escapeTableCell("Widget")).toBe("Widget");
  });
});

test.describe("blockToMarkdown — headings", () => {
  test("a font ratio of 2.0x or more renders as H1", () => {
    const block = makeBlock([makeLine([makeItem("Title", 20, 40)])], { isHeading: true, fontSize: 24 });
    expect(blockToMarkdown(block, 12)).toBe("# Title");
  });

  test("a font ratio of 1.5x–2.0x renders as H2", () => {
    const block = makeBlock([makeLine([makeItem("Subtitle", 20, 60)])], { isHeading: true, fontSize: 18 });
    expect(blockToMarkdown(block, 12)).toBe("## Subtitle");
  });

  test("a font ratio just above 1.0x still under 1.5x renders as H3", () => {
    const block = makeBlock([makeLine([makeItem("Label", 20, 30)])], { isHeading: true, fontSize: 15 });
    expect(blockToMarkdown(block, 12)).toBe("### Label");
  });

  test("a heading spanning multiple lines is joined into one line of text", () => {
    const block = makeBlock(
      [makeLine([makeItem("Annual", 20, 40)]), makeLine([makeItem("Report", 20, 40, { y: 85 })])],
      { isHeading: true, fontSize: 24 }
    );
    expect(blockToMarkdown(block, 12)).toBe("# Annual Report");
  });
});

test.describe("blockToMarkdown — paragraphs", () => {
  test("renders plain body text unchanged", () => {
    const block = makeBlock([makeLine([makeItem("Just a normal sentence.", 20, 140)])]);
    expect(blockToMarkdown(block, 12)).toBe("Just a normal sentence.");
  });

  test("wraps bold text (font name contains 'Bold') in **", () => {
    const block = makeBlock([makeLine([makeItem("Important", 20, 60, { fontName: "Helvetica-Bold" })])]);
    expect(blockToMarkdown(block, 12)).toBe("**Important**");
  });

  test("wraps italic text (font name contains 'Italic') in *", () => {
    const block = makeBlock([makeLine([makeItem("Aside", 20, 40, { fontName: "Helvetica-Italic" })])]);
    expect(blockToMarkdown(block, 12)).toBe("*Aside*");
  });

  test("multiple lines in one paragraph block are joined with spaces, not newlines", () => {
    const block = makeBlock([
      makeLine([makeItem("First line of the paragraph", 20, 160)]),
      makeLine([makeItem("second line continues here.", 20, 160, { y: 85 })]),
    ]);
    expect(blockToMarkdown(block, 12)).toBe("First line of the paragraph second line continues here.");
  });

  test("returns an empty string for a block with no real text", () => {
    const block = makeBlock([makeLine([makeItem("   ", 20, 10)])]);
    expect(blockToMarkdown(block, 12)).toBe("");
  });
});

test.describe("blockToMarkdown — tables", () => {
  test("renders a table block as a GFM pipe table with a header separator", () => {
    const block = makeBlock(
      [
        makeLine([makeItem("Item", 20, 30), makeItem("Qty", 220, 20), makeItem("Price", 400, 30)]),
        makeLine([makeItem("Widget", 20, 40, { y: 80 }), makeItem("5", 220, 8, { y: 80 }), makeItem("$15.00", 400, 40, { y: 80 })]),
      ],
      { isTableRow: true }
    );
    expect(blockToMarkdown(block, 12)).toBe(
      "| Item | Qty | Price |\n| --- | --- | --- |\n| Widget | 5 | $15.00 |"
    );
  });

  test("escapes a literal pipe inside a table cell", () => {
    const block = makeBlock(
      [makeLine([makeItem("A | B", 20, 40), makeItem("value", 220, 30)])],
      { isTableRow: true }
    );
    expect(blockToMarkdown(block, 12)).toBe("| A \\| B | value |\n| --- | --- |");
  });

  test("pads short rows to the widest row's column count", () => {
    const block = makeBlock(
      [
        makeLine([makeItem("A", 20, 10), makeItem("B", 220, 10), makeItem("C", 400, 10)]),
        makeLine([makeItem("only-one-cell", 20, 60, { y: 80 })]),
      ],
      { isTableRow: true }
    );
    expect(blockToMarkdown(block, 12)).toBe(
      "| A | B | C |\n| --- | --- | --- |\n| only-one-cell |  |  |"
    );
  });
});
