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
  groupIntoLines,
  groupIntoBlocks,
  detectColumns,
  type PdfTextItem,
} from "./pdfTextExtractor";

// layout: structured editable output — paragraph detection, headings, bold/italic, tables.
//         Scanned pages are automatically OCR'd if ocrFallback is not "none".
// image:  pixel-perfect image embed per page — exact visual, not editable.
// text:   plain text concatenation — simple and fast.
export type DocFidelity = "layout" | "text" | "image";

export interface DocxProgress {
  phase: "extract" | "structure" | "generate" | "done";
  message: string;
  percent: number;
  page?: number;
  totalPages?: number;
}

export interface ConvertDocxOptions {
  imageScale?: number;         // render scale for image mode — 2=standard, 3=Pro quality
  ocrFallback?: "none" | "unlimited"; // "unlimited"=Baidu Unlimited OCR
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function convertPdfToDocx(
  file: File,
  fidelity: DocFidelity = "layout",
  password?: string,
  onProgress?: (p: DocxProgress) => void,
  options?: ConvertDocxOptions
): Promise<Blob> {
  const scale = options?.imageScale ?? 2;
  const ocrFallback = options?.ocrFallback ?? "none";

  if (fidelity === "image") {
    return convertToImageDocx(file, password, onProgress, scale);
  }

  // Load PDF.js ONCE — reuse for text extraction AND rendering of scanned pages.
  onProgress?.({ phase: "extract", message: "Loading PDF…", percent: 3 });
  const pdfjsLib = await loadPdfJs();
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    password: password || undefined,
  }).promise;

  const numPages: number = pdf.numPages;
  const allElements: Array<Paragraph | Table> = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const basePercent = 5 + Math.round(((pageNum - 1) / numPages) * 80);
    onProgress?.({
      phase: "extract",
      message: `Analysing page ${pageNum} of ${numPages}…`,
      percent: basePercent,
      page: pageNum,
      totalPages: numPages,
    });

    const page = await pdf.getPage(pageNum);

    // ── Extract embedded text ──────────────────────────────────────────────
    const textItems = await extractPageTextItems(page);
    const pageText = textItems.map((i) => i.str).join("");
    const isScanned = looksScanned(pageText);

    if (!isScanned) {
      // ── Structured text extraction ─────────────────────────────────────
      const elements =
        fidelity === "text"
          ? buildPlainTextParagraphs(textItems)
          : buildStructuredElements(textItems);

      allElements.push(...elements);
    } else if (ocrFallback !== "none") {
      // ── Scanned page: render → Unlimited OCR → Word paragraphs ────────
      onProgress?.({
        phase: "extract",
        message: `Page ${pageNum}: scanned — rendering for Unlimited OCR…`,
        percent: basePercent,
        page: pageNum,
        totalPages: numPages,
      });

      const canvas = await renderPdfJsPageToCanvas(page, 3.0);

      onProgress?.({
        phase: "extract",
        message: `Page ${pageNum}: Baidu Unlimited OCR…`,
        percent: basePercent + 1,
        page: pageNum,
        totalPages: numPages,
      });
      const { ocrImageWithUnlimitedOcr } = await import("./ocr");
      const result = await ocrImageWithUnlimitedOcr(canvas);
      allElements.push(...rawTextToParagraphs(result.text, pageNum));
    } else {
      // Scanned but no OCR — add a placeholder so the page isn't silently dropped
      allElements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `[Page ${pageNum}: scanned image — enable OCR to extract text]`,
              italics: true,
              color: "888888",
              font: "Calibri",
              size: 20,
            }),
          ],
          spacing: { after: convertInchesToTwip(0.2) },
        })
      );
    }

    // Page break between pages (skip after the last page)
    if (pageNum < numPages) {
      allElements.push(new Paragraph({ children: [], pageBreakBefore: true }));
    }
  }

  onProgress?.({ phase: "generate", message: "Generating Word document…", percent: 88 });

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
        children: allElements,
      },
    ],
  });

  onProgress?.({ phase: "generate", message: "Packing document…", percent: 95 });
  const blob = await Packer.toBlob(doc);
  onProgress?.({ phase: "done", message: "Word document ready", percent: 100 });
  return blob;
}

// ── Scanned-page helpers ─────────────────────────────────────────────────────

/** True when a page has no meaningful embedded text (likely scanned or image-only). */
function looksScanned(text: string): boolean {
  const nonSpace = text.replace(/\s/g, "").length;
  // Absolute minimum — definitely empty
  if (nonSpace < 15) return true;
  // Has chars but only digits / punctuation (page numbers, footers) — no real content
  if (nonSpace < 60 && !/[a-zA-Z]{3,}/.test(text)) return true;
  return false;
}

/** Render a single PDF.js page to a canvas at the given scale (for OCR). */
async function renderPdfJsPageToCanvas(
  page: any,
  scale: number
): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

/** Convert raw Unlimited OCR Markdown output into structured Word elements (Headings, Tables, Lists, Formatting). */
function rawTextToParagraphs(text: string, _pageNum?: number): Array<Paragraph | Table> {
  return parseMarkdownToDocxElements(text);
}

function parseMarkdownToDocxElements(markdown: string): Array<Paragraph | Table> {
  const lines = markdown.split("\n");
  const elements: Array<Paragraph | Table> = [];
  let tableLines: string[] = [];

  const flushTable = () => {
    if (tableLines.length > 0) {
      const table = parseMarkdownTable(tableLines);
      if (table) elements.push(table);
      tableLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check for Markdown table row
    if (line.startsWith("|") && line.endsWith("|")) {
      tableLines.push(line);
      continue;
    } else {
      flushTable();
    }

    if (!line) continue;

    // Headings (# Heading 1, ## Heading 2, ### Heading 3)
    if (line.startsWith("# ")) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: parseInlineFormatting(line.slice(2)),
          spacing: { before: convertInchesToTwip(0.2), after: convertInchesToTwip(0.1) },
        })
      );
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: parseInlineFormatting(line.slice(3)),
          spacing: { before: convertInchesToTwip(0.15), after: convertInchesToTwip(0.08) },
        })
      );
      continue;
    }
    if (line.startsWith("### ")) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: parseInlineFormatting(line.slice(4)),
          spacing: { before: convertInchesToTwip(0.12), after: convertInchesToTwip(0.06) },
        })
      );
      continue;
    }

    // Bullet / Numbered list items (- item, * item, 1. item)
    const listMatch = line.match(/^([-*+]\s+|\d+\.\s+)(.*)/);
    if (listMatch) {
      const prefix = listMatch[1];
      const content = listMatch[2];
      elements.push(
        new Paragraph({
          children: [
            new TextRun({ text: prefix.includes(".") ? prefix + " " : "• ", bold: true, font: "Calibri", size: 23 }),
            ...parseInlineFormatting(content),
          ],
          indent: { left: convertInchesToTwip(0.3) },
          spacing: { after: convertInchesToTwip(0.08) },
        })
      );
      continue;
    }

    // Standard paragraph with inline bold/italic/code parsing
    elements.push(
      new Paragraph({
        children: parseInlineFormatting(line),
        spacing: { after: convertInchesToTwip(0.12), line: 276 },
        alignment: AlignmentType.LEFT,
      })
    );
  }

  flushTable();
  return elements;
}

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|[^*`]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const chunk = match[0];
    if (chunk.startsWith("**") && chunk.endsWith("**") && chunk.length > 4) {
      runs.push(new TextRun({ text: chunk.slice(2, -2), bold: true, font: "Calibri", size: 23 }));
    } else if (chunk.startsWith("*") && chunk.endsWith("*") && chunk.length > 2) {
      runs.push(new TextRun({ text: chunk.slice(1, -1), italics: true, font: "Calibri", size: 23 }));
    } else if (chunk.startsWith("`") && chunk.endsWith("`") && chunk.length > 2) {
      runs.push(new TextRun({ text: chunk.slice(1, -1), font: "Consolas", size: 20, color: "1E293B" }));
    } else {
      runs.push(new TextRun({ text: chunk, font: "Calibri", size: 23 }));
    }
  }
  return runs.length > 0 ? runs : [new TextRun({ text, font: "Calibri", size: 23 })];
}

function parseMarkdownTable(tableLines: string[]): Table | null {
  const rowsData: string[][] = [];
  for (const line of tableLines) {
    // Skip separator lines (|---|---|)
    if (/^\|[\s\-:|]+\|$/.test(line)) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length > 0) rowsData.push(cells);
  }
  if (rowsData.length === 0) return null;

  const maxCols = Math.max(...rowsData.map((r) => r.length));

  const tableRows = rowsData.map((row, rowIndex) => {
    const isHeader = rowIndex === 0;
    const cells = row.map((cellText) => {
      return new TableCell({
        children: [
          new Paragraph({
            children: parseInlineFormatting(cellText),
            spacing: { before: convertInchesToTwip(0.04), after: convertInchesToTwip(0.04) },
          }),
        ],
        shading: isHeader
          ? { fill: "F1F5F9", type: ShadingType.SOLID, color: "auto" }
          : rowIndex % 2 === 1
          ? { fill: "F8FAFC", type: ShadingType.SOLID, color: "auto" }
          : undefined,
        margins: {
          top: convertInchesToTwip(0.06),
          bottom: convertInchesToTwip(0.06),
          left: convertInchesToTwip(0.1),
          right: convertInchesToTwip(0.1),
        },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
          left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
          right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
        },
      });
    });

    while (cells.length < maxCols) {
      cells.push(
        new TableCell({
          children: [new Paragraph({ children: [] })],
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
          },
        })
      );
    }

    return new TableRow({ children: cells, tableHeader: isHeader });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  });
}

// ── Embedded-text helpers ────────────────────────────────────────────────────

/** Extract text items from a single PDF.js page. */
async function extractPageTextItems(page: any): Promise<PdfTextItem[]> {
  const content = await page.getTextContent();
  const items: PdfTextItem[] = [];

  for (const item of content.items as any[]) {
    if (!item.str?.trim() && !item.hasEOL) continue;
    const [a, , , d, tx, ty] = item.transform as number[];
    const effectiveFontSize = Math.max(Math.abs(a), Math.abs(d), item.fontSize ?? 10);

    let color: string | undefined;
    if (Array.isArray(item.color) && item.color.length === 3) {
      const [r, g, b] = item.color as number[];
      if (r !== 0 || g !== 0 || b !== 0) {
        color = [r, g, b]
          .map((c) => Math.round((c <= 1 ? c * 255 : c)).toString(16).padStart(2, "0"))
          .join("");
      }
    }

    items.push({
      str: item.str ?? "",
      x: tx,
      y: ty,
      width: item.width ?? 0,
      height: item.height ?? effectiveFontSize,
      fontName: (item.fontName ?? "").replace(/^g_d[0-9]+_/, ""),
      fontSize: effectiveFontSize,
      hasEOL: !!item.hasEOL,
      color,
    });
  }

  return items;
}

function buildPlainTextParagraphs(textItems: PdfTextItem[]): Paragraph[] {
  const text = textItems.map((i) => i.str).join(" ").trim();
  if (!text) return [];
  return [
    new Paragraph({
      children: [new TextRun({ text, font: "Calibri", size: 24 })],
      spacing: { after: convertInchesToTwip(0.15) },
    }),
  ];
}

function buildStructuredElements(textItems: PdfTextItem[]): Array<Paragraph | Table> {
  if (textItems.length === 0) return [];
  // Detect multi-column layout and process each column independently
  // so that two-column PDFs don't produce interleaved text
  const columns = detectColumns(textItems);
  const elements: Array<Paragraph | Table> = [];
  for (const colItems of columns) {
    const lines = groupIntoLines(colItems);
    const { blocks, medianFontSize } = groupIntoBlocks(lines);
    for (const block of blocks) {
      const el = blockToDocxElement(block, medianFontSize);
      if (el) elements.push(el);
    }
  }
  return elements;
}

// ── Image-based conversion (exact visual) ───────────────────────────────────

async function convertToImageDocx(
  file: File,
  password?: string,
  onProgress?: (p: DocxProgress) => void,
  scale = 2
): Promise<Blob> {
  // Try pdfium first (higher quality), fall back to PDF.js
  try {
    const { renderPdfWithPdfium } = await import("./pdfiumRenderer");
    onProgress?.({ phase: "extract", message: `Rendering pages at ${scale}× quality…`, percent: 5 });

    const renderedPages = await renderPdfWithPdfium(file, {
      password,
      scale,
      imageType: "image/png",
      onProgress: (page, totalPages) =>
        onProgress?.({
          phase: "extract",
          message: `Rendering page ${page} of ${totalPages}…`,
          percent: 5 + Math.round((page / totalPages) * 80),
          page,
          totalPages,
        }),
    });

    const sections = await Promise.all(
      renderedPages.map(async (rp) => ({
        properties: {
          page: {
            size: {
              width: Math.round(rp.originalWidth * 20),
              height: Math.round(rp.originalHeight * 20),
            },
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
          },
        },
        children: [
          new Paragraph({
            spacing: { before: 0, after: 0, line: 1 },
            children: [
              new ImageRun({
                type: "png",
                data: new Uint8Array(await rp.blob.arrayBuffer()),
                transformation: {
                  width: Math.floor(rp.originalWidth * 4 / 3) - 1,
                  height: Math.floor(rp.originalHeight * 4 / 3) - 1,
                },
                altText: {
                  title: `Page ${rp.page}`,
                  description: "Exact visual rendering of the original PDF page",
                  name: `Page ${rp.page}`,
                },
              }),
            ],
          }),
        ],
      }))
    );

    onProgress?.({ phase: "generate", message: "Generating Word document…", percent: 90 });
    const blob = await Packer.toBlob(new Document({ sections }));
    onProgress?.({ phase: "done", message: "Exact-layout Word document ready", percent: 100 });
    return blob;
  } catch {
    // Fall back to PDF.js rendering
    return convertToImageDocxWithPdfJs(file, password, onProgress, scale);
  }
}

async function convertToImageDocxWithPdfJs(
  file: File,
  password?: string,
  onProgress?: (p: DocxProgress) => void,
  scale = 2
): Promise<Blob> {
  onProgress?.({ phase: "extract", message: "Rendering pages (PDF.js)…", percent: 5 });
  const pdfjsLib = await loadPdfJs();
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
      percent: 5 + Math.round((pageNumber / pdf.numPages) * 80),
      page: pageNumber,
      totalPages: pdf.numPages,
    });

    const page = await pdf.getPage(pageNumber);
    const pdfViewport = page.getViewport({ scale: 1 });
    const canvas = await renderPdfJsPageToCanvas(page, scale);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas render failed"))),
        "image/png"
      )
    );

    sections.push({
      properties: {
        page: {
          size: {
            width: Math.round(pdfViewport.width * 20),
            height: Math.round(pdfViewport.height * 20),
          },
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
        },
      },
      children: [
        new Paragraph({
          spacing: { before: 0, after: 0, line: 1 },
          children: [
            new ImageRun({
              type: "png",
              data: new Uint8Array(await png.arrayBuffer()),
              transformation: {
                width: Math.floor(pdfViewport.width * 4 / 3) - 1,
                height: Math.floor(pdfViewport.height * 4 / 3) - 1,
              },
              altText: {
                title: `Page ${pageNumber}`,
                description: "Exact visual rendering of the original PDF page",
                name: `Page ${pageNumber}`,
              },
            }),
          ],
        }),
      ],
    });
  }

  onProgress?.({ phase: "generate", message: "Generating Word document…", percent: 90 });
  const blob = await Packer.toBlob(new Document({ sections }));
  onProgress?.({ phase: "done", message: "Exact-layout Word document ready", percent: 100 });
  return blob;
}

// ── Block → DOCX element ─────────────────────────────────────────────────────

function blockToDocxElement(
  block: import("./pdfTextExtractor").PdfTextBlock,
  medianFontSize: number
): Paragraph | Table | null {
  const text = block.lines
    .flatMap((l) => l.items.map((i) => i.str))
    .join(" ")
    .trim();

  if (!text) return null;

  if (block.isTableRow) {
    return gridToDocxTable(block);
  }

  if (block.isHeading) {
    const ratio = block.fontSize / Math.max(medianFontSize, 1);
    const level =
      ratio >= 2.0
        ? HeadingLevel.HEADING_1
        : ratio >= 1.5
          ? HeadingLevel.HEADING_2
          : HeadingLevel.HEADING_3;

    return new Paragraph({
      heading: level,
      children: [new TextRun({ text, bold: true, font: "Calibri" })],
      spacing: { before: convertInchesToTwip(0.25), after: convertInchesToTwip(0.1) },
    });
  }

  // Regular paragraph — preserve bold/italic/size/color from PDF
  const children: TextRun[] = [];
  for (const line of block.lines) {
    for (const item of line.items) {
      const itemText = item.str.trim();
      if (!itemText) continue;

      const fontLower = item.fontName.toLowerCase();
      const isBold = fontLower.includes("bold") || block.isBold;
      const isItalic =
        fontLower.includes("italic") || fontLower.includes("oblique") || block.isItalic;
      const sizeHalfPts = Math.round(
        Math.max(10, Math.min(item.fontSize * 2, 72)) * 2
      );

      children.push(
        new TextRun({
          text: itemText + (item.hasEOL ? " " : ""),
          bold: isBold,
          italics: isItalic,
          font: "Calibri",
          size: sizeHalfPts,
          color: item.color ?? undefined,
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

// ── Table block → Word table ─────────────────────────────────────────────────

function gridToDocxTable(block: import("./pdfTextExtractor").PdfTextBlock): Table {
  const grid: string[][] = [];

  for (const line of block.lines) {
    const items = [...line.items].sort((a, b) => a.x - b.x);
    if (items.length === 0) continue;

    if (items.length === 1) {
      grid.push([items[0].str]);
      continue;
    }

    const gaps: number[] = [];
    for (let i = 1; i < items.length; i++) {
      gaps.push(items[i].x - (items[i - 1].x + items[i - 1].width));
    }

    const positiveGaps = gaps.filter((g) => g >= 0);
    const sorted = [...positiveGaps].sort((a, b) => a - b);
    const medianGap = sorted[Math.floor(sorted.length / 2)] ?? 10;
    const threshold = Math.max(medianGap * 0.6, 4);

    const cells: string[] = [items[0].str];
    for (let i = 1; i < items.length; i++) {
      if (gaps[i - 1] > threshold) {
        cells.push(items[i].str);
      } else {
        cells[cells.length - 1] += " " + items[i].str;
      }
    }
    grid.push(cells);
  }

  if (grid.length === 0) {
    const fallbackText = block.lines.flatMap((l) => l.items.map((i) => i.str)).join(" ");
    return new Table({
      rows: [new TableRow({
        children: [new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: fallbackText, font: "Calibri" })] })],
        })],
      })],
    });
  }

  const maxCols = Math.max(...grid.map((r) => r.length));
  const normalizedGrid = grid.map((row) => {
    while (row.length < maxCols) row.push("");
    return row;
  });

  const hasHeader =
    normalizedGrid.length > 1 &&
    block.lines[0]?.items.some((i) => i.fontName.toLowerCase().includes("bold"));

  const tableRows = normalizedGrid.map((row, ri) => {
    const isHeader = hasHeader && ri === 0;
    const isAlt = !isHeader && ri % 2 === 0;

    return new TableRow({
      tableHeader: isHeader,
      children: row.map((cellText) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: cellText, bold: isHeader, font: "Calibri", size: 22 })],
              spacing: { before: 40, after: 40 },
            }),
          ],
          borders: {
            top:    { style: BorderStyle.SINGLE, size: 4, color: "D0D0D0" },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "D0D0D0" },
            left:   { style: BorderStyle.SINGLE, size: 4, color: "D0D0D0" },
            right:  { style: BorderStyle.SINGLE, size: 4, color: "D0D0D0" },
          },
          shading: isHeader
            ? { fill: "E8EEF7", type: ShadingType.CLEAR }
            : isAlt
              ? { fill: "F7F7F7", type: ShadingType.CLEAR }
              : undefined,
          width: { size: Math.floor(100 / maxCols), type: WidthType.PERCENTAGE },
          margins: { top: 40, bottom: 40, left: 80, right: 80 },
        })
      ),
    });
  });

  return new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

// ── PDF.js loader ────────────────────────────────────────────────────────────

function loadPdfJs(): Promise<any> {
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
    script.onerror = () => reject(new Error("Failed to load PDF.js"));
    document.head.appendChild(script);
  });
}
