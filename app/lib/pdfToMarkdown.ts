/**
 * pdfToMarkdown.ts
 * PDF → Markdown converter, entirely client-side.
 *
 * Reuses the same layout-analysis primitives as PDF → Word/Excel
 * (groupIntoLines / groupIntoBlocks / detectColumns from pdfTextExtractor.ts)
 * so heading, table, and multi-column detection behave identically across all
 * three converters — only the final rendering step differs (Markdown text
 * here, instead of docx Paragraph/Table objects or xlsx cells).
 *
 * Scanned pages (no usable text layer) are rendered to a canvas and sent
 * through the existing OCR pipeline in "structured" mode, which already
 * returns GitHub-Flavoured Markdown from the model directly — no extra
 * conversion needed for that path.
 */

import { loadPdfJs } from "./loadPdfJs";
import {
  groupIntoLines,
  groupIntoBlocks,
  detectColumns,
  type PdfTextItem,
  type PdfTextBlock,
} from "./pdfTextExtractor";

export interface PdfToMarkdownProgress {
  message: string;
  percent: number;
  page?: number;
  totalPages?: number;
}

export interface ConvertMarkdownOptions {
  /** Send scanned pages to the cloud OCR pipeline. Default true. */
  ocrFallback?: boolean;
}

/**
 * True when a page has no meaningful embedded text (likely scanned or
 * image-only). Mirrors the heuristic pdfToDocx.ts uses (rather than the
 * simpler one in ocr.ts) so both converters make the same call about which
 * pages need OCR — this one specifically avoids OCR-ing a page that only has
 * a page-number footer as "real" text.
 */
function looksScanned(text: string): boolean {
  const nonSpace = text.replace(/\s/g, "").length;
  if (nonSpace < 15) return true;
  if (nonSpace < 60 && !/[a-zA-Z]{3,}/.test(text)) return true;
  return false;
}

async function extractPageTextItems(page: any): Promise<PdfTextItem[]> {
  const content = await page.getTextContent();
  const items: PdfTextItem[] = [];

  for (const item of content.items as any[]) {
    // pdf.js emits a zero-width, empty-string marker item (str: "", hasEOL:
    // true) at the start of most lines to signal a line break in the content
    // stream. Unlike pdfToDocx.ts (which keeps these to append a trailing
    // space when rejoining text), this converter never reads .hasEOL, and
    // keeping the marker is actively harmful: it sits at the same X as the
    // line's first real item with width 0, injecting a bogus zero-length gap
    // into detectTableRow's gap-variance check — enough to misclassify a
    // real table as prose. Drop every item with no real text, full stop.
    if (!item.str?.trim()) continue;
    const [a, , , d, tx, ty] = item.transform as number[];
    const effectiveFontSize = Math.max(Math.abs(a), Math.abs(d), item.fontSize ?? 10);

    items.push({
      str: item.str ?? "",
      x: tx,
      y: ty,
      width: item.width ?? 0,
      height: item.height ?? effectiveFontSize,
      fontName: (item.fontName ?? "").replace(/^g_d[0-9]+_/, ""),
      fontSize: effectiveFontSize,
      hasEOL: !!item.hasEOL,
    });
  }

  return items;
}

async function renderPageToCanvas(page: any, scale: number): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas rendering is unavailable.");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

/**
 * Only pipes need escaping inside a GFM table cell.
 * Exported for direct unit testing (see tests/pdf-to-markdown.spec.ts).
 */
export function escapeTableCell(text: string): string {
  return text.replace(/\|/g, "\\|").trim();
}

/**
 * Rebuild a table block into a GFM pipe table. Mirrors the exact gap-based
 * cell-splitting algorithm pdfToDocx.ts uses for Word tables (gridToDocxTable),
 * so a table looks the same whether the document is exported to Word or
 * Markdown.
 */
function blockToMarkdownTable(block: PdfTextBlock): string {
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
      if (gaps[i - 1] > threshold) cells.push(items[i].str);
      else cells[cells.length - 1] += " " + items[i].str;
    }
    grid.push(cells);
  }

  if (grid.length === 0) return "";

  const maxCols = Math.max(...grid.map((r) => r.length));
  const normalized = grid.map((row) => {
    const r = row.map(escapeTableCell);
    while (r.length < maxCols) r.push("");
    return r;
  });

  const rows = normalized.map((r) => `| ${r.join(" | ")} |`);
  const separator = `| ${Array(maxCols).fill("---").join(" | ")} |`;
  return [rows[0], separator, ...rows.slice(1)].join("\n");
}

/**
 * Render one non-table block as Markdown: a heading (#/##/###) sized by font
 * ratio against the page median (same thresholds pdfToDocx.ts uses for
 * HeadingLevel), or a paragraph with per-line bold/italic detected from the
 * font name — the same signal pdfToDocx.ts uses per text run.
 *
 * Exported for direct unit testing (see tests/pdf-to-markdown.spec.ts) — the
 * full page-to-Markdown pipeline needs a real PDF.js parse, so this is the
 * outermost piece that's practical to test without a browser.
 */
export function blockToMarkdown(block: PdfTextBlock, medianFontSize: number): string {
  if (block.isTableRow) return blockToMarkdownTable(block);

  const fullText = block.lines
    .flatMap((l) => l.items.map((i) => i.str))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!fullText) return "";

  if (block.isHeading) {
    const ratio = block.fontSize / Math.max(medianFontSize, 1);
    const level = ratio >= 2.0 ? 1 : ratio >= 1.5 ? 2 : 3;
    return `${"#".repeat(level)} ${fullText}`;
  }

  const lineTexts = block.lines
    .map((line) => {
      const text = line.items
        .map((i) => i.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) return "";

      const bold = line.items.some((i) => i.fontName.toLowerCase().includes("bold")) || block.isBold;
      const italic =
        line.items.some((i) => /italic|oblique/i.test(i.fontName)) || block.isItalic;

      let out = text;
      if (bold) out = `**${out}**`;
      if (italic) out = `*${out}*`;
      return out;
    })
    .filter(Boolean);

  return lineTexts.join(" ");
}

/**
 * groupIntoBlocks splits on any inter-line gap exceeding 0.8× the line's
 * height. Real tables often use row spacing just over that threshold for
 * readability (e.g. 20pt rows at an 11pt line height — a 9pt gap against an
 * 8.8pt threshold) — a hair's-breadth miss that splits one 3-row table into
 * three separate single-row blocks, each independently still classified as
 * isTableRow. Rather than loosen the shared threshold (used by PDF → Word's
 * heading/paragraph grouping too — a global change risks regressing already-
 * shipped, tested behaviour there), coalesce table blocks after the fact:
 * merge any block into the previous one when both are independently
 * classified as table rows. Only `.lines` matters for table rendering
 * (blockToMarkdownTable never reads the other block fields), so the merge is
 * a pure concatenation.
 */
function mergeAdjacentTableBlocks(blocks: PdfTextBlock[]): PdfTextBlock[] {
  const merged: PdfTextBlock[] = [];
  for (const block of blocks) {
    const prev = merged[merged.length - 1];
    if (block.isTableRow && prev?.isTableRow) {
      prev.lines.push(...block.lines);
      continue;
    }
    merged.push({ ...block, lines: [...block.lines] });
  }
  return merged;
}

/**
 * Convert a PDF file to Markdown. Runs entirely in the browser: text-layer
 * pages are analysed locally using the same heuristics as PDF → Word; scanned
 * pages are uploaded to the configured OCR provider in "structured" mode,
 * which already returns GitHub-Flavoured Markdown directly.
 */
export async function convertPdfToMarkdown(
  file: File,
  password?: string,
  onProgress?: (p: PdfToMarkdownProgress) => void,
  options: ConvertMarkdownOptions = {}
): Promise<string> {
  const ocrFallback = options.ocrFallback ?? true;

  onProgress?.({ message: "Loading PDF…", percent: 3 });
  const pdfjsLib = await loadPdfJs();
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    password: password || undefined,
  }).promise;

  const numPages: number = pdf.numPages;
  const pageMarkdowns: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const basePercent = 5 + Math.round(((pageNum - 1) / numPages) * 85);
    onProgress?.({
      message: `Analysing page ${pageNum} of ${numPages}…`,
      percent: basePercent,
      page: pageNum,
      totalPages: numPages,
    });

    const page = await pdf.getPage(pageNum);
    const textItems = await extractPageTextItems(page);
    const pageText = textItems.map((i) => i.str).join("");

    if (!looksScanned(pageText)) {
      const columns = detectColumns(textItems);
      const parts: string[] = [];
      for (const colItems of columns) {
        const lines = groupIntoLines(colItems);
        const { blocks: rawBlocks, medianFontSize } = groupIntoBlocks(lines);
        const blocks = mergeAdjacentTableBlocks(rawBlocks);
        for (const block of blocks) {
          const md = blockToMarkdown(block, medianFontSize);
          if (md) parts.push(md);
        }
      }
      pageMarkdowns.push(parts.join("\n\n"));
    } else if (ocrFallback) {
      onProgress?.({
        message: `Page ${pageNum}: scanned — running OCR…`,
        percent: basePercent,
        page: pageNum,
        totalPages: numPages,
      });
      const canvas = await renderPageToCanvas(page, 3.0);
      const { ocrImageWithUnlimitedOcr } = await import("./ocr");
      const result = await ocrImageWithUnlimitedOcr(canvas);
      pageMarkdowns.push(result.text.trim());
    } else {
      pageMarkdowns.push(`*[Page ${pageNum}: scanned image — enable OCR to extract text]*`);
    }
  }

  onProgress?.({ message: "Assembling Markdown…", percent: 96 });
  const markdown =
    pageMarkdowns
      .map((p) => p.trim())
      .filter(Boolean)
      .join("\n\n---\n\n") + "\n";

  onProgress?.({ message: "Markdown ready", percent: 100 });
  return markdown;
}
