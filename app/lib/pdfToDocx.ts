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
  ImageRun,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  AlignmentType,
  ShadingType,
  convertInchesToTwip,
} from "docx";
import {
  extractPdfText,
  groupIntoLines,
  groupIntoBlocks,
  type PdfTextItem,
  type PdfTextBlock,
} from "./pdfTextExtractor";

export type DocFidelity = "layout" | "text" | "image";

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
  if (fidelity === "image") {
    return convertPdfToImageDocx(file, password, onProgress);
  }
  // ── Phase 1: Extract text with full metadata ────────────────────────────
  onProgress?.({ phase: "extract", message: "Extracting text from PDF…", percent: 5 });
  const { items: pageItems, numPages } = await extractPdfText(file, password);
  onProgress?.({ phase: "extract", message: `Extracted ${numPages} page(s)`, percent: 25 });

  // ── Phase 2: Structure detection (paragraphs, headings, tables) ─────────
  onProgress?.({ phase: "structure", message: "Analysing document structure…", percent: 30 });

  const allParagraphs: Array<Paragraph | Table> = [];

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

async function convertPdfToImageDocx(
  file: File,
  password?: string,
  onProgress?: (p: DocxProgress) => void
): Promise<Blob> {
  onProgress?.({ phase: "extract", message: "Rendering PDF pages…", percent: 5 });
  const pdfjsLib = await loadPdfJsForLayout();
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    password: password || undefined,
  }).promise;

  const sections: Array<{
    properties: { page: { size: { width: number; height: number }; margin: { top: number; right: number; bottom: number; left: number } } };
    children: Paragraph[];
  }> = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    onProgress?.({
      phase: "extract",
      message: `Rendering page ${pageNumber} of ${pdf.numPages}…`,
      percent: 5 + Math.round((pageNumber / pdf.numPages) * 75),
      page: pageNumber,
      totalPages: pdf.numPages,
    });
    const page = await pdf.getPage(pageNumber);
    const pdfViewport = page.getViewport({ scale: 1 });
    const renderViewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(renderViewport.width);
    canvas.height = Math.ceil(renderViewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas rendering is unavailable.");
    await page.render({ canvasContext: context, viewport: renderViewport }).promise;
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not render PDF page.")), "image/png");
    });

    sections.push({
      properties: {
        page: {
          size: { width: Math.round(pdfViewport.width * 20), height: Math.round(pdfViewport.height * 20) },
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
        },
      },
      children: [new Paragraph({
        spacing: { before: 0, after: 0, line: 1 },
        children: [new ImageRun({
          type: "png",
          data: new Uint8Array(await png.arrayBuffer()),
          transformation: {
            width: Math.floor(pdfViewport.width * 4 / 3) - 1,
            height: Math.floor(pdfViewport.height * 4 / 3) - 1,
          },
          altText: { title: `PDF page ${pageNumber}`, description: "Exact visual rendering of the original PDF page", name: `Page ${pageNumber}` },
        })],
      })],
    });
  }

  onProgress?.({ phase: "generate", message: "Generating exact-layout Word document…", percent: 90 });
  const blob = await Packer.toBlob(new Document({ sections }));
  onProgress?.({ phase: "done", message: "Exact-layout Word document ready", percent: 100 });
  return blob;
}

function loadPdfJsForLayout(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && (window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve((window as any).pdfjsLib);
    };
    script.onerror = () => reject(new Error("Failed to load PDF.js engine."));
    document.head.appendChild(script);
  });
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
            ? { fill: "F2F2F2", type: ShadingType.CLEAR }
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
