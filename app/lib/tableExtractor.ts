/**
 * tableExtractor.ts
 * Research-grade table detection & extraction using:
 *   - Microsoft Table Transformer (TATR) via @huggingface/transformers (ONNX Runtime Web)
 *     Model 1: Xenova/table-transformer-detection   → locates table bounding boxes
 *     Model 2: Xenova/table-transformer-structure-recognition → rows / columns / headers
 *   - PDF.js text-layer cell mapping (PDFs with selectable text — zero OCR latency)
 *   - Tesseract.js cell OCR fallback (scanned images / image-only PDFs)
 *
 * All inference runs on-device in the browser via WebAssembly. Nothing is uploaded.
 */

export interface BBox {
  xmin: number; // normalised 0-1 within the source image
  ymin: number;
  xmax: number;
  ymax: number;
}

/** A single cell in the reconstructed grid. */
export interface TableCell {
  row: number;
  col: number;
  text: string;
}

/** Everything we know about one detected table on a page. */
export interface DetectedTable {
  id: number;
  score: number;          // detection confidence 0-1
  bbox: BBox;             // in source-image pixel fractions
  rows: BBox[];           // structure rows (normalised within table crop)
  columns: BBox[];        // structure columns
  columnHeaders: BBox[];  // header rows
  /** Reconstructed 2-D grid: grid[rowIdx][colIdx] = cell text */
  grid: string[][];
}

export interface ExtractionResult {
  tables: DetectedTable[];
  imageWidth: number;
  imageHeight: number;
  durationMs: number;
  pageTextItems?: PdfTextItem[]; // forwarded for overlay rendering
}

/** A text fragment extracted from a PDF text layer. */
export interface PdfTextItem {
  text: string;
  /** Canvas-space coordinates (top-left origin, pixels). */
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ProgressFn = (label: string, pct: number) => void;

// ─── Pipeline singletons (lazy, cached between calls) ─────────────────────────

let detectorCache: any = null;
let structureCache: any = null;

async function getDetector(onProgress?: ProgressFn) {
  if (detectorCache) return detectorCache;
  onProgress?.("Downloading table-detection model (first run only)…", 5);
  const { pipeline, env } = await import("@huggingface/transformers");
  env.allowLocalModels = false;
  detectorCache = await pipeline(
    "object-detection",
    "Xenova/table-transformer-detection",
    {
      progress_callback: (p: any) => {
        if (p.status === "progress") {
          onProgress?.(
            `Fetching detection model · ${p.file ?? ""}`,
            5 + Math.round((p.progress ?? 0) * 0.35)
          );
        }
      },
    }
  );
  return detectorCache;
}

async function getStructurer(onProgress?: ProgressFn) {
  if (structureCache) return structureCache;
  onProgress?.("Downloading structure-recognition model (first run only)…", 42);
  const { pipeline } = await import("@huggingface/transformers");
  structureCache = await pipeline(
    "object-detection",
    "Xenova/table-transformer-structure-recognition",
    {
      progress_callback: (p: any) => {
        if (p.status === "progress") {
          onProgress?.(
            `Fetching structure model · ${p.file ?? ""}`,
            42 + Math.round((p.progress ?? 0) * 0.3)
          );
        }
      },
    }
  );
  return structureCache;
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────

/**
 * Crop a sub-rectangle from a canvas.
 * `bbox` is normalised (0-1) within the source canvas.
 */
function cropCanvas(src: HTMLCanvasElement, bbox: BBox): HTMLCanvasElement {
  const sx = Math.max(0, Math.floor(bbox.xmin * src.width));
  const sy = Math.max(0, Math.floor(bbox.ymin * src.height));
  const sw = Math.min(src.width - sx, Math.ceil((bbox.xmax - bbox.xmin) * src.width));
  const sh = Math.min(src.height - sy, Math.ceil((bbox.ymax - bbox.ymin) * src.height));

  const dst = document.createElement("canvas");
  dst.width = sw;
  dst.height = sh;
  dst.getContext("2d")!.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
  return dst;
}

// ─── Grid reconstruction ──────────────────────────────────────────────────────

/**
 * Build a string[][] from sorted rows × columns.
 * Text items (canvas-space pixels) are matched to cells via centre-point overlap.
 *
 * `tableBbox`   – normalised within the full page canvas
 * `imageW/H`    – full page canvas dimensions in pixels
 * `rows`/`cols` – normalised within the TABLE crop canvas
 * `textItems`   – absolute pixel positions in the full page canvas
 */
function buildGrid(
  rows: BBox[],
  cols: BBox[],
  textItems: PdfTextItem[],
  tableBbox: BBox,
  imageW: number,
  imageH: number
): string[][] {
  if (!rows.length || !cols.length) return [];

  const sortedRows = [...rows].sort((a, b) => a.ymin - b.ymin);
  const sortedCols = [...cols].sort((a, b) => a.xmin - b.xmin);

  const grid: string[][] = Array.from({ length: sortedRows.length }, () =>
    Array(sortedCols.length).fill("")
  );

  // Table region in absolute pixels
  const tX = tableBbox.xmin * imageW;
  const tY = tableBbox.ymin * imageH;
  const tW = (tableBbox.xmax - tableBbox.xmin) * imageW;
  const tH = (tableBbox.ymax - tableBbox.ymin) * imageH;

  for (const item of textItems) {
    // centre of text item, normalised within the table crop
    const cx = (item.x + item.width * 0.5 - tX) / tW;
    const cy = (item.y + item.height * 0.5 - tY) / tH;

    if (cx < 0 || cx > 1 || cy < 0 || cy > 1) continue; // outside table

    let ri = -1;
    for (let r = 0; r < sortedRows.length; r++) {
      if (cy >= sortedRows[r].ymin && cy <= sortedRows[r].ymax) { ri = r; break; }
    }
    let ci = -1;
    for (let c = 0; c < sortedCols.length; c++) {
      if (cx >= sortedCols[c].xmin && cx <= sortedCols[c].xmax) { ci = c; break; }
    }

    if (ri >= 0 && ci >= 0) {
      grid[ri][ci] += (grid[ri][ci] ? " " : "") + item.text.trim();
    }
  }

  return grid;
}

/**
 * Fallback: OCR the entire table crop as one block, then naïvely split
 * lines into rows. Used only when no PDF text layer is available.
 */
async function ocrTableGrid(
  tableCrop: HTMLCanvasElement,
  rows: BBox[],
  cols: BBox[],
  onProgress?: ProgressFn
): Promise<string[][]> {
  onProgress?.("Running Tesseract OCR on table region…", 85);
  const { default: Tesseract } = await import("tesseract.js");

  const sortedRows = [...rows].sort((a, b) => a.ymin - b.ymin);
  const sortedCols = [...cols].sort((a, b) => a.xmin - b.xmin);

  if (!sortedRows.length || !sortedCols.length) return [];

  // OCR each row-strip individually for better accuracy
  const grid: string[][] = [];

  for (let ri = 0; ri < sortedRows.length; ri++) {
    const rb = sortedRows[ri];
    const rowCrop = cropCanvas(tableCrop, rb);
    const res = await Tesseract.recognize(rowCrop, "eng");
    const rowText = res.data.text.replace(/\n/g, " ").trim();

    // split text into cells by column boundaries (rough heuristic)
    const rowCells: string[] = Array(sortedCols.length).fill("");

    // try to split by col proportions
    const colBreaks = sortedCols.map((c) => (c.xmin + c.xmax) / 2);
    const words = rowText.split(/\s+/);
    // simplest distribution: assign evenly
    const perCol = Math.max(1, Math.ceil(words.length / sortedCols.length));
    for (let ci = 0; ci < sortedCols.length; ci++) {
      rowCells[ci] = words.splice(0, perCol).join(" ");
    }

    grid.push(rowCells);
    onProgress?.(`OCR row ${ri + 1}/${sortedRows.length}…`, 85 + (ri / sortedRows.length) * 10);
  }

  return grid;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Detect and extract all tables from a rendered page canvas.
 *
 * @param canvas      HTMLCanvasElement of the page (PDF rendered or image)
 * @param textItems   Optional PDF text-layer items (canvas-space px, top-left origin)
 * @param onProgress  Progress callback
 */
export async function extractTables(
  canvas: HTMLCanvasElement,
  textItems?: PdfTextItem[],
  onProgress?: ProgressFn
): Promise<ExtractionResult> {
  const t0 = Date.now();

  // ── 1. Table detection ────────────────────────────────────────────────────
  onProgress?.("Running table detection…", 2);
  const detector = await getDetector(onProgress);

  onProgress?.("Detecting tables…", 40);
  const detections: Array<{ label: string; score: number; box: any }> =
    await detector(canvas, { threshold: 0.82 });

  const rawTables = detections.filter(
    (d) => d.label === "table" || d.label === "table rotated"
  );

  if (!rawTables.length) {
    return {
      tables: [],
      imageWidth: canvas.width,
      imageHeight: canvas.height,
      durationMs: Date.now() - t0,
      pageTextItems: textItems,
    };
  }

  // ── 2. Structure recognition per table ───────────────────────────────────
  onProgress?.("Loading structure-recognition model…", 42);
  const structurer = await getStructurer(onProgress);

  const tables: DetectedTable[] = [];

  for (let i = 0; i < rawTables.length; i++) {
    const det = rawTables[i];
    onProgress?.(
      `Analysing structure of table ${i + 1}/${rawTables.length}…`,
      73 + (i / rawTables.length) * 12
    );

    const bbox: BBox = {
      xmin: det.box.xmin / canvas.width,
      ymin: det.box.ymin / canvas.height,
      xmax: det.box.xmax / canvas.width,
      ymax: det.box.ymax / canvas.height,
    };

    const tableCrop = cropCanvas(canvas, bbox);
    const structResult: Array<{ label: string; score: number; box: any }> =
      await structurer(tableCrop, { threshold: 0.6 });

    const rows: BBox[] = [];
    const cols: BBox[] = [];
    const headers: BBox[] = [];

    for (const item of structResult) {
      const b: BBox = {
        xmin: item.box.xmin / tableCrop.width,
        ymin: item.box.ymin / tableCrop.height,
        xmax: item.box.xmax / tableCrop.width,
        ymax: item.box.ymax / tableCrop.height,
      };
      if (item.label === "table row") rows.push(b);
      else if (item.label === "table column") cols.push(b);
      else if (item.label === "table column header") headers.push(b);
    }

    // ── 3. Text assignment ─────────────────────────────────────────────────
    let grid: string[][] = [];

    if (textItems && textItems.length > 0) {
      // Fast path: use PDF.js text positions
      grid = buildGrid(rows, cols, textItems, bbox, canvas.width, canvas.height);
    } else if (rows.length > 0 && cols.length > 0) {
      // Slow path: per-cell Tesseract OCR
      grid = await ocrTableGrid(tableCrop, rows, cols, onProgress);
    }

    tables.push({ id: i, score: det.score, bbox, rows, columns: cols, columnHeaders: headers, grid });
  }

  onProgress?.("Done!", 100);

  return {
    tables,
    imageWidth: canvas.width,
    imageHeight: canvas.height,
    durationMs: Date.now() - t0,
    pageTextItems: textItems,
  };
}

// Re-export type alias used in page
export type { DetectedTable as Table };

// ─── Export helpers ───────────────────────────────────────────────────────────

export function toCSV(grid: string[][]): string {
  return grid
    .map((row) =>
      row.map((cell) => `"${(cell ?? "").replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
}

export function toJSONArray(grid: string[][]): Record<string, string>[] {
  if (grid.length < 2) return [];
  const headers = grid[0];
  return grid.slice(1).map((row) =>
    Object.fromEntries(
      headers.map((h, i) => [h || `col_${i + 1}`, row[i] ?? ""])
    )
  );
}

/** Render an XLSX workbook blob for a single table grid. */
export async function toXLSX(grid: string[][]): Promise<Blob> {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet(grid);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Table");
  const buf: ArrayBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** Download a blob as a file. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
