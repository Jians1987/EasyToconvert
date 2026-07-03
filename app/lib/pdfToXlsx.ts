/**
 * pdfToXlsx.ts
 * Smart PDF to Excel converter with multi-engine table detection.
 *
 * Engines (in priority order):
 *   1. Cloud AI (Nemotron OCR v2) — most accurate, requires API
 *   2. TATR (Microsoft Table Transformer) — on-device visual detection
 *   3. Smart Cluster — improved gap-analysis fallback
 *
 * Post-processing:
 *   - Auto-column widths based on content
 *   - Bold header row detection & styling
 *   - Multi-sheet output (one sheet per page)
 */

import * as XLSX from "xlsx";
import {
  extractPdfText,
  groupIntoLines,
  type PdfTextItem,
} from "./pdfTextExtractor";
import { extractTables, renderPageForTatr, type PdfTextItem as TatrTextItem } from "./tableExtractor";

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

  const workbook = XLSX.utils.book_new();
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

    // Try 1: Cloud AI (Nemotron OCR v2)
    if (cloudEnhance) {
      try {
        onProgress?.({ phase: "detect", message: `Cloud AI table detection on page ${pageIdx}…`, percent: 20 });
        const canvas = await renderPageToCanvas(page, 2.0);
        const pngBase64 = canvas.toDataURL("image/png").split(",")[1];
        const grid = await extractTableWithNemotron(pngBase64);
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

        const ws = XLSX.utils.aoa_to_sheet(grid);
        styleWorksheet(ws, grid);
        XLSX.utils.book_append_sheet(workbook, ws, sheetName);
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
    const ws = XLSX.utils.aoa_to_sheet(allText);
    XLSX.utils.book_append_sheet(workbook, ws, "Extracted Text");
    sheetCount = 1;
  }

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
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
  const cleaned = items.filter((i) => i.str?.trim());
  if (cleaned.length === 0) return [];

  // Group into rows by Y position
  const yTol = 4;
  const byTop = [...cleaned].sort((a, b) => b.y - a.y);
  const rows: { y: number; items: PdfTextItem[] }[] = [];

  for (const it of byTop) {
    let row = rows.find((r) => Math.abs(r.y - it.y) <= yTol);
    if (!row) {
      row = { y: it.y, items: [] };
      rows.push(row);
    }
    row.items.push(it);
  }

  // Sort items within each row left-to-right
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
  }

  // Detect column boundaries using gap-frequency analysis
  const allGaps: number[] = [];
  for (const row of rows) {
    for (let i = 1; i < row.items.length; i++) {
      const gap = row.items[i].x - (row.items[i - 1].x + row.items[i - 1].width);
      if (gap > 1) allGaps.push(gap);
    }
  }

  if (allGaps.length === 0) {
    // Single column — just return rows
    return rows.map((r) => [r.items.map((i) => i.str).join(" ")]);
  }

  // Find the "natural" column gap threshold using frequency analysis
  const sortedGaps = [...allGaps].sort((a, b) => a - b);
  const gapCounts: Map<number, number> = new Map();
  const bucketSize = Math.max(2, Math.round(sortedGaps[sortedGaps.length - 1] / 20));

  for (const gap of sortedGaps) {
    const bucket = Math.round(gap / bucketSize) * bucketSize;
    gapCounts.set(bucket, (gapCounts.get(bucket) || 0) + 1);
  }

  // Find the most common gap bucket (represents inter-word spacing)
  let mostCommonGap = bucketSize;
  let maxCount = 0;
  for (const [gap, count] of gapCounts) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonGap = gap;
    }
  }

  // Column separator threshold = 2x the most common word gap
  const colThreshold = mostCommonGap * 2;

  // Build grid with dynamic column detection per row, then normalize
  const rawRows: string[][] = [];
  let maxCols = 0;

  for (const row of rows) {
    const cells: string[] = [];
    let currentCell = row.items[0]?.str || "";

    for (let i = 1; i < row.items.length; i++) {
      const gap = row.items[i].x - (row.items[i - 1].x + row.items[i - 1].width);
      if (gap > colThreshold) {
        cells.push(currentCell);
        currentCell = row.items[i].str;
      } else {
        currentCell += " " + row.items[i].str;
      }
    }
    cells.push(currentCell);
    rawRows.push(cells);
    maxCols = Math.max(maxCols, cells.length);
  }

  // Normalize all rows to the same column count
  const grid = rawRows.map((row) => {
    const padded = [...row];
    while (padded.length < maxCols) padded.push("");
    return padded.slice(0, maxCols);
  });

  // Filter out rows that are almost empty (likely not table data)
  const nonEmptyGrid = grid.filter((row) => row.some((cell) => cell.trim().length > 0));

  return nonEmptyGrid.length > 0 ? nonEmptyGrid : grid;
}

// ─── Worksheet styling ──────────────────────────────────────────────────────

/**
 * Apply auto-column widths and header styling to a worksheet.
 */
function styleWorksheet(ws: XLSX.WorkSheet, grid: string[][]): void {
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

  ws["!cols"] = colWidths.map((w) => ({ wch: w }));

  // Bold header row (first row) if it looks like headers
  const hasHeader = detectHeaderRow(grid);
  if (hasHeader && grid.length > 1) {
    const headerRange = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
      if (ws[cellRef]) {
        ws[cellRef].s = ws[cellRef].s || {};
        ws[cellRef].s.font = { bold: true, sz: 11 };
        ws[cellRef].s.fill = { patternType: "solid", fgColor: { rgb: "E8E8E8" } };
        ws[cellRef].s.alignment = { horizontal: "center", vertical: "center" };
      }
    }
  }

  // Freeze top row
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
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

async function extractTableWithNemotron(pngBase64: string): Promise<string[][]> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "nemotron-ocr", imageBase64: pngBase64 }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Nemotron OCR Proxy ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  let markdown = data.text || "";

  // Parse markdown tables into a 2D grid
  const lines = markdown.split("\n");
  const grid: string[][] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());
      // Skip markdown separator lines like |---|---|
      if (cells.every((c) => c.replace(/-/g, "").trim() === "")) continue;
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
