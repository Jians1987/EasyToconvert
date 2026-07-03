/**
 * pdfToDocx.ts
 * Rich PDF to Word converter with structured output.
 *
 * Features:
 * - Paragraph detection via vertical gap analysis
 * - Heading styles (H1, H2, H3) via font-size threshold
 * - Bold / italic preservation from font name hints
 * - Table blocks converted to native Word tables
 * - Progress callbacks for UI feedback
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  AlignmentType,
  convertInchesToTwip,
} from "docx";
import {
  extractPdfText,
  groupIntoLines,
  groupIntoBlocks,
  type PdfTextItem,
  type PdfTextBlock,
} from "./pdfTextExtractor";

export type DocFidelity = "layout" | "text";

export interface DocxProgress {
  phase: "extract" | "structure" | "generate" | "done";
  message: string;
  percent: number;
  page?: number;
  totalPages?: number;
}

/**
 * Convert a PDF file to a richly-formatted Word document.
 */
export async function convertPdfToDocx(
  file: File,
  fidelity: DocFidelity = "layout",
  password?: string,
  onProgress?: (p: DocxProgress) => void
): Promise<Blob> {
  // ── Phase 1: Extract text with full metadata ────────────────────────────
  onProgress?.({ phase: "extract", message: "Extracting text from PDF…", percent: 5 });
  const { items: pageItems, numPages } = await extractPdfText(file, password);
  onProgress?.({ phase: "extract", message: `Extracted ${numPages} page(s)`, percent: 25 });

  // ── Phase 2: Structure detection (paragraphs, headings, tables) ─────────
  onProgress?.({ phase: "structure", message: "Analysing document structure…", percent: 30 });

  const allParagraphs: Paragraph[] = [];

  for (let pageIdx = 0; pageIdx < pageItems.length; pageIdx++) {
    onProgress?.({
      phase: "structure",
      message: `Analysing page ${pageIdx + 1} of ${numPages}…`,
      percent: 30 + Math.round((pageIdx / numPages) * 30),
      page: pageIdx + 1,
      totalPages: numPages,
    });

    const pageItemList = pageItems[pageIdx];
    if (pageItemList.length === 0) continue;

    if (fidelity === "text") {
      // Plain text mode — just concatenate all text
      const text = pageItemList.map((i) => i.str).join(" ");
      if (text.trim()) {
        allParagraphs.push(
          new Paragraph({
            children: [new TextRun({ text: text.trim(), font: "Calibri" })],
            spacing: { after: convertInchesToTwip(0.15) },
          })
        );
      }
    } else {
      // Layout mode — detect paragraphs, headings, tables
      const lines = groupIntoLines(pageItemList);
      const blocks = groupIntoBlocks(lines);

      for (const block of blocks) {
        const para = blockToParagraph(block);
        if (para) allParagraphs.push(para);
      }
    }
  }

  onProgress?.({ phase: "structure", message: `Found ${allParagraphs.length} paragraph(s)`, percent: 60 });

  // ── Phase 3: Generate DOCX ──────────────────────────────────────────────
  onProgress?.({ phase: "generate", message: "Generating Word document…", percent: 65 });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children: allParagraphs,
      },
    ],
  });

  onProgress?.({ phase: "generate", message: "Packing document…", percent: 90 });
  const blob = await Packer.toBlob(doc);

  onProgress?.({ phase: "done", message: "Word document ready", percent: 100 });
  return blob;
}

/**
 * Convert a PdfTextBlock into a properly styled docx Paragraph or Table.
 */
function blockToParagraph(block: PdfTextBlock): Paragraph | Table | null {
  const text = block.lines
    .flatMap((l) => l.items.map((i) => i.str))
    .join(" ")
    .trim();

  if (!text) return null;

  // Table block → Word table
  if (block.isTableRow && block.lines.length >= 2) {
    return gridToDocxTable(block);
  }

  // Heading detection
  if (block.isHeading) {
    const level =
      block.fontSize > block.lines[0]?.items[0]?.fontSize * 1.6
        ? HeadingLevel.HEADING_1
        : block.fontSize > block.lines[0]?.items[0]?.fontSize * 1.3
          ? HeadingLevel.HEADING_2
          : HeadingLevel.HEADING_3;

    return new Paragraph({
      heading: level,
      children: [
        new TextRun({
          text,
          bold: true,
          font: "Calibri",
        }),
      ],
      spacing: { before: convertInchesToTwip(0.2), after: convertInchesToTwip(0.1) },
    });
  }

  // Regular paragraph — preserve inline bold/italic from font names
  const children: TextRun[] = [];
  for (const line of block.lines) {
    for (const item of line.items) {
      const itemText = item.str.trim();
      if (!itemText) continue;

      const fontNameLower = item.fontName.toLowerCase();
      const isBold = fontNameLower.includes("bold") || block.isBold;
      const isItalic = fontNameLower.includes("italic") || fontNameLower.includes("oblique") || block.isItalic;
      const fontSizePt = Math.round(item.fontSize * 10) / 10;

      children.push(
        new TextRun({
          text: itemText + (item.hasEOL ? " " : ""),
          bold: isBold,
          italics: isItalic,
          font: "Calibri",
          size: Math.max(10, Math.min(fontSizePt * 2, 72)) * 2, // half-points
        })
      );
    }
  }

  if (children.length === 0) return null;

  return new Paragraph({
    children,
    spacing: { after: convertInchesToTwip(0.12) },
    alignment: AlignmentType.JUSTIFIED,
  });
}

/**
 * Convert a table-detected block into a native Word Table.
 */
function gridToDocxTable(block: PdfTextBlock): Table {
  // Build a grid from the block's lines
  const grid: string[][] = [];

  for (const line of block.lines) {
    const cells: string[] = [];
    // Cluster items in the line by horizontal gaps
    const items = [...line.items].sort((a, b) => a.x - b.x);
    if (items.length === 0) continue;

    const gaps: number[] = [];
    for (let i = 1; i < items.length; i++) {
      gaps.push(items[i].x - (items[i - 1].x + items[i - 1].width));
    }

    if (gaps.length === 0) {
      cells.push(items[0].str);
    } else {
      // Use median gap as column separator threshold
      const sortedGaps = [...gaps].sort((a, b) => a - b);
      const medianGap = sortedGaps[Math.floor(sortedGaps.length / 2)] || 12;
      const threshold = medianGap * 0.8;

      let currentCell = items[0].str;
      for (let i = 1; i < items.length; i++) {
        if (gaps[i - 1] > threshold) {
          cells.push(currentCell);
          currentCell = items[i].str;
        } else {
          currentCell += " " + items[i].str;
        }
      }
      cells.push(currentCell);
    }

    if (cells.length > 0) grid.push(cells);
  }

  if (grid.length === 0) {
    // Fallback: just return the text as a paragraph
    const text = block.lines.flatMap((l) => l.items.map((i) => i.str)).join(" ");
    return new Table({
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text, font: "Calibri" })] })],
            }),
          ],
        }),
      ],
    });
  }

  // Normalize column count
  const maxCols = Math.max(...grid.map((r) => r.length));
  const normalizedGrid = grid.map((row) => {
    const padded = [...row];
    while (padded.length < maxCols) padded.push("");
    return padded;
  });

  // Detect header row (first row, often bold or different font)
  const hasHeader = block.lines.length > 1 && block.lines[0].items.some((i) => i.fontName.toLowerCase().includes("bold"));

  const tableRows: TableRow[] = normalizedGrid.map((row, ri) => {
    const isHeaderRow = hasHeader && ri === 0;

    return new TableRow({
      children: row.map((cellText) => {
        return new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: cellText,
                  bold: isHeaderRow,
                  font: "Calibri",
                  size: 22, // 11pt
                }),
              ],
            }),
          ],
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          },
          shading: isHeaderRow
            ? { fill: "F2F2F2", val: "clear" }
            : undefined,
          width: { size: 100 / maxCols, type: WidthType.PERCENTAGE },
        });
      }),
    });
  });

  return new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}
