/**
 * pdfToXlsx.ts
 * Smart PDF to Excel converter with multi-engine table detection.
 *
 * Engines (in priority order):
 *   1. Cloud AI (Kimi Vision — K3) — most accurate, opt-in, requires API key
 *   2. TATR (Microsoft Table Transformer) — on-device visual detection
 *   3. Smart Cluster — improved gap-analysis fallback
 *
 * Post-processing:
 *   - Auto-column widths based on content
 *   - Bold header row detection & styling
 *   - Multi-sheet output (one sheet per page)
 */

import ExcelJS from "exceljs";
import { loadPdfJs } from "./loadPdfJs";
import {
  extractPdfText,
  groupIntoLines,
  type PdfTextItem,
} from "./pdfTextExtractor";
import { extractTables, type PdfTextItem as TatrTextItem } from "./tableExtractor";


async function renderPageForTatr(
  page: any,
  scale = 2.0
): Promise<{ canvas: HTMLCanvasElement; textItems: TatrTextItem[] }> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable.");
  await page.render({ canvasContext: context, viewport }).promise;

  const content = await page.getTextContent();
  const textItems: TatrTextItem[] = content.items
    .filter((item: any) => item.str?.trim())
    .map((item: any) => {
      const [, , , , tx, ty] = item.transform as number[];
      const height = Math.max((item.height ?? item.fontSize ?? 10) * scale, 4);
      return {
        text: item.str,
        x: tx * scale,
        y: canvas.height - ty * scale - height,
        width: Math.max((item.width ?? 0) * scale, 4),
        height,
      };
    });
  return { canvas, textItems };
}

export type TableEngine = "tatr" | "cluster";

export interface XlsxProgress {
  phase: "extract" | "detect" | "structure" | "generate" | "done";
  message: string;
  percent: number;
  page?: number;
  totalPages?: number;
  tablesFound?: number;
}

/**
 * Convert a PDF file to an Excel workbook.
 */
export async function convertPdfToXlsx(
  file: File,
  engine: TableEngine = "tatr",
  password?: string,
  cloudEnhance: boolean = false,
  onProgress?: (p: XlsxProgress) => void
): Promise<{ blob: Blob; sheetCount: number; totalTables: number }> {
  // ── Phase 1: Extract text & render pages ────────────────────────────────
  onProgress?.({ phase: "extract", message: "Loading PDF…", percent: 5 });

  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    password: password || undefined,
  }).promise;
  const numPages = pdf.numPages;

  onProgress?.({ phase: "extract", message: `PDF loaded · ${numPages} page(s)`, percent: 15 });

  // Pre-extract text from all pages
  const { items: allPageItems } = await extractPdfText(file, password);

  const workbook = new ExcelJS.Workbook();
  let totalTables = 0;
  let sheetCount = 0;

  // ── Phase 2: Process each page ──────────────────────────────────────────
  for (let pageIdx = 1; pageIdx <= numPages; pageIdx++) {
    onProgress?.({
      phase: "detect",
      message: `Processing page ${pageIdx}/${numPages}…`,
      percent: 15 + Math.round((pageIdx / numPages) * 75),
      page: pageIdx,
      totalPages: numPages,
    });

    const page = await pdf.getPage(pageIdx);
    const pageItems = allPageItems[pageIdx - 1] || [];

    let tables: string[][][] = [];

    // Try 1: Cloud AI (Kimi Vision — K3)
    if (cloudEnhance) {
      try {
        onProgress?.({ phase: "detect", message: `Cloud AI table detection on page ${pageIdx}…`, percent: 20 });
        const canvas = await renderPageToCanvas(page, 2.0);
        const pngBase64 = canvas.toDataURL("image/png").split(",")[1];
        const grid = await extractTableWithKimiVision(pngBase64);
        if (grid.length > 0) {
          tables.push(grid);
        }
      } catch (e) {
        console.warn("Cloud AI table extraction failed, falling back:", e);
      }
    }

    // Try 2: TATR (on-device visual detection)
    if (tables.length === 0 && engine === "tatr") {
      try {
        onProgress?.({ phase: "detect", message: `TATR detection on page ${pageIdx}…`, percent: 30 });
        const { canvas, textItems } = await renderPageForTatr(page, 2.0);
        const result = await extractTables(canvas, textItems, (label, pct) => {
          onProgress?.({
            phase: "structure",
            message: label,
            percent: 30 + Math.round(pct * 0.4),
            page: pageIdx,
            totalPages: numPages,
          });
        });

        for (const t of result.tables) {
          if (t.grid.length > 0) tables.push(t.grid);
        }
      } catch (e) {
        console.warn("TATR table extraction failed, falling back to clustering:", e);
      }
    }

    // Try 3: Smart clustering fallback
    if (tables.length === 0) {
      onProgress?.({ phase: "structure", message: `Smart clustering on page ${pageIdx}…`, percent: 60 });
      const grid = smartClusterTable(pageItems);
      if (grid.length > 0) tables.push(grid);
    }

    // ── Phase 3: Write tables to workbook ─────────────────────────────────
    if (tables.length > 0) {
      for (let ti = 0; ti < tables.length; ti++) {
        const grid = tables[ti];
        const sheetName = tables.length === 1
          ? `Page ${pageIdx}`
          : `P${pageIdx}_T${ti + 1}`;

        const ws = workbook.addWorksheet(sheetName);
        ws.addRows(grid);
        styleWorksheet(ws, grid);
        sheetCount++;
        totalTables++;
      }
    }
  }

  // ── Phase 4: Generate XLSX blob ─────────────────────────────────────────
  onProgress?.({ phase: "generate", message: "Generating Excel file…", percent: 92 });

  if (sheetCount === 0) {
    // No tables found — create a single sheet with all text
    const allText: string[][] = [];
    for (let i = 0; i < allPageItems.length; i++) {
      const lines = groupIntoLines(allPageItems[i]);
      for (const line of lines) {
        const text = line.items.map((item) => item.str).join(" ").trim();
        if (text) allText.push([text]);
      }
    }
    const ws = workbook.addWorksheet("Extracted Text");
    ws.addRows(allText);
    sheetCount = 1;
  }

  const excelBuffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([excelBuffer as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  onProgress?.({ phase: "done", message: `Excel ready · ${totalTables} table(s) in ${sheetCount} sheet(s)`, percent: 100, tablesFound: totalTables });

  return { blob, sheetCount, totalTables };
}

// ─── Smart clustering table extraction ──────────────────────────────────────

/**
 * Improved table extraction using gap-frequency analysis for column detection.
 * Replaces the basic reconstructTable with smarter clustering.
 */
function smartClusterTable(items: PdfTextItem[]): string[][] {
  const cleaned = items.filter((item) => item.str?.trim());
  if (cleaned.length === 0) return [];
  const rows: Array<{ y: number; items: PdfTextItem[] }> = [];
  for (const item of [...cleaned].sort((a, b) => b.y - a.y)) {
    let row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= 4);
    if (!row) { row = { y: item.y, items: [] }; rows.push(row); }
    row.items.push(item);
  }
  const anchors: number[] = [];
  for (const x of cleaned.map((item) => item.x).sort((a, b) => a - b)) {
    if (!anchors.some((anchor) => Math.abs(anchor - x) <= 12)) anchors.push(x);
  }
  return rows.map((row) => {
    const cells = new Array(anchors.length).fill("");
    for (const item of [...row.items].sort((a, b) => a.x - b.x)) {
      let column = 0; let distance = Number.POSITIVE_INFINITY;
      anchors.forEach((anchor, index) => {
        const candidate = Math.abs(anchor - item.x);
        if (candidate < distance) { distance = candidate; column = index; }
      });
      cells[column] = cells[column] ? `${cells[column]} ${item.str}` : item.str;
    }
    return cells;
  });
}

/** Apply auto-column widths and header styling to a worksheet. */
function styleWorksheet(ws: ExcelJS.Worksheet, grid: string[][]): void {
  if (!grid || grid.length === 0) return;

  // Auto-size columns based on content length
  const colWidths: number[] = [];
  const maxCols = Math.max(...grid.map((r) => r.length));

  for (let col = 0; col < maxCols; col++) {
    let maxLen = 10; // minimum width
    for (const row of grid) {
      const cellText = (row[col] || "").toString();
      maxLen = Math.max(maxLen, cellText.length);
    }
    // Cap at 50 characters, add padding
    colWidths.push(Math.min(maxLen + 2, 50));
  }

  ws.columns.forEach((column, index) => {
    column.width = colWidths[index] ?? 10;
  });

  // Bold header row (first row) if it looks like headers
  const hasHeader = detectHeaderRow(grid);
  if (hasHeader && grid.length > 1) {
    const header = ws.getRow(1);
    header.font = { bold: true, size: 11 };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8E8" } };
    header.alignment = { horizontal: "center", vertical: "middle" };
  }

  // Freeze top row
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

/**
 * Detect whether the first row of a grid is a header row.
 */
function detectHeaderRow(grid: string[][]): boolean {
  if (grid.length < 2) return false;
  const firstRow = grid[0];
  const secondRow = grid[1];

  // Headers typically have shorter text, are more "label-like"
  const firstRowAvgLen = firstRow.reduce((s, c) => s + c.length, 0) / firstRow.length;
  const secondRowAvgLen = secondRow.reduce((s, c) => s + c.length, 0) / secondRow.length;

  // Headers are typically shorter than data rows
  if (firstRowAvgLen < secondRowAvgLen * 0.8) return true;

  // Headers often contain no numbers (pure text labels)
  const firstRowHasNumbers = firstRow.some((c) => /\d/.test(c));
  const secondRowHasNumbers = secondRow.some((c) => /\d/.test(c));
  if (!firstRowHasNumbers && secondRowHasNumbers) return true;

  // Headers often have unique formatting (all caps, title case)
  const firstRowAllCaps = firstRow.every((c) => c === c.toUpperCase() && c.length > 1);
  if (firstRowAllCaps) return true;

  return false;
}

// ─── Cloud AI table extraction ──────────────────────────────────────────────

async function extractTableWithKimiVision(pngBase64: string): Promise<string[][]> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "vision-ocr", imageBase64: pngBase64 }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Kimi Vision OCR Proxy ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const markdown = data.text || "";

  // Parse markdown tables into a 2D grid
  const lines = markdown.split("\n");
  const grid: string[][] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed.split("|").slice(1, -1).map((c: string) => c.trim());
      // Skip markdown separator lines like |---|---|
      if (cells.every((c: string) => c.replace(/-/g, "").trim() === "")) continue;
      grid.push(cells);
    }
  }

  return grid;
}

// ─── PDF.js helpers ─────────────────────────────────────────────────────────

async function renderPageToCanvas(page: any, scale: number): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (ctx) await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

// PDF.js is loaded via the shared app/lib/loadPdfJs module (bundled v4, worker
// served from /public) — see the import at the top of this file.
