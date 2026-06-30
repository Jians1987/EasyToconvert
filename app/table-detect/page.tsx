"use client";

/**
 * Table Detection & Extraction  ·  /table-detect
 *
 * Pipeline:
 *   PDF / image → PDF.js page render → canvas
 *   → Microsoft Table Transformer detection  (Xenova/table-transformer-detection)
 *   → Microsoft Table Transformer structure  (Xenova/table-transformer-structure-recognition)
 *   → PDF.js text-layer mapping (PDFs) or Tesseract.js OCR (images)
 *   → grid display + CSV / JSON / XLSX export
 *
 * Runs 100 % on-device via ONNX Runtime Web (WebAssembly). Nothing is uploaded.
 */

import React, { useCallback, useRef, useState } from "react";
import ToolLayout from "@/components/ToolLayout";
import Dropzone from "@/components/Dropzone";
import {
  extractTables,
  toCSV,
  toJSONArray,
  toXLSX,
  downloadBlob,
  type ExtractionResult,
  type DetectedTable,
  type PdfTextItem,
} from "@/app/lib/tableExtractor";
import {
  Table2,
  Download,
  ChevronLeft,
  ChevronRight,
  FileJson,
  FileSpreadsheet,
  ScanSearch,
  Info,
  Star,
  Layers,
  AlertTriangle,
} from "lucide-react";
import { useConversions } from "@/app/providers";

// ─── PDF.js loader ────────────────────────────────────────────────────────────
const loadPdfJs = (): Promise<any> =>
  new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && (window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }
    const s = document.createElement("script");
    s.src =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve((window as any).pdfjsLib);
    };
    s.onerror = () => reject(new Error("Failed to load PDF.js"));
    document.head.appendChild(s);
  });

// ─── Render one PDF page → canvas + text items ───────────────────────────────
async function renderPdfPage(
  file: File,
  pageNum: number,
  scale = 2.0
): Promise<{ canvas: HTMLCanvasElement; textItems: PdfTextItem[] }> {
  const pdfjsLib = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;

  const content = await page.getTextContent();
  const textItems: PdfTextItem[] = [];
  for (const item of content.items as any[]) {
    if (!item.str?.trim()) continue;
    const [, , , , tx, ty] = item.transform as number[];
    const x = tx * scale;
    const h = Math.max((item.height ?? item.fontSize ?? 10) * scale, 4);
    const y = canvas.height - ty * scale - h;
    const w = Math.max((item.width ?? 0) * scale, 4);
    textItems.push({ text: item.str, x, y, width: w, height: h });
  }
  return { canvas, textItems };
}

// ─── Render image → canvas ───────────────────────────────────────────────────
async function renderImageToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ─── Draw detection overlays ──────────────────────────────────────────────────
const BOX_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16",
];

function drawOverlay(
  dc: HTMLCanvasElement,
  src: HTMLCanvasElement,
  tables: DetectedTable[]
) {
  const ctx = dc.getContext("2d")!;
  const sx = dc.width / src.width;
  const sy = dc.height / src.height;

  ctx.drawImage(src, 0, 0, dc.width, dc.height);

  tables.forEach((t, i) => {
    const color = BOX_COLORS[i % BOX_COLORS.length];
    const x = t.bbox.xmin * src.width * sx;
    const y = t.bbox.ymin * src.height * sy;
    const w = (t.bbox.xmax - t.bbox.xmin) * src.width * sx;
    const h = (t.bbox.ymax - t.bbox.ymin) * src.height * sy;

    // Table bounding box
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.strokeRect(x, y, w, h);

    // Label badge
    ctx.font = "bold 12px system-ui";
    const label = `Table ${i + 1}  ${(t.score * 100).toFixed(0)}%`;
    const lw = ctx.measureText(label).width + 12;
    ctx.fillStyle = color;
    ctx.fillRect(x, y - 20, lw, 20);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, x + 6, y - 5);

    // Row / column grid lines (dashed, semi-transparent)
    ctx.strokeStyle = color + "88";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    const tbW = (t.bbox.xmax - t.bbox.xmin) * src.width * sx;
    const tbH = (t.bbox.ymax - t.bbox.ymin) * src.height * sy;

    for (const row of t.rows) {
      const ry = y + row.ymin * tbH;
      ctx.beginPath(); ctx.moveTo(x, ry); ctx.lineTo(x + w, ry); ctx.stroke();
    }
    for (const col of t.columns) {
      const cx = x + col.xmin * tbW;
      ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx, y + h); ctx.stroke();
    }
    ctx.setLineDash([]);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
type Step = "idle" | "processing" | "done" | "error";

export default function TableDetectPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [step, setStep] = useState<Step>("idle");
  const [progressLabel, setProgressLabel] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [activeTable, setActiveTable] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const { addHistoryItem, favorites, toggleFavorite } = useConversions();
  const isPinned = favorites.includes("table-detect");

  const onProgress = useCallback((label: string, pct: number) => {
    setProgressLabel(label);
    setProgressPct(Math.round(pct));
  }, []);

  const handleFileSelected = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const f = files[0];
    setFile(f);
    setResult(null);
    setActiveTable(0);
    setStep("idle");
    setCurrentPage(1);
    const pdf = f.type === "application/pdf";
    setIsPdf(pdf);
    if (pdf) {
      try {
        const pdfjsLib = await loadPdfJs();
        const buf = await f.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
        setTotalPages(doc.numPages);
      } catch { setTotalPages(1); }
    } else {
      setTotalPages(1);
    }
  }, []);

  const redrawOverlay = (res: ExtractionResult) => {
    if (!displayCanvasRef.current || !sourceCanvasRef.current) return;
    const dc = displayCanvasRef.current;
    const sc = sourceCanvasRef.current;
    const maxW = dc.parentElement?.clientWidth ?? 640;
    const scale = Math.min(1, maxW / sc.width);
    dc.width = sc.width * scale;
    dc.height = sc.height * scale;
    drawOverlay(dc, sc, res.tables);
  };

  const runDetection = async () => {
    if (!file) return;
    setStep("processing");
    setProgressPct(0);
    setProgressLabel("Preparing…");
    setResult(null);
    setErrorMsg("");

    try {
      let canvas: HTMLCanvasElement;
      let textItems: PdfTextItem[] | undefined;

      if (isPdf) {
        onProgress("Rendering PDF page…", 1);
        const rendered = await renderPdfPage(file, currentPage, 2.0);
        canvas = rendered.canvas;
        textItems = rendered.textItems;
      } else {
        onProgress("Decoding image…", 1);
        canvas = await renderImageToCanvas(file);
      }

      sourceCanvasRef.current = canvas;
      const res = await extractTables(canvas, textItems, onProgress);
      setResult(res);
      setActiveTable(0);
      setTimeout(() => redrawOverlay(res), 50);

      addHistoryItem({
        fileName: file.name,
        fileSize: file.size,
        toolType: "table-detect",
        status: "success",
      });
      setStep("done");
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message ?? "Unknown error");
      setStep("error");
    }
  };

  const handleTableTabClick = (idx: number) => {
    setActiveTable(idx);
    if (result) setTimeout(() => redrawOverlay(result), 10);
  };

  const handleDownloadCSV = () => {
    if (!result) return;
    const g = result.tables[activeTable]?.grid;
    if (!g?.length) return;
    downloadBlob(new Blob([toCSV(g)], { type: "text/csv" }), `table_${activeTable + 1}.csv`);
  };

  const handleDownloadJSON = () => {
    if (!result) return;
    const g = result.tables[activeTable]?.grid;
    if (!g?.length) return;
    downloadBlob(
      new Blob([JSON.stringify(toJSONArray(g), null, 2)], { type: "application/json" }),
      `table_${activeTable + 1}.json`
    );
  };

  const handleDownloadXLSX = async () => {
    if (!result) return;
    const g = result.tables[activeTable]?.grid;
    if (!g?.length) return;
    downloadBlob(await toXLSX(g), `table_${activeTable + 1}.xlsx`);
  };

  const activeGrid = result?.tables[activeTable]?.grid ?? [];
  const hasGrid = activeGrid.length > 0 && activeGrid[0]?.length > 0;

  return (
    <ToolLayout
      title="Table Detection & Extraction"
      description="Research-grade table detection using Microsoft's Table Transformer (TATR) — trained on PubTables-1M. Locate tables in any PDF or image, recognise rows & columns, extract structured data, and export to CSV, JSON, or Excel. Runs 100% in your browser via ONNX Runtime Web."
      category="ai"
    >
      <div className="space-y-6">

        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Table2 className="w-4 h-4 text-indigo-500" />
            <span>Microsoft Table Transformer · ONNX Runtime Web · On-device</span>
          </div>
          <button
            onClick={() => toggleFavorite("table-detect")}
            className={`p-1.5 rounded-lg border transition-all ${
              isPinned
                ? "border-amber-200/50 bg-amber-500/10 text-amber-500"
                : "border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600"
            }`}
          >
            <Star className={`w-4 h-4 ${isPinned ? "fill-amber-500" : ""}`} />
          </button>
        </div>

        {/* Info banner */}
        <div className="p-3 rounded-xl border border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/10 flex items-start space-x-2.5">
          <Info className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
          <div className="text-xs text-indigo-700 dark:text-indigo-400 space-y-1">
            <span className="font-bold block">Two-stage research pipeline</span>
            <span>
              <strong>Stage 1 — Detection:</strong> table-transformer-detection locates table bounding boxes.&nbsp;
              <strong>Stage 2 — Structure:</strong> table-transformer-structure-recognition identifies rows, columns &amp; headers.
              Models (~80 MB each) download once and cache in your browser.
              PDFs with selectable text skip OCR — extraction is instant.
            </span>
          </div>
        </div>

        {/* Upload */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Upload PDF or Image
          </label>
          <Dropzone
            onFilesSelected={handleFileSelected}
            accept="application/pdf,image/*"
            multiple={false}
            maxSizeMB={50}
            title="Drop a PDF, PNG, JPG, TIFF or WebP"
            description="Tables are detected even in scanned documents"
          />
        </div>

        {/* Page selector */}
        {isPdf && totalPages > 1 && (
          <div className="flex items-center space-x-3">
            <span className="text-xs font-semibold text-slate-500">Page:</span>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1 rounded border border-slate-200 dark:border-slate-800 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1 rounded border border-slate-200 dark:border-slate-800 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Run button */}
        <button
          onClick={runDetection}
          disabled={!file || step === "processing"}
          className="w-full py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white disabled:opacity-50 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-indigo-500/20"
        >
          <ScanSearch className="w-4 h-4" />
          <span>{step === "processing" ? "Detecting…" : "Detect & Extract Tables"}</span>
        </button>

        {/* Progress */}
        {step === "processing" && (
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>{progressLabel}</span>
              <span>{progressPct}%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {step === "error" && (
          <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 flex items-start space-x-2.5 text-xs text-red-600 dark:text-red-400">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold block">Extraction failed</span>
              {errorMsg}
            </div>
          </div>
        )}

        {/* Results */}
        {step === "done" && result && (
          <div className="space-y-5">

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Tables found", value: String(result.tables.length), color: "text-indigo-500" },
                { label: "Time taken", value: `${(result.durationMs / 1000).toFixed(1)}s`, color: "text-emerald-500" },
                { label: "Page size", value: `${result.imageWidth}×${result.imageHeight}`, color: "text-amber-500" },
              ].map((s) => (
                <div key={s.label} className="p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 text-center">
                  <div className={`text-lg font-extrabold ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {result.tables.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400 text-sm">
                No tables detected. Try a different page or lower the detection threshold.
              </div>
            ) : (
              <>
                {/* Canvas overlay */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center space-x-1">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Detection Overlay</span>
                  </label>
                  <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/20">
                    <canvas ref={displayCanvasRef} className="w-full h-auto block" />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Solid boxes = table regions · dashed lines = detected row/column boundaries
                  </p>
                </div>

                {/* Table tabs */}
                {result.tables.length > 1 && (
                  <div className="flex space-x-2 overflow-x-auto pb-1">
                    {result.tables.map((t, i) => (
                      <button
                        key={i}
                        onClick={() => handleTableTabClick(i)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-all ${
                          activeTable === i
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Table {i + 1}
                        <span className="ml-1.5 opacity-70">{(t.score * 100).toFixed(0)}%</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Export buttons */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleDownloadCSV}
                    disabled={!hasGrid}
                    className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 disabled:opacity-40 hover:bg-emerald-100 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={handleDownloadJSON}
                    disabled={!hasGrid}
                    className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 disabled:opacity-40 hover:bg-blue-100 transition-colors"
                  >
                    <FileJson className="w-3.5 h-3.5" />
                    <span>Export JSON</span>
                  </button>
                  <button
                    onClick={handleDownloadXLSX}
                    disabled={!hasGrid}
                    className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-purple-200 dark:border-purple-900/50 bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 disabled:opacity-40 hover:bg-purple-100 transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Export Excel</span>
                  </button>
                  {!hasGrid && (
                    <span className="text-[10px] text-slate-400 self-center">
                      No cell text extracted — use a PDF with a selectable text layer for best results.
                    </span>
                  )}
                </div>

                {/* Grid preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Extracted Data — Table {activeTable + 1}
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {result.tables[activeTable].rows.length} rows ·{" "}
                      {result.tables[activeTable].columns.length} cols ·{" "}
                      {(result.tables[activeTable].score * 100).toFixed(1)}% confidence
                    </span>
                  </div>

                  {hasGrid ? (
                    <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-800 max-h-80">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr>
                            {activeGrid[0].map((cell, ci) => (
                              <th key={ci} className="px-3 py-2 border border-slate-200 dark:border-slate-700 bg-indigo-50 dark:bg-indigo-950/30 text-left font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                {cell || <span className="text-slate-400 italic">col {ci + 1}</span>}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activeGrid.slice(1).map((row, ri) => (
                            <tr key={ri} className="even:bg-slate-50/50 dark:even:bg-slate-900/20 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/10 transition-colors">
                              {row.map((cell, ci) => (
                                <td key={ci} className="px-3 py-1.5 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
                      <Table2 className="w-6 h-6 text-slate-300 mx-auto" />
                      <p className="text-xs text-slate-400">
                        Structure detected ({result.tables[activeTable].rows.length} rows, {result.tables[activeTable].columns.length} cols) but no text was extracted.
                      </p>
                      <p className="text-[10px] text-slate-400">
                        For scanned images, Tesseract OCR will run per-cell automatically. For PDFs, ensure the document has a selectable text layer.
                      </p>
                    </div>
                  )}
                </div>

                {/* Raw JSON detail */}
                <details className="text-xs">
                  <summary className="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold select-none">
                    Raw structure JSON
                  </summary>
                  <div className="mt-3 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 font-mono text-[10px] text-slate-500 overflow-auto max-h-48">
                    {JSON.stringify(
                      result.tables[activeTable],
                      (k, v) => (k === "grid" ? `[${(v as string[][]).length} rows]` : v),
                      2
                    )}
                  </div>
                </details>
              </>
            )}
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
