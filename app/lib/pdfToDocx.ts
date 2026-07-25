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
import { renderPdfWithPdfium } from "./pdfiumRenderer";

// layout: structured editable output (paragraph detection, headings, bold/italic, tables)
// image:  pixel-perfect image embed per page — exact visual, not editable
// text:   plain text concatenation — simple and fast
export type DocFidelity = "layout" | "text" | "image";

export interface DocxProgress {
  phase: "extract" | "structure" | "generate" | "done";
  message: string;
  percent: number;
  page?: number;
  totalPages?: number;
}

export interface ConvertDocxOptions {
  imageScale?: number; // render scale for image mode — 2 = standard, 3 = Pro quality
}

export async function convertPdfToDocx(
  file: File,
  fidelity: DocFidelity = "layout",
  password?: string,
  onProgress?: (p: DocxProgress) => void,
  options?: ConvertDocxOptions
): Promise<Blob> {
  const scale = options?.imageScale ?? 2;

  if (fidelity === "image") {
    return convertPdfToImageDocx(file, password, onProgress, scale);
  }

  // ── Phase 1: Extract text ────────────────────────────────────────────────
  onProgress?.({ phase: "extract", message: "Extracting text from PDF…", percent: 5 });
  const { items: pageItems, numPages } = await extractPdfText(file, password);
  onProgress?.({ phase: "extract", message: `Extracted ${numPages} page(s)`, percent: 25 });

  // ── Phase 2: Structure detection ─────────────────────────────────────────
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
      // layout: full structure detection — headings, paragraphs, tables, bold/italic
      const lines = groupIntoLines(pageItemList);
      const { blocks, medianFontSize } = groupIntoBlocks(lines);

      for (const block of blocks) {
        const element = blockToDocxElement(block, medianFontSize);
        if (element) allParagraphs.push(element);
      }

      // Page break between pages (except after the last page)
      if (pageIdx < pageItems.length - 1) {
        allParagraphs.push(
          new Paragraph({ children: [], pageBreakBefore: true })
        );
      }
    }
  }

  onProgress?.({ phase: "structure", message: `Found ${allParagraphs.length} element(s)`, percent: 60 });

  // ── Phase 3: Generate DOCX ───────────────────────────────────────────────
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

// ── Image-based conversion (exact visual) ───────────────────────────────────

async function convertPdfToImageDocx(
  file: File,
  password?: string,
  onProgress?: (p: DocxProgress) => void,
  scale = 2
): Promise<Blob> {
  try {
    return await convertPdfToImageDocxWithPdfium(file, password, onProgress, scale);
  } catch (error) {
    console.warn("PDFium exact-layout rendering failed; falling back to PDF.js.", error);
    return convertPdfToImageDocxWithPdfJs(file, password, onProgress, scale);
  }
}

async function convertPdfToImageDocxWithPdfium(
  file: File,
  password?: string,
  onProgress?: (p: DocxProgress) => void,
  scale = 2
): Promise<Blob> {
  onProgress?.({ phase: "extract", message: `Rendering PDF pages (${scale}× quality)…`, percent: 5 });
  const renderedPages = await renderPdfWithPdfium(file, {
    password,
    scale,
    imageType: "image/png",
    onProgress: (page, totalPages) => onProgress?.({
      phase: "extract",
      message: `Rendering page ${page} of ${totalPages}…`,
      percent: 5 + Math.round((page / totalPages) * 75),
      page,
      totalPages,
    }),
  });

  const sections = await Promise.all(renderedPages.map(async (renderedPage) => ({
    properties: {
      page: {
        size: {
          width: Math.round(renderedPage.originalWidth * 20),
          height: Math.round(renderedPage.originalHeight * 20),
        },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    },
    children: [new Paragraph({
      spacing: { before: 0, after: 0, line: 1 },
      children: [new ImageRun({
        type: "png",
        data: new Uint8Array(await renderedPage.blob.arrayBuffer()),
        transformation: {
          width: Math.floor(renderedPage.originalWidth * 4 / 3) - 1,
          height: Math.floor(renderedPage.originalHeight * 4 / 3) - 1,
        },
        altText: {
          title: `PDF page ${renderedPage.page}`,
          description: "Exact visual rendering of the original PDF page",
          name: `Page ${renderedPage.page}`,
        },
      })],
    })],
  })));

  onProgress?.({ phase: "generate", message: "Generating Word document…", percent: 90 });
  const blob = await Packer.toBlob(new Document({ sections }));
  onProgress?.({ phase: "done", message: "Exact-layout Word document ready", percent: 100 });
  return blob;
}

async function convertPdfToImageDocxWithPdfJs(
  file: File,
  password?: string,
  onProgress?: (p: DocxProgress) => void,
  scale = 2
): Promise<Blob> {
  onProgress?.({ phase: "extract", message: "Rendering PDF pages (PDF.js fallback)…", percent: 5 });
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
    const renderViewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(renderViewport.width);
    canvas.height = Math.ceil(renderViewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas rendering is unavailable.");
    await page.render({ canvasContext: context, viewport: renderViewport }).promise;
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not render PDF page."))),
        "image/png"
      );
    });

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
      children: [new Paragraph({
        spacing: { before: 0, after: 0, line: 1 },
        children: [new ImageRun({
          type: "png",
          data: new Uint8Array(await png.arrayBuffer()),
          transformation: {
            width: Math.floor(pdfViewport.width * 4 / 3) - 1,
            height: Math.floor(pdfViewport.height * 4 / 3) - 1,
          },
          altText: {
            title: `PDF page ${pageNumber}`,
            description: "Exact visual rendering of the original PDF page",
            name: `Page ${pageNumber}`,
          },
        })],
      })],
    });
  }

  onProgress?.({ phase: "generate", message: "Generating Word document…", percent: 90 });
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

// ── Structured block → DOCX element ─────────────────────────────────────────

function blockToDocxElement(
  block: PdfTextBlock,
  medianFontSize: number
): Paragraph | Table | null {
  const text = block.lines
    .flatMap((l) => l.items.map((i) => i.str))
    .join(" ")
    .trim();

  if (!text) return null;

  // Table block: convert to a native Word table
  if (block.isTableRow) {
    return gridToDocxTable(block);
  }

  // Heading detection using document-level median font size
  if (block.isHeading) {
    const ratio = block.fontSize / medianFontSize;
    const level =
      ratio >= 2.0
        ? HeadingLevel.HEADING_1
        : ratio >= 1.5
          ? HeadingLevel.HEADING_2
          : HeadingLevel.HEADING_3;

    return new Paragraph({
      heading: level,
      children: [new TextRun({ text, bold: true, font: "Calibri" })],
      spacing: {
        before: convertInchesToTwip(0.25),
        after: convertInchesToTwip(0.1),
      },
    });
  }

  // Regular paragraph — preserve inline bold/italic and font size from PDF
  const children: TextRun[] = [];
  for (const line of block.lines) {
    for (const item of line.items) {
      const itemText = item.str.trim();
      if (!itemText) continue;

      const fontLower = item.fontName.toLowerCase();
      const isBold = fontLower.includes("bold") || block.isBold;
      const isItalic =
        fontLower.includes("italic") ||
        fontLower.includes("oblique") ||
        block.isItalic;

      // Clamp font size to reasonable Word range (half-points in docx)
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

// ── Table block → Word Table ─────────────────────────────────────────────────

function gridToDocxTable(block: PdfTextBlock): Table {
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

    // Use the median gap as the column separator threshold
    const sortedGaps = [...gaps].filter((g) => g >= 0).sort((a, b) => a - b);
    const medianGap = sortedGaps[Math.floor(sortedGaps.length / 2)] ?? 10;
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

  // Detect header row: first row is bold or has a different font
  const hasHeader =
    normalizedGrid.length > 1 &&
    block.lines[0]?.items.some((i) => i.fontName.toLowerCase().includes("bold"));

  const tableRows: TableRow[] = normalizedGrid.map((row, ri) => {
    const isHeader = hasHeader && ri === 0;
    const isAlternate = !isHeader && ri % 2 === 0;

    return new TableRow({
      tableHeader: isHeader,
      children: row.map((cellText) =>
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({
              text: cellText,
              bold: isHeader,
              font: "Calibri",
              size: 22, // 11pt
            })],
            spacing: { before: 40, after: 40 },
          })],
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: "D0D0D0" },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "D0D0D0" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "D0D0D0" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "D0D0D0" },
          },
          shading: isHeader
            ? { fill: "E8EEF7", type: ShadingType.CLEAR }
            : isAlternate
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
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });
}
