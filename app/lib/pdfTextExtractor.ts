/**
 * pdfTextExtractor.ts
 * PDF.js-based text extraction with full metadata.
 * Used by PDF → Word and PDF → Excel converters.
 */

export interface PdfTextItem {
  str: string;
  x: number;        // PDF user-space units (bottom-left origin)
  y: number;
  width: number;
  height: number;
  fontName: string;
  fontSize: number;
  hasEOL: boolean;  // true if this item ends a line
}

export interface PdfTextLine {
  items: PdfTextItem[];
  y: number;
  height: number;
}

export interface PdfTextBlock {
  lines: PdfTextLine[];
  y: number;
  height: number;
  fontSize: number;
  fontName: string;
  isBold: boolean;
  isItalic: boolean;
  isHeading: boolean;
  isTableRow: boolean;
}

/**
 * Extract text items from a PDF file using PDF.js.
 */
export async function extractPdfText(
  file: File,
  password?: string
): Promise<{ items: PdfTextItem[][]; numPages: number }> {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    password: password || undefined,
  }).promise;

  const numPages = pdf.numPages;
  const items: PdfTextItem[][] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageItems: PdfTextItem[] = [];

    for (const item of content.items as any[]) {
      if (!item.str?.trim() && !item.hasEOL) continue;
      const [, , , , tx, ty] = item.transform as number[];
      pageItems.push({
        str: item.str ?? "",
        x: tx,
        y: ty,
        width: item.width ?? 0,
        height: item.height ?? (item.fontSize ?? 10),
        fontName: (item.fontName ?? "").replace(/^g_d[0-9]+_/, ""),
        fontSize: item.fontSize ?? 10,
        hasEOL: !!item.hasEOL,
      });
    }

    items.push(pageItems);
  }

  return { items, numPages };
}

/**
 * Group text items into lines (items on the same Y row).
 */
export function groupIntoLines(pageItems: PdfTextItem[]): PdfTextLine[] {
  if (pageItems.length === 0) return [];

  // Sort top-to-bottom, then left-to-right
  const sorted = [...pageItems].sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > 2) return yDiff;
    return a.x - b.x;
  });

  const yTol = 3;
  const lines: PdfTextLine[] = [];
  let currentLine: PdfTextItem[] = [];
  let currentY = sorted[0].y;
  let currentH = sorted[0].height;

  for (const item of sorted) {
    if (Math.abs(item.y - currentY) <= yTol) {
      currentLine.push(item);
      currentH = Math.max(currentH, item.height);
    } else {
      lines.push({
        items: [...currentLine].sort((a, b) => a.x - b.x),
        y: currentY,
        height: currentH,
      });
      currentLine = [item];
      currentY = item.y;
      currentH = item.height;
    }
  }

  if (currentLine.length > 0) {
    lines.push({
      items: [...currentLine].sort((a, b) => a.x - b.x),
      y: currentY,
      height: currentH,
    });
  }

  return lines;
}

/**
 * Group lines into blocks (paragraphs / sections).
 * Uses vertical gap detection to split blocks.
 */
export function groupIntoBlocks(lines: PdfTextLine[]): PdfTextBlock[] {
  if (lines.length === 0) return [];

  // Compute median font size for heading detection
  const allFontSizes = lines.flatMap(l => l.items.map(i => i.fontSize));
  const medianFontSize = allFontSizes.sort((a, b) => a - b)[Math.floor(allFontSizes.length / 2)] || 12;

  const blocks: PdfTextBlock[] = [];
  let currentBlock: PdfTextLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prevLine = lines[i - 1];

    // Check if this line starts a new block
    const gap = prevLine ? prevLine.y - (line.y + line.height) : 0;
    const isNewBlock = prevLine && gap > line.height * 1.5;

    if (isNewBlock && currentBlock.length > 0) {
      blocks.push(createBlock(currentBlock, medianFontSize));
      currentBlock = [];
    }

    currentBlock.push(line);
  }

  if (currentBlock.length > 0) {
    blocks.push(createBlock(currentBlock, medianFontSize));
  }

  return blocks;
}

function createBlock(lines: PdfTextLine[], medianFontSize: number): PdfTextBlock {
  const allItems = lines.flatMap(l => l.items);
  const avgFontSize = allItems.reduce((s, i) => s + i.fontSize, 0) / allItems.length || medianFontSize;
  const dominantFont = getDominantFont(allItems);
  const isBold = dominantFont.toLowerCase().includes("bold");
  const isItalic = dominantFont.toLowerCase().includes("italic") || dominantFont.toLowerCase().includes("oblique");
  const isHeading = avgFontSize > medianFontSize * 1.3;

  // Detect table rows: lines with evenly-spaced gaps between items
  const isTableRow = detectTableRow(lines);

  const firstLine = lines[0];
  const lastLine = lines[lines.length - 1];

  return {
    lines,
    y: firstLine.y,
    height: firstLine.y + firstLine.height - lastLine.y,
    fontSize: avgFontSize,
    fontName: dominantFont,
    isBold,
    isItalic,
    isHeading,
    isTableRow,
  };
}

function getDominantFont(items: PdfTextItem[]): string {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.fontName] = (counts[item.fontName] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

function detectTableRow(lines: PdfTextLine[]): boolean {
  if (lines.length < 2) return false;
  // Check if items are evenly spaced horizontally (table-like)
  const firstLine = lines[0];
  if (firstLine.items.length < 2) return false;
  const gaps: number[] = [];
  for (let i = 1; i < firstLine.items.length; i++) {
    gaps.push(firstLine.items[i].x - (firstLine.items[i - 1].x + firstLine.items[i - 1].width));
  }
  if (gaps.length < 2) return false;
  const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  const variance = gaps.reduce((s, g) => s + Math.abs(g - avgGap), 0) / gaps.length;
  return variance < avgGap * 0.5; // evenly spaced = table-like
}

// ─── Shared PDF.js loader ────────────────────────────────────────────────────

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
    script.onerror = () => reject(new Error("Failed to load PDF.js engine."));
    document.head.appendChild(script);
  });
}
