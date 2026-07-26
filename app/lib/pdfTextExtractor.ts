/**
 * pdfTextExtractor.ts
 * PDF.js-based text extraction with full metadata.
 * Used by PDF → Word and PDF → Excel converters.
 */

export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
  fontSize: number;
  hasEOL: boolean;
  color?: string; // hex color string, e.g. "1F1F1F"
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

      const [a, , , d, tx, ty] = item.transform as number[];
      // Use transform scale for accurate font size (more reliable than item.fontSize)
      const scaleX = Math.abs(a);
      const scaleY = Math.abs(d);
      const effectiveFontSize = Math.max(scaleX, scaleY, item.fontSize ?? 10);

      // Extract color if available (PDF.js provides it as an RGB array)
      let color: string | undefined;
      if (Array.isArray(item.color) && item.color.length === 3) {
        const [r, g, b] = item.color as number[];
        // Only store if not black (default)
        if (r !== 0 || g !== 0 || b !== 0) {
          color = [r, g, b]
            .map((c) => Math.round(c * 255).toString(16).padStart(2, "0"))
            .join("");
        }
      }

      pageItems.push({
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

    items.push(pageItems);
  }

  return { items, numPages };
}

/**
 * Group text items into lines (items on the same Y row).
 * Uses adaptive Y tolerance based on median line height.
 */
export function groupIntoLines(pageItems: PdfTextItem[]): PdfTextLine[] {
  if (pageItems.length === 0) return [];

  // Compute median item height for adaptive Y tolerance
  const heights = pageItems.map((i) => i.height).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 10;
  const yTol = Math.max(2, medianHeight * 0.4);

  const sorted = [...pageItems].sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > yTol) return yDiff;
    return a.x - b.x;
  });

  const lines: PdfTextLine[] = [];
  let currentLine: PdfTextItem[] = [sorted[0]];
  let currentY = sorted[0].y;
  let currentH = sorted[0].height;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
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
 * Returns the blocks plus the document-level median font size
 * needed for accurate heading level detection.
 */
export function groupIntoBlocks(
  lines: PdfTextLine[]
): { blocks: PdfTextBlock[]; medianFontSize: number } {
  if (lines.length === 0) return { blocks: [], medianFontSize: 12 };

  const allFontSizes = lines.flatMap((l) => l.items.map((i) => i.fontSize));
  const sorted = [...allFontSizes].sort((a, b) => a - b);
  const medianFontSize = sorted[Math.floor(sorted.length / 2)] || 12;

  const blocks: PdfTextBlock[] = [];
  let currentBlock: PdfTextLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prevLine = lines[i - 1];

    // Gap between previous line's bottom and this line's top (PDF coords: y is bottom-left)
    // prevLine.y is the baseline; line.y is this line's baseline
    // A positive gap means whitespace between lines
    const gap = prevLine ? prevLine.y - prevLine.height - line.y : 0;
    const isNewBlock = prevLine && gap > line.height * 0.8;

    if (isNewBlock && currentBlock.length > 0) {
      blocks.push(createBlock(currentBlock, medianFontSize));
      currentBlock = [];
    }

    currentBlock.push(line);
  }

  if (currentBlock.length > 0) {
    blocks.push(createBlock(currentBlock, medianFontSize));
  }

  return { blocks, medianFontSize };
}

function createBlock(lines: PdfTextLine[], medianFontSize: number): PdfTextBlock {
  const allItems = lines.flatMap((l) => l.items);
  const avgFontSize =
    allItems.reduce((s, i) => s + i.fontSize, 0) / (allItems.length || 1);
  const dominantFont = getDominantFont(allItems);
  const fontLower = dominantFont.toLowerCase();
  const isBold = fontLower.includes("bold") || allItems.some(i => i.fontName.toLowerCase().includes("bold"));
  const isItalic = fontLower.includes("italic") || fontLower.includes("oblique");

  const allText = allItems.map((i) => i.str).join("").trim();
  const wordCount = allText.split(/\s+/).filter(Boolean).length;
  const isAllCaps =
    allText.length > 2 &&
    allText === allText.toUpperCase() &&
    /[A-Z]/.test(allText) &&
    !/^\d/.test(allText);

  const isHeading =
    // Large font — clear heading
    avgFontSize > medianFontSize * 1.3 ||
    // Moderately larger + bold + single line
    (avgFontSize > medianFontSize * 1.1 && isBold && lines.length === 1) ||
    // ALL-CAPS short text at any size (section headers, labels)
    (isAllCaps && wordCount >= 1 && wordCount <= 12 && lines.length <= 2);

  const isTableRow = detectTableRow(lines);

  const firstLine = lines[0];
  const lastLine = lines[lines.length - 1];

  return {
    lines,
    y: firstLine.y,
    height: firstLine.y - lastLine.y + lastLine.height,
    fontSize: avgFontSize,
    fontName: dominantFont,
    isBold,
    isItalic,
    isHeading,
    isTableRow,
  };
}

/**
 * Detect multi-column layouts.
 * Returns an array of item groups — one per detected column (left→right order).
 * Single-column PDFs return [items].
 */
export function detectColumns(items: PdfTextItem[]): PdfTextItem[][] {
  if (items.length < 8) return [items];

  const xs = items.map((i) => i.x + i.width * 0.5);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const pageWidth = maxX - minX;
  if (pageWidth < 100) return [items];

  // Count how many item centres fall in the middle 40% of the page width.
  // A genuine two-column PDF has very little text in this central gap.
  const gapStart = minX + pageWidth * 0.3;
  const gapEnd   = minX + pageWidth * 0.7;
  const inGap = items.filter((i) => {
    const cx = i.x + i.width * 0.5;
    return cx > gapStart && cx < gapEnd;
  });

  if (inGap.length < items.length * 0.08) {
    const mid = minX + pageWidth * 0.5;
    const left  = items.filter((i) => i.x + i.width * 0.5 <= mid);
    const right = items.filter((i) => i.x + i.width * 0.5 >  mid);
    if (left.length > 3 && right.length > 3) return [left, right];
  }

  return [items];
}

function getDominantFont(items: PdfTextItem[]): string {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.fontName] = (counts[item.fontName] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

function detectTableRow(lines: PdfTextLine[]): boolean {
  // Check the first line with the most items (best candidate for table detection)
  const bestLine = [...lines].sort((a, b) => b.items.length - a.items.length)[0];
  if (!bestLine || bestLine.items.length < 2) return false;

  const items = [...bestLine.items].sort((a, b) => a.x - b.x);
  if (items.length < 2) return false;

  const gaps: number[] = [];
  for (let i = 1; i < items.length; i++) {
    const gap = items[i].x - (items[i - 1].x + items[i - 1].width);
    if (gap >= 0) gaps.push(gap);
  }

  if (gaps.length < 1) return false;
  if (gaps.length === 1) {
    // Two-column layout: gap must be significant relative to item widths
    const avgWidth = items.reduce((s, i) => s + i.width, 0) / items.length;
    return gaps[0] > avgWidth * 0.5;
  }

  // Multiple columns: check gap evenness (low variance = table-like)
  const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  if (avgGap <= 0) return false;
  const variance = gaps.reduce((s, g) => s + Math.abs(g - avgGap), 0) / gaps.length;
  return variance < avgGap * 0.6;
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
