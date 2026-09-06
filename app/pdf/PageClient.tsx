"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import ToolLayout from "@/components/ToolLayout";
import Dropzone from "@/components/Dropzone";
import { useConversions } from "@/app/providers";
import { ocrImageWithUnlimitedOcr } from "@/app/lib/ocr";
import { loadPdfJs } from "@/app/lib/loadPdfJs";
import { convertPdfToDocx, type DocxProgress, type ConvertDocxOptions } from "@/app/lib/pdfToDocx";
import { convertPdfToMarkdown } from "@/app/lib/pdfToMarkdown";
import { convertMarkdownToPdf, type PageSize as MdPageSize } from "@/app/lib/markdownToPdf";
import { extractPdfText } from "@/app/lib/pdfTextExtractor";
import { convertPdfToXlsx, type XlsxProgress, type TableEngine } from "@/app/lib/pdfToXlsx";
import { renderPdfWithPdfium } from "@/app/lib/pdfiumRenderer";
import { extractTables, type PdfTextItem } from "@/app/lib/tableExtractor";
import { PDFDocument, degrees, rgb, StandardFonts } from "pdf-lib-plus-encrypt";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, ImageRun } from "docx";
import {
  FileText, Star, AlertTriangle, Download, Image as ImageIcon, Type, FileSpreadsheet, Sparkles,
  Trash2, RotateCw, ArrowUp, ArrowDown, Plus, Square, Circle as CircleIcon, PenTool, Edit3,
  Paintbrush, ChevronsUpDown, MousePointer, Check, ArrowRight, Upload, Signature, Zap, Copy
} from "lucide-react";

// Office→PDF (Word/Excel/PPT) is deliberately absent: it needs a converter
// service (LibreOffice/Gotenberg/CloudConvert) that this project does not run,
// and the endpoint behind it only ever returned 501.
type PdfMode = "merge" | "split" | "rotate" | "to-doc" | "to-excel" | "to-image" | "to-markdown" | "edit" | "protect" | "compress" | "image-to-pdf" | "markdown-to-pdf";


interface TextItem {
  str: string;
  x: number;
  y: number;
}

// Reconstruct a table grid (array of rows of cells) from positioned PDF text items
// by clustering items into rows (similar Y) and columns (similar X).
const reconstructTable = (items: TextItem[]): string[][] => {
  const cleaned = items.filter((i) => i.str && i.str.trim());
  if (cleaned.length === 0) return [];

  const yTol = 4;
  const byTop = [...cleaned].sort((a, b) => b.y - a.y);
  const rows: { y: number; items: TextItem[] }[] = [];
  for (const it of byTop) {
    let row = rows.find((r) => Math.abs(r.y - it.y) <= yTol);
    if (!row) {
      row = { y: it.y, items: [] };
      rows.push(row);
    }
    row.items.push(it);
  }

  const xTol = 12;
  const anchors: number[] = [];
  for (const x of cleaned.map((i) => i.x).sort((a, b) => a - b)) {
    if (!anchors.some((a) => Math.abs(a - x) <= xTol)) anchors.push(x);
  }
  anchors.sort((a, b) => a - b);

  return rows.map((row) => {
    const cells = new Array(anchors.length).fill("");
    for (const it of [...row.items].sort((a, b) => a.x - b.x)) {
      let ci = 0;
      let best = Infinity;
      anchors.forEach((a, idx) => {
        const d = Math.abs(a - it.x);
        if (d < best) {
          best = d;
          ci = idx;
        }
      });
      cells[ci] = cells[ci] ? `${cells[ci]} ${it.str}` : it.str;
    }
    return cells;
  });
};

const parsePageSelection = (value: string, total: number): number[] => {
  const pages = new Set<number>();
  for (const part of value.split(",")) {
    const match = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!match) continue;
    const start = Number(match[1]);
    const end = Number(match[2] || match[1]);
    for (let page = Math.min(start, end); page <= Math.max(start, end); page++) {
      if (page >= 1 && page <= total) pages.add(page - 1);
    }
  }
  return Array.from(pages);
};

/**
 * Adobe PDF Services export. Unlike every other PDF→Word path this uploads the
 * file to Adobe, so it is opt-in and labelled as such in the UI.
 */
async function convertPdfToDocxWithAdobe(file: File, ocrLocale = "en-US"): Promise<Blob> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("ocrLocale", ocrLocale);

  const response = await fetch("/api/pdf/adobe-export", { method: "POST", body: formData });

  if (!response.ok) {
    let message = "Adobe PDF Services conversion failed.";
    try {
      const payload = await response.json();
      if (payload?.error) message = payload.error;
    } catch {
      const text = await response.text();
      if (text) message = text.slice(0, 200);
    }
    if (response.status === 503) {
      message =
        "Adobe High Quality isn't configured on this server. Set PDF_SERVICES_CLIENT_ID and PDF_SERVICES_CLIENT_SECRET, or switch back to the in-browser engine.";
    }
    throw new Error(message);
  }

  return response.blob();
}

const tableFromOcrText = (text: string): string[][] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s{2,}/));

// Render a PDF page to a canvas and return canvas-space text items (top-left origin)
// suitable for Microsoft Table Transformer cell-mapping in tableExtractor.ts.
async function renderPageForTatr(
  page: any,
  scale = 2.0
): Promise<{ canvas: HTMLCanvasElement; textItems: PdfTextItem[] }> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (ctx) await page.render({ canvasContext: ctx, viewport }).promise;

  const content = await page.getTextContent();
  const textItems: PdfTextItem[] = [];
  for (const item of content.items as any[]) {
    if (!item.str?.trim()) continue;
    const [, , , , tx, ty] = item.transform as number[];
    const x = tx * scale;
    const h = Math.max((item.height ?? item.fontSize ?? 10) * scale, 4);
    // PDF.js origin is bottom-left; flip to canvas top-left.
    const y = canvas.height - ty * scale - h;
    const w = Math.max((item.width ?? 0) * scale, 4);
    textItems.push({ text: item.str, x, y, width: w, height: h });
  }
  return { canvas, textItems };
}

// Advanced PDF Editor Annotation Layer
interface Annotation {
  id: string;
  page: number; // 1-indexed (relative to pageLayout list)
  type: "text" | "draw" | "highlight" | "rect" | "circle" | "line" | "arrow" | "signature" | "image" | "redact";
  x: number; // 0..1000 scale-independent coordinate
  y: number;
  width?: number;
  height?: number;
  text?: string;
  size?: number; // text font size or stroke size
  color?: string; // hex color
  points?: { x: number; y: number }[]; // for freehand pencil/highlight
  dataUrl?: string; // base64 representation of signature or image stamp
}

interface PageLayoutItem {
  id: string;
  originalIndex: number; // -1 for blank page
  rotation: number; // 0, 90, 180, 270
}

// PDF.js comes from the shared app/lib/loadPdfJs module (bundled v4, worker
// served from /public) — imported at the top of this file.

type RenderedPdfImage = { url: string; page: number };

const renderPdfPagesWithPreferredEngine = async (
  file: File,
  options: {
    scale: number;
    imageType: "image/png" | "image/jpeg";
    quality?: number;
    password?: string;
    onProgress?: (page: number, totalPages: number) => void;
  }
): Promise<RenderedPdfImage[]> => {
  try {
    const pages = await renderPdfWithPdfium(file, options);
    return pages.map(({ url, page }) => ({ url, page }));
  } catch (error) {
    console.warn("PDFium rendering failed; falling back to PDF.js.", error);
    const pdfjsLib = await loadPdfJs();
    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      password: options.password || undefined,
    }).promise;
    const images: RenderedPdfImage[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      options.onProgress?.(pageNumber, pdf.numPages);
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: options.scale });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas rendering is unavailable.");
      await page.render({ canvasContext: context, viewport }).promise;
      images.push({ url: canvas.toDataURL(options.imageType, options.quality), page: pageNumber });
    }
    return images;
  }
};
const hexToUnit = (hex: string) => {
  const h = hex.replace("#", "");
  return {
    r: (parseInt(h.substring(0, 2), 16) || 0) / 255,
    g: (parseInt(h.substring(2, 4), 16) || 0) / 255,
    b: (parseInt(h.substring(4, 6), 16) || 0) / 255,
  };
};

const dataUrlToUint8Array = (dataUrl: string): Uint8Array => {
  const base64 = dataUrl.substring(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

// Helper for drawing SVG path points
const pointsToPath = (points?: { x: number; y: number }[]) => {
  if (!points || points.length === 0) return "";
  return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");
};

// Human-readable byte size, e.g. 4_400_000 → "4.4 MB".
const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Standard sheet sizes in PDF points (1pt = 1/72"). Portrait orientation.
const PAGE_SIZES = {
  a4: { w: 595.28, h: 841.89 },
  letter: { w: 612, h: 792 },
} as const;

// Decode an image file with its EXIF orientation baked in, returning bytes
// pdf-lib can embed. Browsers strip EXIF when you embed raw JPEG bytes directly,
// so a photo shot in landscape lands sideways; drawing through an
// orientation-corrected ImageBitmap onto a canvas fixes that. Going through the
// canvas also lets us accept formats pdf-lib can't embed natively (WebP, GIF,
// BMP) by re-exporting them as PNG. HEIC still can't be decoded by the browser
// and surfaces a clear error to the caller.
async function decodeImageOriented(
  file: File
): Promise<{ bytes: Uint8Array; format: "jpg" | "png"; width: number; height: number }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const isHeic = /\.hei[cf]$/i.test(file.name) || file.type.includes("heic") || file.type.includes("heif");
    throw new Error(
      isHeic
        ? `${file.name}: HEIC images can't be decoded in the browser. Convert it to JPG or PNG first.`
        : `${file.name}: this image format could not be decoded.`
    );
  }

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas rendering is unavailable.");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  // JPEG sources stay JPEG (smaller for photos); everything else becomes PNG so
  // any alpha channel survives.
  const isJpeg = file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name);
  const mime = isJpeg ? "image/jpeg" : "image/png";
  const dataUrl = canvas.toDataURL(mime, isJpeg ? 0.92 : undefined);
  const base64 = dataUrl.substring(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  return { bytes, format: isJpeg ? "jpg" : "png", width: canvas.width, height: canvas.height };
}

// Helper to compute bounding box of any annotation type
const getAnnBounds = (ann: Annotation) => {
  if (ann.type === "draw" || ann.type === "highlight") {
    if (!ann.points || ann.points.length === 0) return { x: ann.x, y: ann.y, w: 20, h: 20 };
    const xs = ann.points.map(p => p.x);
    const ys = ann.points.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, w: Math.max(10, maxX - minX), h: Math.max(10, maxY - minY) };
  }
  const w = ann.width ?? (ann.type === "text" ? Math.max(20, (ann.text ?? "").length * (ann.size ?? 16) * 0.6) : 100);
  const h = ann.height ?? (ann.type === "text" ? (ann.size ?? 16) * 1.2 : 50);
  return { x: ann.x, y: ann.y, w, h };
};

export function PdfPageClient() {
  const [mode, setMode] = useState<PdfMode>("merge");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [pdfPassword, setPdfPassword] = useState("");
  const [inputPassword, setInputPassword] = useState("");
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [rotateAngle, setRotateAngle] = useState(90);
  const [rotatePages, setRotatePages] = useState("all");
  const [splitPages, setSplitPages] = useState("1");
  const [totalPages, setTotalPages] = useState(0);
  const [docFidelity, setDocFidelity] = useState<"layout" | "exact" | "hybrid" | "text" | "image">("layout");
  // Defaults to the in-browser engine: it keeps the file on the device, which
  // is the promise the rest of the site makes. Adobe is opt-in.
  const [docEngine, setDocEngine] = useState<"browser" | "adobe">("browser");
  const [ocrEnabled, setOcrEnabled] = useState(true);
  const [ocrEngine, setOcrEngine] = useState<"unlimited">("unlimited");

  // Compression level for PDF → Compress. Maps to a JPEG quality + downsample
  // preset on the server (see app/api/pdf/compress/route.ts).
  const [compressLevel, setCompressLevel] = useState<"low" | "medium" | "high">("medium");

  // Image → PDF layout. "fit" makes each page match its image exactly; "a4"/
  // "letter" place the image, contained and centred, on a standard sheet.
  const [imgPdfPageSize, setImgPdfPageSize] = useState<"fit" | "a4" | "letter">("fit");
  const [imgPdfOrientation, setImgPdfOrientation] = useState<"auto" | "portrait" | "landscape">("auto");
  // Populated from the compress response headers so we can show the real
  // reduction ("4.2 MB → 1.1 MB, 74% smaller") instead of guessing.
  const [compressStats, setCompressStats] = useState<{ before: number; after: number } | null>(null);

  // PDF → Markdown output. Shown as an editable preview (copy/download), not
  // funnelled through the generic downloadUrl blob flow, since users mostly
  // want to read/copy Markdown rather than just save a file blind.
  const [markdownOutput, setMarkdownOutput] = useState("");
  const [mdCopied, setMdCopied] = useState(false);

  // Markdown → PDF page size. Output IS a PDF file here, so (unlike PDF →
  // Markdown above) it goes through the generic downloadUrl blob flow below.
  const [mdToPdfPageSize, setMdToPdfPageSize] = useState<MdPageSize>("a4");

  // Engine selector for PDF → Excel. "tatr" = Microsoft Table Transformer (on-device DETR);
  // "cluster" = legacy X/Y text-position clustering.
  const [tableEngine, setTableEngine] = useState<"tatr" | "cluster">("tatr");
  const [cloudEnhance, setCloudEnhance] = useState(false);
  const [tatrProgressLabel, setTatrProgressLabel] = useState("");
  const [tatrProgressPct, setTatrProgressPct] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  
  // Advanced Editor States
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // Security States
  const [ownerPassword, setOwnerPassword] = useState("");
  const [permPrint, setPermPrint] = useState(true);
  const [permHighResPrint, setPermHighResPrint] = useState(true);
  const [permCopy, setPermCopy] = useState(true);
  const [permModify, setPermModify] = useState(true);
  const [imagePages, setImagePages] = useState<{ url: string; page: number }[]>([]);

  // Advanced PDF Editor toolbar states
  const [toolMode, setToolMode] = useState<
    "select" | "text" | "draw" | "highlight" | "rect" | "circle" | "line" | "arrow" | "signature" | "image" | "stamp" | "redact"
  >("select");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);

  // Styling properties
  const [editColor, setEditColor] = useState("#d9230f");
  const [editSize, setEditSize] = useState(18);
  const [editText, setEditText] = useState("Tap to edit");

  // Page layout and reordering organizer
  const [pageLayout, setPageLayout] = useState<PageLayoutItem[]>([]);

  // Drag and draw states
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<{ x: number; y: number }[]>([]);
  const [highlightPoints, setHighlightPoints] = useState<{ x: number; y: number }[]>([]);

  // Drawing shape (rect, circle, line, arrow) support
  const [isDraggingShape, setIsDraggingShape] = useState(false);
  const [shapeStart, setShapeStart] = useState({ x: 0, y: 0 });
  const [shapeCurrent, setShapeCurrent] = useState({ x: 0, y: 0 });

  // Text editing inline on canvas
  const [editingTextAnnId, setEditingTextAnnId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState("");
  const [editingTextPos, setEditingTextPos] = useState({ x: 0, y: 0 });

  // Signature modal
  const [showSigModal, setShowSigModal] = useState(false);
  const [sigDrawType, setSigDrawType] = useState<"draw" | "type">("draw");
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [sigLastPos, setSigLastPos] = useState<{ x: number; y: number } | null>(null);
  const [typedSigText, setTypedSigText] = useState("");
  const [typedSigFont, setTypedSigFont] = useState("font-cursive");

  // Canvas refs for each page
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const containerRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Add-an-image file input reference
  const addImgInputRef = useRef<HTMLInputElement | null>(null);

  const { addHistoryItem, favorites, toggleFavorite } = useConversions();

  const handleFilesSelected = async (files: File[]) => {
    setSelectedFiles(files);
    setDownloadUrl(null);
    setImagePages([]);
    setIsEncrypted(false);
    setPdfPassword("");
    setInputPassword("");
    setAnnotations([]);
    setPageLayout([]);
    setToolMode("select");
    setSelectedAnnId(null);
    setMarkdownOutput("");

    if (files.length > 0 && mode === "edit") {
      try {
        const rendered = await renderPdfPagesWithPreferredEngine(files[0], {
          scale: 1.5,
          imageType: "image/jpeg",
          quality: 0.85,
        });
        setImagePages(rendered);
        setTotalPages(rendered.length);
        setPageLayout(Array.from({ length: rendered.length }, (_, index) => ({ id: `page-${index + 1}`, originalIndex: index, rotation: 0 })));
      } catch (error) {
        console.error("Editor preview rendering failed:", error);
        alert("Could not render the PDF for editing. Check your connection or try another file.");
      }
    }
  };

  const handleEditorClick = (event: React.MouseEvent<SVGSVGElement>, page: number) => {
    if (toolMode !== "text") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const annotation: Annotation = {
      id: crypto.randomUUID(), page, type: "text",
      x: ((event.clientX - bounds.left) / bounds.width) * 1000,
      y: ((event.clientY - bounds.top) / bounds.height) * 1000,
      text: editText || "Text", size: editSize, color: editColor,
    };
    setAnnotations((previous) => [...previous, annotation]);
    setSelectedAnnId(annotation.id);
  };

  const isPinned = favorites.includes("pdf-tools");

  // Compute mode label helper
  const modeLabel = useMemo(() => {
    switch (mode) {
      case "merge": return "Merge";
      case "split": return "Split";
      case "rotate": return "Rotate";
      case "to-doc": return "to Word";
      case "to-excel": return "to Excel";
      case "to-image": return "to Image";
      case "to-markdown": return "to Markdown";
      case "edit": return "Edit";
      case "protect": return "Protect";
      case "compress": return "Compress";
      case "image-to-pdf": return "Image to PDF";
      case "markdown-to-pdf": return "Markdown to PDF";
    }
  }, [mode]);

  const modeDescriptions: Record<PdfMode, string> = {
    merge: "Combine multiple PDF files into one document. Set an optional password to encrypt the output.",
    split: "Extract specific pages into a separate PDF file.",
    rotate: "Rotate all pages or a specific set of pages by 90°, 180°, or 270°.",
    "to-doc": "Convert a PDF into a Word Document (.docx). Choose a conversion engine below — the in-browser engine keeps the file on your device, and Adobe generally gives the most faithful result but uploads it.",
    "to-excel": "Extract tables from a PDF into an Excel Spreadsheet (.xlsx). Uses Microsoft Table Transformer (on-device) or Kimi Vision Cloud AI.",
    "to-image": "Render each page of a PDF as a high-quality JPG image you can save individually.",
    "to-markdown": "Convert a PDF into clean Markdown (.md) — headings, tables, and bold/italic text preserved from the text layer. Scanned pages are auto-OCR'd into GitHub-Flavoured Markdown. Runs in your browser.",
    edit: "Draw, annotate, add text, stamps, signatures, images, and shapes directly on PDF pages. Reorder, rotate, delete, and export.",
    protect: "Encrypt your PDF with a password. Apply advanced permissions to restrict printing, copying, and modifications.",
    compress: "Re-encodes embedded photos at your chosen quality level and re-packs the file structure. Scanned/photo-heavy PDFs shrink the most; text-only PDFs see smaller gains since there are no images to recompress.",
    "image-to-pdf": "Convert JPG, PNG, or other images into a single PDF document.",
    "markdown-to-pdf": "Convert a Markdown (.md) file into a formatted PDF — headings, bold/italic, lists, tables, and code blocks are all laid out and paginated automatically. Runs in your browser.",
  };

  // Check if any uploaded PDFs are encrypted
  useEffect(() => {
    const checkEncryption = async () => {
      if (selectedFiles.length === 0) {
        setIsEncrypted(false);
        return;
      }
      for (const file of selectedFiles) {
        if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) continue;
        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await PDFDocument.load(new Uint8Array(arrayBuffer), { 
            ignoreEncryption: true,
            updateMetadata: false 
          });
          if (pdf.isEncrypted) {
            setIsEncrypted(true);
            return;
          }
        } catch (e) {
          // If it fails to load, might be encrypted
          setIsEncrypted(true);
          return;
        }
      }
      setIsEncrypted(false);
    };
    checkEncryption();
  }, [selectedFiles]);

  // ---------- Annotation helpers ----------

  const getEventPos = (e: React.MouseEvent, page: number) => {
    const container = containerRefs.current.get(page);
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    const scaleX = 1000 / rect.width;
    const scaleY = 1000 / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // ---------- Signature canvas handlers ----------

  const handleSigCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setIsSigning(true);
    setSigLastPos({ x, y });
  };

  const handleSigCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSigning) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvas.getContext("2d");
    if (ctx && sigLastPos) {
      ctx.beginPath();
      ctx.moveTo(sigLastPos.x, sigLastPos.y);
      ctx.lineTo(x, y);
      ctx.strokeStyle = editColor;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.stroke();
    }
    setSigLastPos({ x, y });
  };

  const handleSigCanvasMouseUp = () => {
    setIsSigning(false);
    setSigLastPos(null);
  };

  const clearSigCanvas = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = () => {
    if (sigDrawType === "draw") {
      const canvas = sigCanvasRef.current;
      if (!canvas) return;
      const dataUrl = canvas.toDataURL("image/png");
      const newAnn: Annotation = {
        id: Math.random().toString(36).substring(2, 9),
        page: 1,
        type: "signature",
        x: 100,
        y: 100,
        width: 150,
        height: 60,
        dataUrl,
      };
      setAnnotations(prev => [...prev, newAnn]);
    } else {
      // Typed signature
      const newAnn: Annotation = {
        id: Math.random().toString(36).substring(2, 9),
        page: 1,
        type: "text",
        x: 100,
        y: 100,
        text: typedSigText || "Signature",
        size: 36,
        color: editColor,
      };
      setAnnotations(prev => [...prev, newAnn]);
    }
    setShowSigModal(false);
  };

  const addImageAnnotation = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext("2d")?.drawImage(image, 0, 0);
        setAnnotations((previous) => [...previous, {
          id: crypto.randomUUID(), page: 1, type: "image", x: 100, y: 100,
          width: 220, height: Math.max(80, 220 * image.naturalHeight / image.naturalWidth),
          dataUrl: canvas.toDataURL("image/png"),
        }]);
      };
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // ---------- Shape drawing handlers ----------

  const handleCanvasMouseDown = (e: React.MouseEvent, pageNum: number) => {
    if (toolMode === "select" || toolMode === "text") return;
    const pos = getEventPos(e, pageNum);
    if (toolMode === "draw" || toolMode === "highlight") {
      setIsDrawing(true);
      const points = [{ x: pos.x, y: pos.y }];
      if (toolMode === "draw") setDrawPoints(points);
      else setHighlightPoints(points);
    } else if (["rect", "circle", "line", "arrow", "redact"].includes(toolMode)) {
      setIsDraggingShape(true);
      setShapeStart(pos);
      setShapeCurrent(pos);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent, pageNum: number) => {
    if (toolMode === "select" || toolMode === "text") return;
    const pos = getEventPos(e, pageNum);
    if ((toolMode === "draw" || toolMode === "highlight") && isDrawing) {
      if (toolMode === "draw") setDrawPoints(prev => [...prev, pos]);
      else setHighlightPoints(prev => [...prev, pos]);
    } else if (["rect", "circle", "line", "arrow", "redact"].includes(toolMode) && isDraggingShape) {
      setShapeCurrent(pos);
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent, pageNum: number) => {
    if (toolMode === "select" || toolMode === "text") return;
    if ((toolMode === "draw" || toolMode === "highlight") && isDrawing) {
      setIsDrawing(false);
      const newAnn: Annotation = {
        id: Math.random().toString(36).substring(2, 9),
        page: pageNum,
        type: toolMode,
        x: 0, y: 0,
        points: toolMode === "draw" ? [...drawPoints] : [...highlightPoints],
        size: toolMode === "draw" ? editSize : Math.max(8, editSize * 2),
        color: editColor,
      };
      setAnnotations(prev => [...prev, newAnn]);
      setDrawPoints([]);
      setHighlightPoints([]);
    } else if (["rect", "circle", "line", "arrow", "redact"].includes(toolMode) && isDraggingShape) {
      setIsDraggingShape(false);
      const x = Math.min(shapeStart.x, shapeCurrent.x);
      const y = Math.min(shapeStart.y, shapeCurrent.y);
      const width = Math.abs(shapeCurrent.x - shapeStart.x);
      const height = Math.abs(shapeCurrent.y - shapeStart.y);
      if (width < 5 && height < 5) return;

      const newAnn: Annotation = {
        id: Math.random().toString(36).substring(2, 9),
        page: pageNum,
        type: toolMode as any,
        x, y, width, height,
        size: editSize,
        color: toolMode === "redact" ? "#ffffff" : editColor,
      };
      setAnnotations(prev => [...prev, newAnn]);
    }
  };

  // ---------- Page layout helpers ----------

  const deletePage = (index: number) => {
    setPageLayout(prev => prev.filter((_, i) => i !== index));
    setAnnotations(prev => prev
      .filter(a => a.page !== index + 1)
      .map(a => a.page > index + 1 ? { ...a, page: a.page - 1 } : a)
    );
  };

  const rotatePage = (index: number) => {
    setPageLayout(prev => prev.map((p, i) => i === index ? { ...p, rotation: (p.rotation + 90) % 360 } : p));
  };

  const movePageUp = (index: number) => {
    if (index === 0) return;
    setPageLayout(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
    setAnnotations(prev => prev.map(a => {
      if (a.page === index) return { ...a, page: index + 1 };
      if (a.page === index + 1) return { ...a, page: index };
      return a;
    }));
  };

  const movePageDown = (index: number) => {
    setPageLayout(prev => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
    setAnnotations(prev => prev.map(a => {
      if (a.page === index + 1) return { ...a, page: index + 2 };
      if (a.page === index + 2) return { ...a, page: index + 1 };
      return a;
    }));
  };

  const addBlankPage = (index: number) => {
    const newItem: PageLayoutItem = {
      id: `blank-${Date.now()}`,
      originalIndex: -1,
      rotation: 0,
    };
    setPageLayout(prev => {
      const next = [...prev];
      next.splice(index + 1, 0, newItem);
      return next;
    });
    setAnnotations(prev => prev.map(a => a.page > index + 1 ? { ...a, page: a.page + 1 } : a));
  };

  // ---------- Main processing function ----------

  const processPdf = async () => {
    if (selectedFiles.length === 0) return;
    setProcessing(true);

    try {
      const { PDFDocument: PdfLibDocument, degrees, rgb, StandardFonts } = await import("pdf-lib-plus-encrypt");
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } = await import("docx");

      // Handle encrypted PDFs
      const loadWithPassword = async (file: File) => {
        const arrayBuffer = await file.arrayBuffer();
        try {
          return await PdfLibDocument.load(new Uint8Array(arrayBuffer));
        } catch (e: any) {
          if (e.message?.includes('password') || e.message?.includes('encrypted')) {
            if (!inputPassword) {
              throw new Error('This PDF is password protected. Please enter the password.');
            }
            return await PdfLibDocument.load(new Uint8Array(arrayBuffer), { password: inputPassword } as any);
          }
          throw e;
        }
      };

      if (mode === "merge") {
        const mergedPdf = await PdfLibDocument.create();
        for (const file of selectedFiles) {
          const pdf = await loadWithPassword(file);
          const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          pages.forEach(page => mergedPdf.addPage(page));
        }

        // Apply password protection if set
        let pdfBytes: Uint8Array;
        if (pdfPassword) {
          mergedPdf.encrypt({
            userPassword: pdfPassword,
            ownerPassword: pdfPassword,
            permissions: {
              printing: "highResolution",
              copying: true,
              modifying: false,
              annotating: false,
            },
          });
          pdfBytes = await mergedPdf.save();
        } else {
          pdfBytes = await mergedPdf.save();
        }

        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);

        addHistoryItem({
          fileName: `merged_${Date.now()}.pdf`,
          fileSize: blob.size,
          toolType: "pdf-merge",
          status: "success",
          downloadUrl: url,
        });

      } else if (mode === "split") {
        const file = selectedFiles[0];
        const pdf = await loadWithPassword(file);
        const total = pdf.getPageCount();
        setTotalPages(total);

        const pagesToExtract = splitPages.split(",").flatMap(range => {
          const [start, end] = range.trim().split("-").map(Number);
          if (end) {
            return Array.from({ length: end - start + 1 }, (_, i) => start + i - 1);
          }
          return [start - 1];
        }).filter(p => p >= 0 && p < total);

        if (pagesToExtract.length === 0) {
          alert("No valid pages selected.");
          return;
        }

        const newPdf = await PdfLibDocument.create();
        for (const pageIndex of pagesToExtract) {
          const [page] = await newPdf.copyPages(pdf, [pageIndex]);
          newPdf.addPage(page);
        }

        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);

        addHistoryItem({
          fileName: `split_${Date.now()}.pdf`,
          fileSize: blob.size,
          toolType: "pdf-split",
          status: "success",
          downloadUrl: url,
        });

      } else if (mode === "rotate") {
        const file = selectedFiles[0];
        const pdf = await loadWithPassword(file);
        const pages = pdf.getPages();
        const selected = rotatePages.trim().toLowerCase() === "all"
          ? new Set(pages.map((_, index) => index))
          : new Set(parsePageSelection(rotatePages, pages.length));
        if (selected.size === 0) {
          alert("No valid pages selected.");
          return;
        }
        pages.forEach((page, index) => {
          if (!selected.has(index)) return;
          page.setRotation(degrees((page.getRotation().angle + rotateAngle) % 360));
        });

        const pdfBytes = await pdf.save();
        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);

        addHistoryItem({
          fileName: `rotated_${Date.now()}.pdf`,
          fileSize: blob.size,
          toolType: "pdf-rotate",
          status: "success",
          downloadUrl: url,
        });

      } else if (mode === "to-doc") {
        const file = selectedFiles[0];
        let blob: Blob | undefined;
        const imgScale = 3;
        const ocrFallback = ocrEnabled ? "unlimited" : "none";

        // Browser engine runner (structured/text/image + Unlimited OCR for scanned pages)
        const runBrowserEngine = async (label: string) => {
          setTatrProgressLabel(label);
          setTatrProgressPct(15);
          return convertPdfToDocx(
            file,
            docFidelity,
            inputPassword || undefined,
            (p) => {
              setTatrProgressLabel(p.message);
              setTatrProgressPct(p.percent);
            },
            { imageScale: imgScale, ocrFallback } satisfies ConvertDocxOptions
          );
        };

        if (docEngine === "adobe") {
          setTatrProgressLabel("Uploading to Adobe PDF Services…");
          setTatrProgressPct(20);
          blob = await convertPdfToDocxWithAdobe(file);
          setTatrProgressLabel("Conversion complete");
          setTatrProgressPct(100);

          const adobeUrl = URL.createObjectURL(blob);
          setDownloadUrl(adobeUrl);
          addHistoryItem({
            fileName: `${file.name.split(".")[0] || "document"}.docx`,
            fileSize: blob.size,
            toolType: "pdf-to-doc",
            status: "success",
            downloadUrl: adobeUrl,
          });
          return;
        }

        let isScannedPdf = false;
        if (docFidelity !== "image") {
          try {
            setTatrProgressLabel("Analysing document…");
            setTatrProgressPct(4);
            const { items, numPages } = await extractPdfText(file, inputPassword || undefined);
            const totalNonSpace = items.reduce(
              (sum, page) => sum + page.reduce((t, i) => t + i.str.replace(/\s/g, "").length, 0),
              0
            );
            isScannedPdf = totalNonSpace < Math.max(40 * numPages, 40);
          } catch (scanErr) {
            console.warn("Pre-scan failed, assuming digital PDF:", scanErr);
          }
        }

        if (docFidelity === "image") {
          blob = await runBrowserEngine(`Rendering exact-layout image (${imgScale}× quality)…`);
        } else {
          const modeLabel = docFidelity === "text"
            ? "plain text"
            : docFidelity === "exact"
            ? `Exact Layout (Editable)${ocrEnabled ? " + Unlimited OCR" : ""}`
            : docFidelity === "hybrid"
            ? `Full Replica (Editable)${ocrEnabled ? " + Unlimited OCR" : ""}`
            : `Structured (Editable)${ocrEnabled ? " + Unlimited OCR" : ""}`;
          blob = await runBrowserEngine(`Structuring document (${modeLabel})…`);
        }

        const url = URL.createObjectURL(blob!);
        setDownloadUrl(url);

        addHistoryItem({
          fileName: `${file.name.split(".")[0] || "document"}.docx`,
          fileSize: blob!.size,
          toolType: "pdf-to-doc",
          status: "success",
          downloadUrl: url,
        });

      } else if (mode === "to-excel") {
        const file = selectedFiles[0];
        setTatrProgressLabel("Extracting tables with Unlimited OCR & TATR…");
        setTatrProgressPct(10);
        const { blob, sheetCount, totalTables } = await convertPdfToXlsx(
          file,
          tableEngine,
          inputPassword || undefined,
          cloudEnhance,
          (p) => {
            setTatrProgressLabel(p.message);
            setTatrProgressPct(p.percent);
          }
        );

        const url = URL.createObjectURL(blob!);
        setDownloadUrl(url);

        addHistoryItem({
          fileName: `${file.name.split(".")[0] || "tables"}.xlsx`,
          fileSize: blob!.size,
          toolType: "pdf-to-excel",
          status: "success",
          downloadUrl: url,
        });

      } else if (mode === "to-image") {
        const file = selectedFiles[0];
        const images = await renderPdfPagesWithPreferredEngine(file, {
          scale: 2.0,
          imageType: "image/jpeg",
          quality: 0.95,
          password: inputPassword || undefined,
          onProgress: (page, totalPages) => {
            setTatrProgressLabel(`PDFium rendering page ${page} of ${totalPages}...`);
            setTatrProgressPct(5 + Math.round((page / totalPages) * 90));
          },
        });

        setImagePages(images);

        if (images.length > 0) {
          setDownloadUrl(images[0].url);
        }

        addHistoryItem({
          fileName: `${file.name.split(".")[0] || "preview"}_page1.jpg`,
          fileSize: 0,
          toolType: "pdf-to-image",
          status: "success",
        });

      } else if (mode === "to-markdown") {
        const file = selectedFiles[0];
        setMarkdownOutput("");
        setTatrProgressLabel("Analysing document…");
        setTatrProgressPct(5);

        const markdown = await convertPdfToMarkdown(
          file,
          inputPassword || undefined,
          (p) => {
            setTatrProgressLabel(p.message);
            setTatrProgressPct(p.percent);
          },
          { ocrFallback: ocrEnabled }
        );
        setMarkdownOutput(markdown);

        addHistoryItem({
          fileName: `${file.name.split(".")[0] || "document"}.md`,
          fileSize: new Blob([markdown]).size,
          toolType: "pdf-to-markdown",
          status: "success",
        });

      } else if (mode === "protect") {
        const file = selectedFiles[0];
        const pdf = await loadWithPassword(file);
        
        if (!inputPassword && !ownerPassword) {
          throw new Error("You must provide at least a User Password to protect the PDF.");
        }

        await pdf.encrypt({
          userPassword: inputPassword || "",
          ownerPassword: ownerPassword || inputPassword || "",
          permissions: {
            printing: permHighResPrint ? 'highResolution' : (permPrint ? 'lowResolution' : false),
            modifying: permModify,
            copying: permCopy,
            annotating: permModify,
            fillingForms: permModify,
            contentAccessibility: permCopy,
            documentAssembly: permModify,
          },
        });
        
        const pdfBytes = await pdf.save();
        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);

        addHistoryItem({
          fileName: `protected_${file.name || "document.pdf"}`,
          fileSize: blob.size,
          toolType: "pdf-protect",
          status: "success",
          downloadUrl: url,
        });

      } else if (mode === "compress") {
        const file = selectedFiles[0];
        setCompressStats(null);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("level", compressLevel);
        const res = await fetch("/api/pdf/compress", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
           // Prefer the structured { error } body (rate-limit + failures send it);
           // fall back to raw text so nothing is swallowed.
           let errMsg = `Compression failed (${res.status})`;
           try {
             const errJson = await res.json();
             if (errJson?.error) errMsg = errJson.error;
           } catch {
             const errText = await res.text().catch(() => "");
             if (errText) errMsg = errText;
           }
           throw new Error(errMsg);
        }
        const blob = await res.blob();
        // The route reports true before/after sizes in headers so the UI can
        // state the real reduction rather than trusting blob.size alone.
        const before = Number(res.headers.get("X-Original-Size")) || file.size;
        const after = Number(res.headers.get("X-Compressed-Size")) || blob.size;
        setCompressStats({ before, after });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
        addHistoryItem({
          fileName: `compressed_${file.name}`,
          fileSize: blob.size,
          toolType: "pdf-compress",
          status: "success",
          downloadUrl: url,
        });

      } else if (mode === "image-to-pdf") {
        const pdf = await PdfLibDocument.create();
        for (const file of selectedFiles) {
           // EXIF-correct + normalise the format so sideways phone photos come
           // out upright and WebP/GIF/BMP are accepted (re-exported as PNG).
           const { bytes, format, width: imgW, height: imgH } = await decodeImageOriented(file);
           const image = format === "jpg" ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);

           if (imgPdfPageSize === "fit") {
             // Page matches the (orientation-corrected) image exactly.
             const page = pdf.addPage([imgW, imgH]);
             page.drawImage(image, { x: 0, y: 0, width: imgW, height: imgH });
           } else {
             // Place the image, contained and centred, on a standard sheet.
             const base = PAGE_SIZES[imgPdfPageSize];
             const landscape =
               imgPdfOrientation === "landscape" ||
               (imgPdfOrientation === "auto" && imgW > imgH);
             const pageW = landscape ? base.h : base.w;
             const pageH = landscape ? base.w : base.h;
             const scale = Math.min(pageW / imgW, pageH / imgH);
             const drawW = imgW * scale;
             const drawH = imgH * scale;
             const page = pdf.addPage([pageW, pageH]);
             page.drawImage(image, {
               x: (pageW - drawW) / 2,
               y: (pageH - drawH) / 2,
               width: drawW,
               height: drawH,
             });
           }
        }
        const pdfBytes = await pdf.save();
        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
        addHistoryItem({
          fileName: `images_to_pdf_${Date.now()}.pdf`,
          fileSize: blob.size,
          toolType: "image-to-pdf",
          status: "success",
          downloadUrl: url,
        });

      } else if (mode === "markdown-to-pdf") {
        const file = selectedFiles[0];
        const markdownText = await file.text();
        const pdfBytes = await convertMarkdownToPdf(markdownText, { pageSize: mdToPdfPageSize });
        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
        addHistoryItem({
          fileName: `${file.name.replace(/\.(md|markdown|txt)$/i, "") || "document"}.pdf`,
          fileSize: blob.size,
          toolType: "markdown-to-pdf",
          status: "success",
          downloadUrl: url,
        });

      } else if (mode === "edit") {
        const file = selectedFiles[0];
        const pdf = await loadWithPassword(file);

        // Apply page layout reordering
        if (pageLayout.length > 0) {
          const newPdf = await PdfLibDocument.create();
          for (const item of pageLayout) {
            if (item.originalIndex === -1) {
              // Blank page
              newPdf.addPage([612, 792]);
            } else {
              const [page] = await newPdf.copyPages(pdf, [item.originalIndex]);
              if (item.rotation !== 0) {
                page.setRotation(degrees(item.rotation));
              }
              newPdf.addPage(page);
            }
          }

          // Apply annotations
          for (const ann of annotations) {
            const page = newPdf.getPage(ann.page - 1);
            if (!page) continue;

            const { width, height } = page.getSize();
            const scaleX = width / 1000;
            const scaleY = height / 1000;

            if (ann.type === "text" && ann.text) {
              page.drawText(ann.text, {
                x: ann.x * scaleX,
                y: height - ann.y * scaleY,
                size: ann.size || 16,
                color: ann.color ? rgb(...Object.values(hexToUnit(ann.color)) as [number, number, number]) : rgb(0, 0, 0),
              });
            } else if ((ann.type === "draw" || ann.type === "highlight") && ann.points) {
              for (let i = 1; i < ann.points.length; i++) {
                page.drawLine({
                  start: { x: ann.points[i - 1].x * scaleX, y: height - ann.points[i - 1].y * scaleY },
                  end: { x: ann.points[i].x * scaleX, y: height - ann.points[i].y * scaleY },
                  thickness: (ann.size || 2) * 0.5,
                  color: ann.color ? rgb(...Object.values(hexToUnit(ann.color)) as [number, number, number]) : rgb(0, 0, 0),
                  opacity: ann.type === "highlight" ? 0.3 : 1,
                });
              }
            } else if (ann.type === "rect" || ann.type === "redact") {
              page.drawRectangle({
                x: ann.x * scaleX,
                y: height - (ann.y + (ann.height || 50)) * scaleY,
                width: (ann.width || 100) * scaleX,
                height: (ann.height || 50) * scaleY,
                color: ann.type === "redact" ? rgb(1, 1, 1) : undefined,
                borderColor: ann.type === "rect" ? (ann.color ? rgb(...Object.values(hexToUnit(ann.color)) as [number, number, number]) : rgb(0, 0, 0)) : undefined,
                borderWidth: ann.type === "rect" ? (ann.size || 2) * 0.5 : 0,
              });
            } else if (ann.type === "circle") {
              page.drawEllipse({
                x: ann.x * scaleX,
                y: height - (ann.y + (ann.height || 50)) * scaleY,
                xScale: (ann.width || 100) * scaleX / 2,
                yScale: (ann.height || 50) * scaleY / 2,
                borderColor: ann.color ? rgb(...Object.values(hexToUnit(ann.color)) as [number, number, number]) : rgb(0, 0, 0),
                borderWidth: (ann.size || 2) * 0.5,
              });
            } else if (ann.type === "line" || ann.type === "arrow") {
              page.drawLine({
                start: { x: ann.x * scaleX, y: height - ann.y * scaleY },
                end: { x: (ann.x + (ann.width || 100)) * scaleX, y: height - (ann.y + (ann.height || 0)) * scaleY },
                thickness: (ann.size || 2) * 0.5,
                color: ann.color ? rgb(...Object.values(hexToUnit(ann.color)) as [number, number, number]) : rgb(0, 0, 0),
              });
            } else if (ann.type === "signature" && ann.dataUrl) {
              const imgBytes = dataUrlToUint8Array(ann.dataUrl);
              const img = await newPdf.embedPng(imgBytes);
              page.drawImage(img, {
                x: ann.x * scaleX,
                y: height - (ann.y + (ann.height || 60)) * scaleY,
                width: (ann.width || 150) * scaleX,
                height: (ann.height || 60) * scaleY,
              });
            } else if (ann.type === "image" && ann.dataUrl) {
              const imgBytes = dataUrlToUint8Array(ann.dataUrl);
              const img = await newPdf.embedPng(imgBytes);
              page.drawImage(img, {
                x: ann.x * scaleX,
                y: height - (ann.y + (ann.height || 100)) * scaleY,
                width: (ann.width || 100) * scaleX,
                height: (ann.height || 100) * scaleY,
              });
            }
          }

          const pdfBytes = await newPdf.save();
          const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          setDownloadUrl(url);

          addHistoryItem({
            fileName: `edited_${file.name || "document.pdf"}`,
            fileSize: blob.size,
            toolType: "pdf-edit",
            status: "success",
            downloadUrl: url,
          });
        }
      }
    } catch (error: any) {
      console.error("PDF processing error:", error);
      alert(`Error processing PDF: ${error.message || "Unknown error"}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ToolLayout
      title="PDF Multi-Tool Suite"
      description={modeDescriptions[mode]}
      category="pdf"
    >
      <div className="space-y-6">
        {/* Header Tabs */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex space-x-2 overflow-x-auto scrollbar-none pb-1">
            {[
              { id: "merge", label: "Merge" },
              { id: "split", label: "Split" },
              { id: "rotate", label: "Rotate" },
              { id: "to-doc", label: "→ Word" },
              { id: "to-excel", label: "→ Excel" },
              { id: "to-image", label: "→ Image" },
              { id: "to-markdown", label: "→ Markdown" },
              { id: "edit", label: "Edit" },
              { id: "protect", label: "Protect" },
              { id: "compress", label: "Compress" },
              { id: "image-to-pdf", label: "Img→PDF" },
              { id: "markdown-to-pdf", label: "MD→PDF" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setMode(t.id as PdfMode);
                  setDownloadUrl(null);
                  setImagePages([]);
                  setAnnotations([]);
                  setPageLayout([]);
                  setToolMode("select");
                  setSelectedAnnId(null);
                  setMarkdownOutput("");
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  mode === t.id
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => toggleFavorite("pdf-tools")}
            className={`p-1.5 rounded-lg border transition-all ${
              isPinned
                ? "border-amber-200/50 bg-amber-500/10 text-amber-500"
                : "border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            }`}
            title={isPinned ? "Unpin tool" : "Pin tool"}
          >
            <Star className={`w-4 h-4 ${isPinned ? "fill-amber-500" : ""}`} />
          </button>
        </div>

        {/* Dropzone */}
        <Dropzone
          onFilesSelected={handleFilesSelected}
          accept={
            mode === "image-to-pdf"
              ? "image/*"
              : mode === "markdown-to-pdf"
              ? ".md,.markdown,.txt,text/markdown,text/plain"
              : "application/pdf"
          }
          multiple={mode === "merge" || mode === "image-to-pdf"}
          maxSizeMB={50}
          title={
            mode === "merge"
              ? "Drag & drop PDF files to merge"
              : mode === "image-to-pdf"
              ? "Drag & drop image files"
              : mode === "markdown-to-pdf"
              ? "Drag & drop a Markdown (.md) file"
              : "Drag & drop a PDF file"
          }
        />

        {/* Encryption warning */}
        {isEncrypted && (
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-center space-x-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <div>
              <span className="font-bold">Password Protected PDF</span>
              <p className="mt-0.5">This PDF is encrypted. Please enter the password to process it.</p>
            </div>
          </div>
        )}

        {/* Password input for encrypted PDFs */}
        {isEncrypted && (
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-slate-400">PDF Password</label>
            <input
              type="password"
              placeholder="Enter PDF password..."
              className="w-full glass-input text-xs"
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
            />
          </div>
        )}

        {/* Mode-specific controls */}
        {selectedFiles.length > 0 && (
          <div className="space-y-4 pt-2">
            {mode === "merge" && (
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-400">
                  Optional Output Password (encrypt merged PDF)
                </label>
                <input
                  type="password"
                  placeholder="Leave blank for no password"
                  className="w-full glass-input text-xs"
                  value={pdfPassword}
                  onChange={(e) => setPdfPassword(e.target.value)}
                />
              </div>
            )}

            {mode === "split" && (
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-400">
                  Pages to Extract (e.g., 1,3,5-10)
                </label>
                <input
                  type="text"
                  placeholder="1,3,5-10"
                  className="w-full glass-input text-xs"
                  value={splitPages}
                  onChange={(e) => setSplitPages(e.target.value)}
                />
                {totalPages > 0 && (
                  <p className="text-[10px] text-slate-400">Total pages: {totalPages}</p>
                )}
              </div>
            )}

            {mode === "rotate" && (
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-400">Rotation Angle</label>
                <div className="flex space-x-2">
                  {[90, 180, 270].map((angle) => (
                    <button
                      key={angle}
                      onClick={() => setRotateAngle(angle)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        rotateAngle === angle
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {angle}°
                    </button>
                  ))}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Pages to Rotate</label>
                  <input
                    type="text"
                    aria-label="Pages to rotate"
                    placeholder="all or 1,3,5-7"
                    value={rotatePages}
                    onChange={(event) => setRotatePages(event.target.value)}
                    className="w-full glass-input text-xs"
                  />
                </div>
              </div>
            )}

            {mode === "to-doc" && (
              <div className="space-y-3">
                {/* Conversion engine */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Conversion Engine</label>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { id: "browser", label: "In Browser", hint: "Private" },
                      { id: "adobe", label: "Adobe High Quality", hint: "Uploads" },
                    ] as const).map((engine) => (
                      <button
                        key={engine.id}
                        onClick={() => setDocEngine(engine.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          docEngine === engine.id
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                        }`}
                      >
                        {engine.label}
                        <span className="ml-1.5 opacity-70 font-normal">· {engine.hint}</span>
                      </button>
                    ))}
                  </div>
                  {docEngine === "adobe" ? (
                    <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/10 space-y-1">
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                        <strong>Your PDF is uploaded to Adobe PDF Services</strong> and converted there. It
                        usually gives the most faithful editable Word output, especially for complex layouts and
                        scanned pages, but the file leaves your device. Switch to <em>In Browser</em> to keep it
                        local.
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Adobe picks its own layout strategy, so the output modes below don&rsquo;t apply.
                        Password-protected PDFs aren&rsquo;t supported on this path.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Runs entirely on your device — the file never leaves the browser. Choose how faithful the
                      output should be below.
                    </p>
                  )}
                </div>

                {/* Output Mode — browser engine only */}
                {docEngine === "browser" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Output Mode</label>
                    <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                      <Zap className="w-2.5 h-2.5" /> 3× Image Quality
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(["layout", "exact", "hybrid", "image", "text"] as const).map((f) => {
                      const labels: Record<string, string> = {
                        layout: "Structured (Editable)",
                        exact: "Exact Layout (Editable)",
                        hybrid: "Full Replica (Editable)",
                        image: "Exact Layout (Image)",
                        text: "Plain Text",
                      };
                      return (
                        <button
                          key={f}
                          onClick={() => setDocFidelity(f)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            docFidelity === f
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                          }`}
                        >
                          {labels[f]}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    {docFidelity === "layout" && "Detects headings, paragraphs, bold/italic, and tables. Reflows text — best for re-editing prose. Scanned pages are auto-OCR'd."}
                    {docFidelity === "exact" && "Places every line at its original position and re-embeds logos/photos, staying fully editable. Best for clean editing. Note: vector lines/borders/shading aren't reproduced."}
                    {docFidelity === "hybrid" && "Full visual replica: the exact page image sits behind editable text on top. Reproduces all graphics. Best for pixel-accuracy. Larger files; edits may seam on coloured backgrounds."}
                    {docFidelity === "image" && "Renders each page as a 3× resolution image — pixel-perfect but not editable."}
                    {docFidelity === "text" && "Extracts raw text in reading order. Fastest option, no formatting preserved."}
                  </p>
                </div>
                )}

                {/* OCR Settings — browser engine, non-image modes only */}
                {docEngine === "browser" && docFidelity !== "image" && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2 bg-slate-50/50 dark:bg-slate-900/30">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> OCR for Scanned Pages
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ocrEnabled}
                          onChange={(e) => setOcrEnabled(e.target.checked)}
                          className="rounded border-slate-300 text-indigo-600"
                        />
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                          {ocrEnabled ? "Enabled" : "Disabled"}
                        </span>
                      </label>
                    </div>

                    {ocrEnabled && (
                      <div className="space-y-2">
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          Pages with no embedded text are automatically sent to a cloud OCR service for text,
                          table, and structure recognition.
                        </p>
                        <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-[11px] font-medium space-y-1">
                          <div className="flex items-center gap-1.5 font-semibold">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>Heads up: this uploads an image of each scanned page</span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            Uses Kimi Vision (Moonshot AI) by default. Turn this off to skip OCR and keep the
                            document fully on your device — scanned pages will be left blank instead.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Progress indicator */}
                {processing && tatrProgressPct > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>{tatrProgressLabel}</span>
                      <span>{tatrProgressPct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                      <div
                        className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${tatrProgressPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {mode === "to-excel" && (
              <div className="space-y-3">
                <label className="text-[10px] uppercase font-bold text-slate-400">Table Detection Engine</label>
                <div className="flex space-x-2">
                  {(["tatr", "cluster"] as const).map((engine) => (
                    <button
                      key={engine}
                      onClick={() => setTableEngine(engine)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        tableEngine === engine
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {engine === "tatr" ? "Table Transformer (AI)" : "Text Clustering"}
                    </button>
                  ))}
                </div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cloudEnhance}
                    onChange={(e) => setCloudEnhance(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Zap className="w-3 h-3 text-amber-500" />
                    Cloud AI (Kimi Vision OCR) — higher accuracy, leaves your device
                  </span>
                </label>
                {cloudEnhance && (
                  <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/10">
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                      Heads up: this uploads an image of each page to Kimi K3 (Moonshot AI) for table
                      detection. Leave it off to keep the whole conversion on your device.
                    </p>
                  </div>
                )}
                {/* Progress indicator */}
                {processing && tatrProgressPct > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>{tatrProgressLabel}</span>
                      <span>{tatrProgressPct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                      <div
                        className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${tatrProgressPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {mode === "to-markdown" && (
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> OCR for Scanned Pages
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ocrEnabled}
                        onChange={(e) => setOcrEnabled(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600"
                      />
                      <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                        {ocrEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </label>
                  </div>
                  {ocrEnabled && (
                    <div className="space-y-2">
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        Pages with no embedded text are sent to a cloud OCR service, which already returns
                        GitHub-Flavoured Markdown directly.
                      </p>
                      <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-[11px] font-medium space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>Heads up: this uploads an image of each scanned page</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          Uses Kimi Vision (Moonshot AI) by default. Turn this off to skip OCR — scanned pages
                          will be left as a placeholder note instead.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Progress indicator */}
                {processing && tatrProgressPct > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>{tatrProgressLabel}</span>
                      <span>{tatrProgressPct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                      <div
                        className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${tatrProgressPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {mode === "protect" && (
              <div className="space-y-4">
                <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-slate-400">User Password (To Open)</label>
                    <input type="password" value={inputPassword} onChange={(e) => setInputPassword(e.target.value)} placeholder="Required to open the PDF..." className="glass-input w-full text-sm" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Owner Password (To Edit Permissions)</label>
                    <input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} placeholder="Required to change permissions later..." className="glass-input w-full text-sm" />
                  </div>
                </div>

                <div className="space-y-2 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-3">Permissions</label>
                  
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox" checked={permPrint} onChange={(e) => setPermPrint(e.target.checked)} className="rounded text-indigo-500 focus:ring-indigo-500/50" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Allow Printing</span>
                  </label>
                  
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox" checked={permHighResPrint} onChange={(e) => setPermHighResPrint(e.target.checked)} className="rounded text-indigo-500 focus:ring-indigo-500/50" disabled={!permPrint} />
                    <span className={`text-sm font-medium ${!permPrint ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>Allow High-Resolution Printing</span>
                  </label>
                  
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox" checked={permCopy} onChange={(e) => setPermCopy(e.target.checked)} className="rounded text-indigo-500 focus:ring-indigo-500/50" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Allow Content Copying</span>
                  </label>
                  
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox" checked={permModify} onChange={(e) => setPermModify(e.target.checked)} className="rounded text-indigo-500 focus:ring-indigo-500/50" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Allow Document Modification</span>
                  </label>
                </div>
              </div>
            )}

            {mode === "image-to-pdf" && (
              <div className="space-y-3">
                <label className="text-[10px] uppercase font-bold text-slate-400">Page Size</label>
                <div className="flex space-x-2">
                  {([
                    { id: "fit", label: "Match Image" },
                    { id: "a4", label: "A4" },
                    { id: "letter", label: "Letter" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setImgPdfPageSize(opt.id)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold ${
                        imgPdfPageSize === opt.id
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {imgPdfPageSize !== "fit" && (
                  <>
                    <label className="text-[10px] uppercase font-bold text-slate-400">Orientation</label>
                    <div className="flex space-x-2">
                      {([
                        { id: "auto", label: "Auto" },
                        { id: "portrait", label: "Portrait" },
                        { id: "landscape", label: "Landscape" },
                      ] as const).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setImgPdfOrientation(opt.id)}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold ${
                            imgPdfOrientation === opt.id
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <p className="text-[10px] text-slate-500 leading-relaxed">
                  {imgPdfPageSize === "fit"
                    ? "Each page is sized to its image. Photos keep their exact proportions with no borders."
                    : `Each image is centred on a ${imgPdfPageSize.toUpperCase()} sheet, scaled to fit. ${imgPdfOrientation === "auto" ? "Orientation follows each image." : ""}`}
                </p>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Phone photos are auto-rotated using their EXIF orientation. JPG, PNG, and WebP are supported.
                </p>
              </div>
            )}

            {mode === "markdown-to-pdf" && (
              <div className="space-y-3">
                <label className="text-[10px] uppercase font-bold text-slate-400">Page Size</label>
                <div className="flex space-x-2">
                  {([
                    { id: "a4", label: "A4" },
                    { id: "letter", label: "Letter" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setMdToPdfPageSize(opt.id)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold ${
                        mdToPdfPageSize === opt.id
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Headings, bold/italic, lists, GFM tables, code blocks, and blockquotes are rendered and paginated
                  automatically. Links render as text followed by their URL — no clickable annotations yet.
                </p>
              </div>
            )}

            {mode === "compress" && (
              <div className="space-y-3">
                <label className="text-[10px] uppercase font-bold text-slate-400">Compression Level</label>
                <div className="flex space-x-2">
                  {([
                    { id: "low", label: "Light", hint: "Best quality" },
                    { id: "medium", label: "Balanced", hint: "Recommended" },
                    { id: "high", label: "Strong", hint: "Smallest file" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCompressLevel(opt.id)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold text-center ${
                        compressLevel === opt.id
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      <span className="block">{opt.label}</span>
                      <span className={`block text-[9px] font-normal ${compressLevel === opt.id ? "text-indigo-100" : "text-slate-400"}`}>{opt.hint}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  {compressLevel === "low" && "Re-encodes embedded photos at near-lossless quality. Modest savings, no visible change."}
                  {compressLevel === "medium" && "Re-encodes photos and caps their resolution at ~2000px. Big savings on scans; text and vectors are untouched."}
                  {compressLevel === "high" && "Aggressive photo re-encoding and downsampling to ~1500px. Smallest file; images may soften. Text stays sharp."}
                </p>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Compression runs on the server. Only embedded images are re-encoded — your text stays selectable and vector graphics stay crisp.
                </p>
                {compressStats && (
                  <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/20">
                    {compressStats.after < compressStats.before ? (
                      <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        {formatBytes(compressStats.before)} → {formatBytes(compressStats.after)}
                        {" · "}
                        {Math.round((1 - compressStats.after / compressStats.before) * 100)}% smaller
                      </p>
                    ) : (
                      <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        Already well-optimised — this PDF is {formatBytes(compressStats.before)} and couldn&apos;t be shrunk further without quality loss.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {mode === "edit" && imagePages.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  {(["select", "text", "draw", "highlight", "rect", "circle", "line", "arrow", "redact"] as const).map((tool) => (
                    <button key={tool} type="button" aria-label={`Editor ${tool}`} onClick={() => setToolMode(tool)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${toolMode === tool ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}>{tool}</button>
                  ))}
                  <button type="button" aria-label="Add signature" onClick={() => setShowSigModal(true)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold dark:bg-slate-800">Signature</button>
                  <button type="button" aria-label="Add image" onClick={() => addImgInputRef.current?.click()} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold dark:bg-slate-800">Image</button>
                  <input ref={addImgInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => addImageAnnotation(event.target.files?.[0])} />
                  <input type="text" placeholder="Text value..." value={editText} onChange={(event) => setEditText(event.target.value)} className="glass-input min-w-48 flex-1 text-xs" />
                  <input type="color" aria-label="Annotation color" value={editColor} onChange={(event) => setEditColor(event.target.value)} />
                  <input type="range" aria-label="Annotation size" min="2" max="48" value={editSize} onChange={(event) => setEditSize(Number(event.target.value))} />
                  {selectedAnnId && <button type="button" onClick={() => { setAnnotations((items) => items.filter((item) => item.id !== selectedAnnId)); setSelectedAnnId(null); }} className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white">Delete</button>}
                </div>
                
                {/* Advanced Viewer Controls */}
                <div className="flex flex-wrap items-center gap-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                  <div className="flex items-center gap-2 border-r border-indigo-200 pr-4 dark:border-indigo-800">
                    <span className="text-xs font-bold text-indigo-900 dark:text-indigo-100">Layers</span>
                    <label className="flex items-center space-x-2 text-xs font-medium cursor-pointer">
                      <input type="checkbox" className="rounded text-indigo-500 focus:ring-indigo-500/50" checked={showAnnotations} onChange={(e) => setShowAnnotations(e.target.checked)} />
                      <span>Show Annotations</span>
                    </label>
                    <button type="button" onClick={() => { if(confirm("Clear all annotations?")) setAnnotations([]); }} className="ml-2 rounded-lg bg-red-100 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50">Clear All</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-900 dark:text-indigo-100">Zoom</span>
                    <button type="button" onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))} className="rounded bg-white px-2 py-1 text-xs shadow-sm border border-indigo-100 dark:border-indigo-800 dark:bg-indigo-900 hover:bg-indigo-50">-</button>
                    <span className="text-xs w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
                    <button type="button" onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))} className="rounded bg-white px-2 py-1 text-xs shadow-sm border border-indigo-100 dark:border-indigo-800 dark:bg-indigo-900 hover:bg-indigo-50">+</button>
                    <button type="button" onClick={() => setZoomLevel(1)} className="rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700 dark:bg-indigo-800 dark:text-indigo-200">Reset</button>
                  </div>
                </div>

                <div className="space-y-5" style={{ transform: `scale(${zoomLevel})`, transformOrigin: "top center", transition: "transform 0.2s ease" }}>
                  {pageLayout.map((layout, index) => {
                    const pageNumber = index + 1;
                    const image = layout.originalIndex >= 0 ? imagePages[layout.originalIndex] : undefined;
                    return (
                      <div key={layout.id} className="space-y-2">
                        <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                          <span className="font-semibold">Page {pageNumber}</span>
                          <button type="button" aria-label={`Move page ${pageNumber} up`} onClick={() => movePageUp(index)} disabled={index === 0} className="rounded bg-slate-100 p-1.5 disabled:opacity-40 dark:bg-slate-800"><ArrowUp className="h-3.5 w-3.5" /></button>
                          <button type="button" aria-label={`Move page ${pageNumber} down`} onClick={() => movePageDown(index)} disabled={index === pageLayout.length - 1} className="rounded bg-slate-100 p-1.5 disabled:opacity-40 dark:bg-slate-800"><ArrowDown className="h-3.5 w-3.5" /></button>
                          <button type="button" aria-label={`Rotate page ${pageNumber}`} onClick={() => rotatePage(index)} className="rounded bg-slate-100 p-1.5 dark:bg-slate-800"><RotateCw className="h-3.5 w-3.5" /></button>
                          <button type="button" aria-label={`Add blank page after ${pageNumber}`} onClick={() => addBlankPage(index)} className="rounded bg-slate-100 p-1.5 dark:bg-slate-800"><Plus className="h-3.5 w-3.5" /></button>
                          <button type="button" aria-label={`Delete page ${pageNumber}`} onClick={() => deletePage(index)} disabled={pageLayout.length === 1} className="rounded bg-red-50 p-1.5 text-red-600 disabled:opacity-40 dark:bg-red-950/30"><Trash2 className="h-3.5 w-3.5" /></button>
                          {layout.rotation !== 0 && <span className="text-slate-400">{layout.rotation}°</span>}
                        </div>
                        <div ref={(element) => { if (element) containerRefs.current.set(pageNumber, element); else containerRefs.current.delete(pageNumber); }} className="relative mx-auto aspect-[3/4] max-w-3xl overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800" style={{ transform: `rotate(${layout.rotation}deg)` }}>
                          {image && <img src={image.url} alt={`Page ${pageNumber}`} className="block h-full w-full object-contain" />}
                          <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className={`absolute inset-0 h-full w-full ${toolMode === "select" ? "cursor-default" : "cursor-crosshair"}`} onClick={(event) => handleEditorClick(event, pageNumber)} onMouseDown={(event) => handleCanvasMouseDown(event, pageNumber)} onMouseMove={(event) => handleCanvasMouseMove(event, pageNumber)} onMouseUp={(event) => handleCanvasMouseUp(event, pageNumber)}>
                            {showAnnotations && annotations.filter((annotation) => annotation.page === pageNumber).map((annotation) => {
                              const selected = annotation.id === selectedAnnId;
                              if (annotation.type === "text") return <text key={annotation.id} onClick={(event) => { event.stopPropagation(); setSelectedAnnId(annotation.id); }} x={annotation.x} y={annotation.y} fill={annotation.color || "#000000"} fontSize={(annotation.size || 18) * 1.5} stroke={selected ? "#6366f1" : "none"}>{annotation.text}</text>;
                              if (annotation.type === "draw" || annotation.type === "highlight") return <path key={annotation.id} onClick={() => setSelectedAnnId(annotation.id)} d={pointsToPath(annotation.points)} fill="none" stroke={annotation.color} strokeWidth={annotation.size} opacity={annotation.type === "highlight" ? 0.35 : 1} />;
                              if (annotation.type === "rect") return <rect key={annotation.id} onClick={() => setSelectedAnnId(annotation.id)} x={annotation.x} y={annotation.y} width={annotation.width} height={annotation.height} fill="none" stroke={annotation.color} strokeWidth={annotation.size} />;
                              if (annotation.type === "circle") return <ellipse key={annotation.id} onClick={() => setSelectedAnnId(annotation.id)} cx={annotation.x + (annotation.width || 0) / 2} cy={annotation.y + (annotation.height || 0) / 2} rx={(annotation.width || 0) / 2} ry={(annotation.height || 0) / 2} fill="none" stroke={annotation.color} strokeWidth={annotation.size} />;
                              if (annotation.type === "line" || annotation.type === "arrow") return <line key={annotation.id} onClick={() => setSelectedAnnId(annotation.id)} x1={annotation.x} y1={annotation.y} x2={annotation.x + (annotation.width || 0)} y2={annotation.y + (annotation.height || 0)} stroke={annotation.color} strokeWidth={annotation.size} />;
                              if ((annotation.type === "signature" || annotation.type === "image") && annotation.dataUrl) return <image key={annotation.id} onClick={() => setSelectedAnnId(annotation.id)} href={annotation.dataUrl} x={annotation.x} y={annotation.y} width={annotation.width} height={annotation.height} />;
                              if (annotation.type === "redact") return <rect key={annotation.id} onClick={() => setSelectedAnnId(annotation.id)} x={annotation.x} y={annotation.y} width={annotation.width} height={annotation.height} fill="#ffffff" stroke={selected ? "#6366f1" : "none"} strokeWidth={selected ? 2 : 0} />;
                              return null;
                            })}
                          </svg>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {showSigModal && (
                  <div role="dialog" aria-label="Add signature" className="rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    <div className="mb-3 flex gap-2">
                      <button type="button" onClick={() => setSigDrawType("draw")} className="rounded bg-slate-100 px-3 py-1.5 text-xs dark:bg-slate-800">Draw</button>
                      <button type="button" onClick={() => setSigDrawType("type")} className="rounded bg-slate-100 px-3 py-1.5 text-xs dark:bg-slate-800">Type</button>
                    </div>
                    {sigDrawType === "draw" ? <canvas ref={sigCanvasRef} width={500} height={150} aria-label="Signature canvas" className="w-full rounded border bg-white" onMouseDown={handleSigCanvasMouseDown} onMouseMove={handleSigCanvasMouseMove} onMouseUp={handleSigCanvasMouseUp} onMouseLeave={handleSigCanvasMouseUp} /> : <input aria-label="Typed signature" value={typedSigText} onChange={(event) => setTypedSigText(event.target.value)} className="glass-input w-full" placeholder="Your signature" />}
                    <div className="mt-3 flex gap-2"><button type="button" onClick={saveSignature} className="rounded bg-indigo-600 px-4 py-2 text-xs font-semibold text-white">Add signature</button><button type="button" onClick={clearSigCanvas} className="rounded bg-slate-100 px-4 py-2 text-xs dark:bg-slate-800">Clear</button><button type="button" onClick={() => setShowSigModal(false)} className="rounded bg-slate-100 px-4 py-2 text-xs dark:bg-slate-800">Cancel</button></div>
                  </div>
                )}
              </div>
            )}
            {/* Process button */}
            <button
              onClick={processPdf}
              disabled={processing}
              className="px-6 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-all flex items-center space-x-1.5 shadow-md"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{processing ? "Processing..." : mode === "edit" ? "Export & Download" : `Process PDF ${modeLabel}`}</span>
            </button>
          </div>
        )}

        {/* Download Output */}
        {downloadUrl && (
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded bg-emerald-500/10 text-emerald-500">
                {mode === "to-image" ? (
                  <ImageIcon className="w-5 h-5" />
                ) : mode === "to-excel" ? (
                  <FileSpreadsheet className="w-5 h-5" />
                ) : (
                  <FileText className="w-5 h-5" />
                )}
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Success! File Ready</span>
                <span className="text-[10px] text-slate-400">
                  {mode === "to-image" && imagePages.length > 1
                    ? `${imagePages.length} pages rendered. Download any page below.`
                    : "Your processed file is ready for download."}
                </span>
              </div>
            </div>
            <a
              href={downloadUrl}
              download={
                mode === "merge"
                  ? `merged_${Date.now()}.pdf`
                  : mode === "to-doc"
                  ? `${selectedFiles[0]?.name.split(".")[0] || "document"}.docx`
                  : mode === "to-excel"
                  ? `${selectedFiles[0]?.name.split(".")[0] || "tables"}.xlsx`
                  : mode === "to-image"
                  ? `${selectedFiles[0]?.name.split(".")[0] || "preview"}_page1.jpg`
                  : mode === "edit"
                  ? `edited_${selectedFiles[0]?.name || "document.pdf"}`
                  : mode === "markdown-to-pdf"
                  ? `${selectedFiles[0]?.name.replace(/\.(md|markdown|txt)$/i, "") || "document"}.pdf`
                  : `${mode}_pdf_${Date.now()}.pdf`
              }
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-sm"
            >
              Download {mode === "to-doc" ? ".docx" : mode === "to-excel" ? ".xlsx" : mode === "to-image" ? "Page 1" : "File"}
            </a>
          </div>
        )}
        {mode === "to-image" && imagePages.length > 1 && (
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3" aria-label="Rendered PDF pages">
            {imagePages.map((image) => (
              <a key={image.page} href={image.url} download={`${selectedFiles[0]?.name.split(".")[0] || "preview"}_page${image.page}.jpg`} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:border-indigo-400 dark:border-slate-800">
                <span>Page {image.page}</span><Download className="h-3.5 w-3.5" />
              </a>
            ))}
          </div>
        )}

        {mode === "to-markdown" && markdownOutput && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Markdown Output
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(markdownOutput);
                      setMdCopied(true);
                      setTimeout(() => setMdCopied(false), 1500);
                    } catch {
                      alert("Couldn't copy to clipboard.");
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  {mdCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {mdCopied ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([markdownOutput], { type: "text/markdown;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = (selectedFiles[0]?.name.replace(/\.pdf$/i, "") || "document") + ".md";
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .md
                </button>
              </div>
            </div>
            <textarea
              value={markdownOutput}
              onChange={(e) => setMarkdownOutput(e.target.value)}
              spellCheck={false}
              className="w-full h-96 font-mono text-xs leading-relaxed p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
